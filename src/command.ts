import { Context } from 'koishi'
import { logger } from './index'

export interface CommandOption {
  name: string
  description: string
  syntax: string
}

export interface CommandData {
  name: string
  displayName: string
  description: string
  usage: string
  options: CommandOption[]
  examples: string[]
  subCommands?: CommandData[]
  group?: string
  icon?: string
}

export interface CategoryData {
  name: string
  commands: CommandData[]
  groups?: CommandGroup[]
}

export interface CommandGroup {
  name: string
  icon: string
  commands: CommandData[]
}

/**
 * 命令提取类
 */
export class Command {
  private ctx: Context
  private readonly DEF_GROUPS = {
    'system': 'settings', 'game': 'sports_esports', 'utility': 'build',
    'admin': 'admin_panel_settings', 'user': 'person', 'media': 'perm_media',
    'music': 'music_note', 'search': 'search', 'fun': 'mood',
    'social': 'forum', 'other': 'more_horiz'
  }

  constructor(ctx: Context) {
    this.ctx = ctx
  }

  /**
   * 创建会话
   */
  private createSession(locale: string): any {
    const session: any = {
      app: this.ctx.app,
      user: { authority: 4 },
      text: (path, params) => this.ctx.i18n.render([locale], Array.isArray(path) ? path : [path], params),
      isDirect: true,
      locales: [locale],
    }
    session.resolve = (val) => typeof val === 'function' ? val(session) : val
    return session
  }

  /**
   * 提取命令分类
   */
  public async extractCategories(locale: string): Promise<CategoryData[]> {
    const session = this.createSession(locale)
    const commander = this.ctx.$commander

    // 获取顶级命令
    const roots = commander._commandList.filter((cmd: any) => !cmd.parent)

    // 处理命令
    const cmdsData = (await Promise.all(
      roots.map(cmd => this.extractCmdInfo(cmd, session))
    )).filter(Boolean)

    // 排序并分组
    cmdsData.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))

    return [{
      name: "命令列表",
      commands: cmdsData,
      groups: this.groupCmds(cmdsData)
    }]
  }

  /**
   * 分组命令
   */
  private groupCmds(cmds: CommandData[]): CommandGroup[] {
    if (!cmds?.length) return []

    // 创建分组映射
    const map = new Map<string, CommandData[]>()

    // 分配命令到分组
    cmds.forEach(cmd => {
      const group = cmd.group || this.getGroup(cmd.name)
      if (!map.has(group)) map.set(group, [])
      map.get(group).push(cmd)
    })

    // 转换为分组数组并排序
    return Array.from(map.entries())
      .map(([name, cmds]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        icon: this.getGroupIcon(name),
        commands: cmds
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * 获取分组图标
   */
  private getGroupIcon(name: string): string {
    const key = name.toLowerCase()
    if (key in this.DEF_GROUPS) return this.DEF_GROUPS[key]

    // 根据名称匹配
    switch (key) {
      case 'bot': return 'smart_toy'
      case 'chat': return 'chat'
      case 'image': return 'image'
      case 'video': return 'video_library'
      case 'plugin': return 'extension'
      case 'info': return 'info'
      case 'help': return 'help'
      case 'tools': return 'handyman'
      case 'settings': return 'settings'
      case 'commands': return 'terminal'
      default: return 'widgets'
    }
  }

  /**
   * 确定命令分组
   */
  private getGroup(name: string): string {
    if (!name) return 'other'

    const key = name.toLowerCase()

    // 根据名称特征分组
    if (key.startsWith('admin') || key.includes('.admin')) return 'admin'
    if (key.startsWith('user') || key.includes('.user') || key.includes('profile')) return 'user'
    if (key.startsWith('game') || key.includes('.game') || key.includes('play')) return 'game'
    if (key.startsWith('music') || key.includes('song') || key.includes('play.')) return 'music'
    if (key.startsWith('image') || key.includes('pic') || key.includes('photo')) return 'media'
    if (key.startsWith('video') || key.includes('movie')) return 'media'
    if (key.startsWith('search') || key.includes('find')) return 'search'
    if (key.startsWith('system') || key.includes('config') || key.includes('setting')) return 'system'
    if (key.startsWith('util') || key.includes('tool')) return 'utility'
    if (key.startsWith('fun') || key.includes('joke') || key.includes('meme')) return 'fun'
    if (key.startsWith('social') || key.includes('chat') || key.includes('message')) return 'social'

    return 'other'
  }

  /**
   * 提取命令信息
   */
  public async extractCmdInfo(command: any, session?: any): Promise<CommandData|null> {
    if (!command?.name) return null

    try {
      // 处理选项
      const options: CommandOption[] = []
      Object.values(command._options || {}).forEach((option: any) => {
        if (!option || typeof option !== 'object') return

        const addOpt = (opt: any, name: string) => {
          if (!opt) return
          const desc = session.text(opt.descPath ?? [`commands.${command.name}.options.${name}`, ""], opt.params || {})
          if (desc || opt.syntax) {
            options.push({name, description: desc || "", syntax: opt.syntax || ""})
          }
        }

        if (!('value' in option)) addOpt(option, option.name)

        // 处理选项变体
        if (option.variants) {
          for (const val in option.variants) {
            addOpt(option.variants[val], `${option.name}.${val}`)
          }
        }
      })

      // 获取描述和用法
      const desc = session.text([`commands.${command.name}.description`, ""], command.params || {})
      const usage = command._usage
        ? (typeof command._usage === "string" ? command._usage : await command._usage(session))
        : session.text([`commands.${command.name}.usage`, ""], command.params || {}) || ""

      // 获取示例
      const examples: string[] = []
      if (Array.isArray(command._examples) && command._examples.length) {
        examples.push(...command._examples)
      } else {
        const text = session.text([`commands.${command.name}.examples`, ""], command.params || {})
        if (text && typeof text === "string") {
          examples.push(...text.split("\n").filter(line => line.trim() !== ""))
        }
      }

      // 处理子命令
      const subs = Array.isArray(command.children) && command.children.length > 0
        ? (await Promise.all(command.children.map(sub => this.extractCmdInfo(sub, session)))).filter(Boolean)
        : undefined

      // 返回命令数据
      return {
        name: command.name,
        displayName: command.displayName || command.name,
        description: desc || "",
        usage,
        options,
        examples,
        subCommands: subs?.length > 0 ? subs : undefined,
        group: this.getGroup(command.name)
      }
    } catch (error) {
      logger.error(`提取命令 ${command?.name || '未知'} 失败:`, error)
      return null
    }
  }

  /**
   * 获取命令数据
   */
  public async getCommandData(name: string, locale: string): Promise<CommandData|null> {
    if (!name) return null
    const cmd = this.getCmdObj(name)
    return cmd ? await this.extractCmdInfo(cmd, this.createSession(locale)) : null
  }

  /**
   * 获取命令对象
   */
  public getCmdObj(name: string): any {
    try {
      if (!name) return null

      // 处理子命令
      if (name.includes('.')) {
        const parts = name.split('.')
        let cur = this.ctx.$commander.get(parts[0])
        if (!cur) return null

        // 处理嵌套子命令
        for (let i = 1; i < parts.length; i++) {
          const target = parts.slice(0, i+1).join('.')
          cur = cur.children?.find(child => child.name === target)
          if (!cur) return null
        }
        return cur
      }
      return this.ctx.$commander.get(name)
    } catch (error) {
      return null
    }
  }

  /**
   * 收集所有命令
   */
  public getAllCmds(): string[] {
    const processed = new Set<string>()

    // 递归收集
    const collect = (cmd: any) => {
      if (cmd?.name) {
        processed.add(cmd.name)
        cmd.children?.forEach?.(child => collect(child))
      }
    }

    // 处理顶级命令
    this.ctx.$commander._commandList.forEach(cmd => collect(cmd))
    return Array.from(processed)
  }
}
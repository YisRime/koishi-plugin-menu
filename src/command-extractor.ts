import { Context, Logger } from 'koishi'

const logger = new Logger('menu:command-extractor')

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
  group?: string  // 新增：命令所属的分组
  icon?: string   // 新增：命令的图标
}

export interface CategoryData {
  name: string
  commands: CommandData[]
  groups?: CommandGroup[] // 新增：分组数据
}

// 新增：命令分组结构
export interface CommandGroup {
  name: string      // 分组名称
  icon: string      // 分组图标
  commands: CommandData[] // 分组内的命令
}

/**
 * 命令提取类，负责从Koishi中提取命令信息
 */
export class CommandExtractor {
  private ctx: Context
  private readonly DEFAULT_GROUPS = {
    // 定义默认分组和其对应的图标
    'system': 'settings',
    'game': 'sports_esports',
    'utility': 'build',
    'admin': 'admin_panel_settings',
    'user': 'person',
    'media': 'perm_media',
    'music': 'music_note',
    'search': 'search',
    'fun': 'mood',
    'social': 'forum',
    'other': 'more_horiz'
  }

  /**
   * 创建命令提取器
   * @param ctx Koishi上下文
   */
  constructor(ctx: Context) {
    this.ctx = ctx
    logger.info('命令提取器初始化完成')
  }

  /**
   * 创建命令渲染会话
   * @param locale 语言代码
   * @returns 会话对象
   */
  private createSession(locale: string): any {
    const session: any = {
      app: this.ctx.app,
      user: { authority: 4 }, // 使用高权限以查看所有命令
      text: (path, params) => this.ctx.i18n.render([locale], Array.isArray(path) ? path : [path], params),
      isDirect: true,
      locales: [locale],
    }
    session.resolve = (val) => typeof val === 'function' ? val(session) : val
    return session
  }

  /**
   * 提取所有命令分类数据，并按分组组织
   * @param locale 语言代码
   * @returns 分类数据数组
   */
  public async extractCategories(locale: string): Promise<CategoryData[]> {
    const session = this.createSession(locale)
    const commander = this.ctx.$commander
    logger.info(`开始提取命令列表(语言: ${locale})，共有 ${commander._commandList.length} 个命令`)

    // 只获取顶级命令（没有父命令的命令）
    const rootCommands = commander._commandList.filter((cmd: any) => !cmd.parent)
    logger.info(`找到 ${rootCommands.length} 个顶级命令`)

    // 并行处理所有命令
    const commandsData = (await Promise.all(
      rootCommands.map(cmd => this.extractCommandInfo(cmd, session))
    )).filter(Boolean)

    // 按名称排序
    commandsData.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
    logger.info(`共提取 ${commandsData.length} 个可见命令`)

    // 将命令按分组组织
    const groups = this.organizeCommandsByGroups(commandsData)

    return [{
      name: "命令列表",
      commands: commandsData,
      groups: groups
    }]
  }

  /**
   * 将命令按分组组织
   * @param commands 命令数据列表
   * @returns 分组后的数据
   */
  private organizeCommandsByGroups(commands: CommandData[]): CommandGroup[] {
    // 创建一个映射来存储各个分组的命令
    const groupMap = new Map<string, CommandData[]>()

    // 首先检查每个命令是否已经定义了分组
    commands.forEach(cmd => {
      // 如果没有明确的分组，则根据命令名称分配一个
      const group = cmd.group || this.determineCommandGroup(cmd.name)

      if (!groupMap.has(group)) {
        groupMap.set(group, [])
      }
      groupMap.get(group).push(cmd)
    })

    // 将映射转换为分组数组
    const groups: CommandGroup[] = []
    groupMap.forEach((commands, groupName) => {
      groups.push({
        name: this.formatGroupName(groupName),
        icon: this.getGroupIcon(groupName),
        commands: commands
      })
    })

    // 按分组名称排序
    groups.sort((a, b) => a.name.localeCompare(b.name))

    return groups
  }

  /**
   * 格式化分组名称
   * @param groupName 原始分组名
   * @returns 格式化后的分组名
   */
  private formatGroupName(groupName: string): string {
    if (!groupName) return '其他'

    // 将分组名称首字母大写
    return groupName.charAt(0).toUpperCase() + groupName.slice(1)
  }

  /**
   * 获取分组图标
   * @param groupName 分组名称
   * @returns 图标名称
   */
  private getGroupIcon(groupName: string): string {
    const normalizedName = groupName.toLowerCase()

    // 检查是否在默认分组图标中
    if (normalizedName in this.DEFAULT_GROUPS) {
      return this.DEFAULT_GROUPS[normalizedName]
    }

    // 根据分组名尝试匹配图标
    switch (normalizedName) {
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
   * 根据命令名称确定所属分组
   * @param commandName 命令名称
   * @returns 分组名称
   */
  private determineCommandGroup(commandName: string): string {
    if (!commandName) return 'other'

    const name = commandName.toLowerCase()

    // 根据命令名前缀或关键词确定分组
    if (name.startsWith('admin') || name.includes('.admin')) return 'admin'
    if (name.startsWith('user') || name.includes('.user') || name.includes('profile')) return 'user'
    if (name.startsWith('game') || name.includes('.game') || name.includes('play')) return 'game'
    if (name.startsWith('music') || name.includes('song') || name.includes('play.')) return 'music'
    if (name.startsWith('image') || name.includes('pic') || name.includes('photo')) return 'media'
    if (name.startsWith('video') || name.includes('movie')) return 'media'
    if (name.startsWith('search') || name.includes('find')) return 'search'
    if (name.startsWith('system') || name.includes('config') || name.includes('setting')) return 'system'
    if (name.startsWith('util') || name.includes('tool')) return 'utility'
    if (name.startsWith('fun') || name.includes('joke') || name.includes('meme')) return 'fun'
    if (name.startsWith('social') || name.includes('chat') || name.includes('message')) return 'social'

    // 默认分组
    return 'other'
  }

  /**
   * 提取单个命令信息
   * @param command 命令对象
   * @param session 会话对象
   * @returns 命令数据
   */
  public async extractCommandInfo(command: any, session?: any): Promise<CommandData|null> {
    if (!command?.name) {
      logger.debug('跳过无效命令')
      return null
    }

    logger.debug(`提取命令信息: ${command.name}`)

    try {
      // 处理选项
      const options: CommandOption[] = []
      Object.values(command._options || {}).forEach((option: any) => {
        if (!option || typeof option !== 'object') return

        const processOption = (opt: any, name: string) => {
          if (!opt) return
          const description = session.text(opt.descPath ?? [`commands.${command.name}.options.${name}`, ""], opt.params || {})
          if (description || opt.syntax) {
            options.push({
              name,
              description: description || "",
              syntax: opt.syntax || ""
            })
          }
        }

        if (!('value' in option)) {
          processOption(option, option.name)
        }

        if (option.variants) {
          for (const value in option.variants) {
            processOption(option.variants[value], `${option.name}.${value}`)
          }
        }
      })

      // 获取命令描述和用法
      const description = session.text([`commands.${command.name}.description`, ""], command.params || {})
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
      const subCommands = Array.isArray(command.children) && command.children.length > 0
        ? (await Promise.all(command.children.map(subCmd => this.extractCommandInfo(subCmd, session)))).filter(Boolean)
        : undefined

      // 尝试确定命令分组
      const group = this.determineCommandGroup(command.name)

      // 构建命令数据对象
      return {
        name: command.name,
        displayName: command.displayName || command.name,
        description: description || "",
        usage,
        options,
        examples,
        subCommands: subCommands?.length > 0 ? subCommands : undefined,
        group: group  // 添加分组信息
      }
    } catch (error) {
      logger.error(`提取命令 ${command?.name || '未知命令'} 信息时出错:`, error)
      return null
    }
  }

  /**
   * 获取特定命令的数据
   * @param commandName 命令名称
   * @param locale 语言代码
   * @returns 命令数据
   */
  public async getCommandData(commandName: string, locale: string): Promise<CommandData|null> {
    if (!commandName) return null

    const command = this.getCommandObject(commandName)
    if (!command) {
      logger.warn(`命令不存在: ${commandName}`)
      return null
    }

    return await this.extractCommandInfo(command, this.createSession(locale))
  }

  /**
   * 获取命令对象
   * @param commandName 命令名称
   * @returns 命令对象
   */
  public getCommandObject(commandName: string): any {
    try {
      if (!commandName) return null

      // 处理子命令格式 (如 "info.user")
      if (commandName.includes('.')) {
        const parts = commandName.split('.')
        let currentCmd = this.ctx.$commander.get(parts[0])
        if (!currentCmd) return null

        // 处理嵌套的子命令
        for (let i = 1; i < parts.length; i++) {
          const targetName = parts.slice(0, i+1).join('.')
          currentCmd = this.findChildCommand(currentCmd, targetName)
          if (!currentCmd) return null
        }
        return currentCmd
      }
      return this.ctx.$commander.get(commandName)
    } catch (error) {
      logger.debug(`查找命令出错: ${commandName}`, error)
      return null
    }
  }

  /**
   * 查找子命令
   * @param parentCommand 父命令
   * @param fullName 完整命令名称
   * @returns 命令对象
   */
  private findChildCommand(parentCommand: any, fullName: string): any {
    if (!parentCommand?.children) return null

    // 直接查找匹配的子命令
    return parentCommand.children.find(child => child.name === fullName)
  }

  /**
   * 收集所有命令名称
   * @returns 命令名称数组
   */
  public collectAllCommands(): string[] {
    const processedCommands = new Set<string>()

    // 递归收集命令和子命令
    const collectAllCommandNames = (command: any) => {
      if (!command?.name) return
      processedCommands.add(command.name)
      command.children?.forEach?.(child => collectAllCommandNames(child))
    }

    // 处理所有顶级命令
    this.ctx.$commander._commandList.forEach(cmd => collectAllCommandNames(cmd))

    const result = Array.from(processedCommands)
    logger.info(`收集到 ${result.length} 个命令和子命令`)
    return result
  }
}

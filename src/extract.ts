import { Context } from 'koishi'
import { Layout, LayoutItem } from './render'

/**
 * 命令选项接口
 */
interface Option {
  /** 选项名称 */
  name: string
  /** 选项描述信息 */
  desc: string
  /** 选项语法格式 */
  syntax: string
}

/**
 * 命令数据接口
 * 描述完整的命令信息结构
 */
interface Command {
  /** 命令名称 */
  name: string
  /** 命令描述 */
  desc: string
  /** 使用方法 */
  usage: string
  /** 命令选项列表 */
  options: Option[]
  /** 使用示例列表 */
  examples: string[]
  /** 子命令列表，可选 */
  subs?: Command[]
}

/**
 * 创建布局数据
 * @param cmdName - 命令名称，null 或空字符串表示生成主菜单布局
 * @param commands - 命令数据数组
 * @returns Promise<Layout | null> 生成的布局数据，如果无法生成则返回 null
 */
export async function createLayout(cmdName: string = null, commands: Command[]): Promise<Layout | null> {
  if (!commands.length) return null
  const items: LayoutItem[] = []
  if (cmdName) {
    // 详情布局：为指定命令生成详细信息项
    const cmd = commands.find(c => c.name === cmdName) ||
                commands.flatMap(c => c.subs || []).find(s => s.name === cmdName)
    if (!cmd) return null
    const itemTypes = ['desc', 'usage', 'options', 'examples', 'subs'] as const
    itemTypes.forEach((type, row) => {
      if (hasContent(cmd, type)) items.push({ row: row + 1, col: 1, rowSpan: 1, colSpan: 1, commandName: cmdName, itemType: type })
    })
    return items.length > 0 ? { rows: items.length, cols: 1, items } : null
  } else {
    // 菜单布局：为所有有效命令生成描述项
    const validCommands = commands.filter(cmd => cmd.desc?.trim())
    validCommands.forEach((cmd, i) => {
      items.push({ row: Math.floor(i / 2) + 1, col: (i % 2) + 1, rowSpan: 1, colSpan: 1, commandName: cmd.name, itemType: 'desc' })
    })
    return { rows: Math.ceil(validCommands.length / 2) || 1, cols: validCommands.length > 1 ? 2 : 1, items }
  }
}

/**
 * 检查命令是否包含指定类型的内容
 * @param cmd - 命令对象
 * @param type - 内容类型 ('desc' | 'usage' | 'options' | 'examples' | 'subs')
 * @returns boolean 是否包含对应类型的有效内容
 */
function hasContent(cmd: Command, type: string): boolean {
  switch (type) {
    case 'desc': return !!(cmd.desc?.trim())
    case 'usage': return !!(cmd.usage?.trim())
    case 'options': return !!(cmd.options?.length)
    case 'examples': return !!(cmd.examples?.length)
    case 'subs': return !!(cmd.subs?.length)
    default: return false
  }
}

/**
 * 命令提取器
 */
export class Extract {
  /**
   * 创建命令提取器实例
   * @param ctx - Koishi 应用上下文对象
   */
  constructor(private readonly ctx: Context) {}

  /**
   * 获取用户首选语言代码
   * @param session - 会话对象，包含用户交互上下文
   * @returns string 语言代码，如果未找到则返回空字符串
   */
  getLocale(session: any): string {
    const locales = [...(session?.locales || []), ...(session?.channel?.locales || []), ...(session?.guild?.locales || []), ...(session?.user?.locales || [])]
    return this.ctx.i18n?.fallback(locales)?.[0] || ''
  }

  /**
   * 获取所有可用命令数据
   * @param session - 会话对象
   * @param locale - 语言代码，默认为空字符串
   * @returns Promise<Command[]> 排序后的命令数组
   */
  async getAll(session: any, locale = ''): Promise<Command[]> {
    if (locale) session.locales = [locale, ...(session.locales || [])]
    const commands = await Promise.all(
      this.ctx.$commander._commandList
        .filter(cmd => !cmd.parent && cmd.ctx.filter(session))
        .map(cmd => this.buildData(cmd, session))
    )
    return commands.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * 获取单个命令的详细数据
   * @param session - 会话对象
   * @param cmdName - 要获取的命令名称
   * @param locale - 语言代码，默认为空字符串
   * @returns Promise<Command | null> 命令数据，如果命令不存在则返回 null
   */
  async getSingle(session: any, cmdName: string, locale = ''): Promise<Command | null> {
    if (locale) session.locales = [locale, ...(session.locales || [])]
    const command = this.findCmd(cmdName, session)
    return command && !Array.isArray(command) ? await this.buildData(command, session) : null
  }

  /**
   * 获取与指定命令相关的命令数据
   * @param session - 会话对象
   * @param cmdName - 命令名称
   * @param locale - 语言代码，默认为空字符串
   * @returns Promise<Command[]> 相关命令数组，包含目标命令和可能的父命令
   */
  async getRelated(session: any, cmdName: string, locale = ''): Promise<Command[]> {
    const target = await this.getSingle(session, cmdName, locale)
    if (!target) return []
    const commands = [target]
    if (cmdName.includes('.')) {
      const parent = await this.getSingle(session, cmdName.split('.')[0], locale)
      if (parent && !commands.some(cmd => cmd.name === parent.name)) commands.unshift(parent)
    }
    return commands
  }

  /**
   * 在命令系统中查找指定名称的命令
   * @param target - 目标命令名称或快捷方式
   * @param session - 会话对象
   * @returns 找到的命令对象、匹配结果数组或 null
   * @private
   */
  private findCmd(target: string, session: any) {
    const $ = this.ctx.$commander
    const command = $.resolve(target, session)
    if (command?.ctx.filter(session)) return command
    const data = this.ctx.i18n?.find?.('commands.(name).shortcuts.(variant)', target)?.map(item => ({ ...item, command: $.resolve(item.data.name, session) }))?.filter(item => item.command?.match(session)) || []
    const perfect = data.filter(item => item.similarity === 1)
    return perfect.length ? perfect[0].command : (data.length ? data : null)
  }

  /**
   * 过滤命令列表，应用权限和隐藏检查
   * @param commands - 命令列表
   * @param session - 会话对象
   * @param showHidden - 是否显示隐藏的命令
   * @returns Promise<Command[]> 过滤后的命令列表
   */
  async filterCommands(commands: Command[], session: any, showHidden = false): Promise<Command[]> {
    const cache = new Map<string, Promise<boolean>>()
    const results = await Promise.all(commands.map(async (command) => {
      if (!showHidden && this.isCommandHidden(command.name, session)) return null
      if (!await this.checkCommandPermission(command.name, session, cache)) return null
      // 递归过滤子命令
      if (command.subs?.length) {
        const filteredSubs = await this.filterCommands(command.subs, session, showHidden)
        return { ...command, subs: filteredSubs.length ? filteredSubs : undefined }
      }
      return command
    }))
    return results.filter(Boolean)
  }

  /**
   * 过滤命令选项，应用权限和隐藏检查
   * @param command - 命令数据
   * @param session - 会话对象
   * @param showHidden - 是否显示隐藏的选项
   * @returns Command 过滤后的命令数据
   */
  filterCommandOptions(command: Command, session: any, showHidden = false): Command {
    const filteredOptions = command.options.filter(option => {
      if (!this.isOptionVisible(command.name, option.name, session)) return false
      if (!showHidden && this.isOptionHidden(command.name, option.name, session)) return false
      return true
    })
    return { ...command, options: filteredOptions }
  }

  /**
   * 检查命令权限
   * @param commandName - 命令名称
   * @param session - 会话对象
   * @param cache - 权限检查缓存
   * @returns Promise<boolean> 是否有权限
   */
  async checkCommandPermission(commandName: string, session: any, cache?: Map<string, Promise<boolean>>): Promise<boolean> {
    if (!this.ctx.permissions) return true
    return await this.ctx.permissions.test(`command:${commandName}`, session, cache)
  }

  /**
   * 检查命令是否被隐藏
   * @param commandName - 命令名称
   * @param session - 会话对象
   * @returns boolean 是否隐藏
   */
  isCommandHidden(commandName: string, session: any): boolean {
    const command = this.ctx.$commander.resolve(commandName, session)
    return command ? session.resolve?.(command.config?.hidden) || false : false
  }

  /**
   * 检查选项是否可见
   * @param commandName - 命令名称
   * @param optionName - 选项名称
   * @param session - 会话对象
   * @returns boolean 是否可见
   */
  isOptionVisible(commandName: string, optionName: string, session: any): boolean {
    const command = this.ctx.$commander.resolve(commandName, session)
    if (!command) return false
    const option = command._options[optionName]
    if (!option) return false
    return !session.user || option.authority <= session.user.authority
  }

  /**
   * 检查选项是否被隐藏
   * @param commandName - 命令名称
   * @param optionName - 选项名称
   * @param session - 会话对象
   * @returns boolean 是否隐藏
   */
  isOptionHidden(commandName: string, optionName: string, session: any): boolean {
    const command = this.ctx.$commander.resolve(commandName, session)
    if (!command) return false
    const option = command._options[optionName]
    return option ? session.resolve?.(option.hidden) || false : false
  }

  /**
   * 构建命令的完整数据结构
   * @param command - Koishi 命令对象
   * @param session - 会话对象，用于获取本地化文本
   * @returns Promise<Command | null> 构建的命令数据，如果构建失败则返回 null
   * @private
   */
  private async buildData(command: any, session: any): Promise<Command | null> {
    const getText = (path: string | string[], params = {}) => session?.text?.(path, params) || ''
    const clean = (data: any): string => {
      if (typeof data === 'string') return data
      if (Array.isArray(data)) return data.map(item => typeof item === 'string' ? item : item?.attrs?.content || '').filter(Boolean).join(' ').trim()
      return ''
    }
    const desc = getText([`commands.${command.name}.description`, ''])
    const usage = command._usage ? (typeof command._usage === 'string' ? command._usage : await command._usage(session)) : getText([`commands.${command.name}.usage`, ''])
    const options: Option[] = []
    Object.values(command._options || {}).forEach((opt: any) => {
      const add = (option: any, name: string) => {
        if (option) {
          const desc = getText(option.descPath ?? [`commands.${command.name}.options.${name}`, ''])
          if (desc || option.syntax) options.push({ name, desc: desc, syntax: option.syntax || '' })
        }
      }
      if (!('value' in opt)) add(opt, opt.name)
      if (opt.variants) Object.keys(opt.variants).forEach(key => add(opt.variants[key], `${opt.name}.${key}`))
    })
    const examples = command._examples?.length ? [...command._examples] : getText([`commands.${command.name}.examples`, '']).split('\n').filter(line => line.trim())
    const subs = command.children?.length ? (await Promise.all(command.children.filter((sub: any) => sub.ctx.filter(session)).map((sub: any) => this.buildData(sub, session)))).filter(Boolean) : []
    return {
      name: command.name, desc: clean(desc), usage: clean(usage), options,
      examples, subs: subs.length ? subs : undefined
    }
  }
}
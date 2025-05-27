import { Context } from 'koishi'

/**
 * 命令选项接口
 */
interface Option {
  /** 选项名称 */
  name: string
  /** 选项描述 */
  desc: string
  /** 选项语法 */
  syntax: string
  /** 是否隐藏 */
  hidden: boolean
  /** 权限等级 */
  authority: number
}

/**
 * 命令接口
 */
export interface Command {
  /** 命令组名 */
  group: string
  /** 命令名称 */
  name: string
  /** 是否隐藏 */
  hidden: boolean
  /** 权限等级 */
  authority: number
  /** 命令描述 */
  desc: string
  /** 使用方法 */
  usage: string
  /** 使用示例 */
  examples: string
  /** 选项列表 */
  options: Option[]
  /** 子命令列表 */
  subs?: Command[]
}

/**
 * 命令提取器，用于从 Koishi 上下文中提取和构建命令信息
 */
export class Extract {
  /**
   * 构造函数
   * @param ctx Koishi 上下文
   */
  constructor(private readonly ctx: Context) {}

  /**
   * 获取会话的语言环境
   * @param session 会话对象
   * @returns 语言环境字符串
   */
  locale(session: any): string {
    const locales = [
      ...(session?.locales || []),
      ...(session?.channel?.locales || []),
      ...(session?.guild?.locales || []),
      ...(session?.user?.locales || [])
    ]
    return this.ctx.i18n?.fallback(locales)?.[0] || ''
  }

  /**
   * 获取所有可用的命令
   * @param session 会话对象
   * @param locale 语言环境，默认为空字符串
   * @returns 命令列表的 Promise
   */
  async all(session: any, locale = ''): Promise<Command[]> {
    this.setLocale(session, locale)
    const userAuth = session.user?.authority || 0
    const commands = await Promise.all(
      (this.ctx.$commander?._commandList || [])
        .filter(cmd => !cmd?.parent && cmd?.ctx?.filter(session) && userAuth >= (cmd?.config?.authority || 0))
        .map(cmd => this.build(cmd, session, userAuth))
    )
    return commands.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * 获取单个命令信息
   * @param session 会话对象
   * @param cmdName 命令名称
   * @param locale 语言环境，默认为空字符串
   * @returns 单个命令对象的 Promise，如果未找到则返回 null
   */
  async single(session: any, cmdName: string, locale = ''): Promise<Command | null> {
    this.setLocale(session, locale)
    const command = this.find(cmdName, session)
    return command && !Array.isArray(command) ? this.build(command, session, session.user?.authority || 0) : null
  }

  /**
   * 获取相关命令（包括目标命令和其父命令）
   * @param session 会话对象
   * @param cmdName 命令名称
   * @param locale 语言环境，默认为空字符串
   * @returns 相关命令列表的 Promise
   */
  async related(session: any, cmdName: string, locale = ''): Promise<Command[]> {
    const target = await this.single(session, cmdName, locale)
    if (!target) return []
    const commands = [target]
    if (cmdName.includes('.')) {
      const parent = await this.single(session, cmdName.split('.')[0], locale)
      if (parent && !commands.some(cmd => cmd.name === parent.name)) commands.unshift(parent)
    }
    return commands
  }

  /**
   * 过滤命令列表
   * @param commands 命令列表
   * @param session 会话对象
   * @param showHidden 是否显示隐藏命令，默认为 false
   * @returns 过滤后的命令列表
   */
  filter(commands: Command[], session: any, showHidden = false): Command[] {
    return commands.filter(command => showHidden || !command.hidden)
  }

  /**
   * 设置会话的语言环境
   * @param session 会话对象
   * @param locale 语言环境
   */
  private setLocale(session: any, locale: string): void {
    if (locale) session.locales = [locale, ...(session?.locales || [])]
  }

  /**
   * 查找指定名称的命令
   * @param target 目标命令名称
   * @param session 会话对象
   * @returns 找到的命令对象或快捷方式列表
   */
  private find(target: string, session: any) {
    const command = this.ctx.$commander?.resolve(target, session)
    if (command?.ctx?.filter(session)) return command
    const shortcuts = this.ctx.i18n?.find?.('commands.(name).shortcuts.(variant)', target)
      ?.map(item => ({ ...item, command: this.ctx.$commander?.resolve(item?.data?.name, session) }))
      ?.filter(item => item?.command?.match(session)) || []
    const perfect = shortcuts.filter(item => item?.similarity === 1)
    return perfect.length ? perfect[0]?.command : (shortcuts.length ? shortcuts : null)
  }

  /**
   * 构建命令对象
   * @param command 原始命令对象
   * @param session 会话对象
   * @param userAuth 用户权限等级
   * @returns 构建的命令对象的 Promise，如果权限不足则返回 null
   */
  private async build(command: any, session: any, userAuth: number): Promise<Command | null> {
    const cmdAuth = command?.config?.authority || 0
    if (userAuth < cmdAuth) return null
    const name = command?.name || ''
    const getText = (path: string | string[]) => session?.text?.(path) || ''
    return {
      group: session?.resolve(command?.config?.group) || '其它',
      name, authority: cmdAuth,
      hidden: session?.resolve(command?.config?.hidden) || false,
      desc: this.cleanText(getText([`commands.${name}.description`, ''])),
      usage: this.cleanText(await this.getUsage(command, session, name)),
      examples: this.getExamples(command, getText, name),
      options: this.buildOptions(command, session, userAuth, getText, name),
      subs: await this.buildSubCommands(command, session, userAuth)
    }
  }

  /**
   * 清理文本数据，将各种格式的文本转换为纯字符串
   * @param data 文本数据
   * @returns 清理后的字符串
   */
  private cleanText(data: any): string {
    if (typeof data === 'string') return data
    if (Array.isArray(data)) {
      return data.map(item => typeof item === 'string' ? item : item?.attrs?.content || '')
        .filter(Boolean).join(' ').trim()
    }
    return ''
  }

  /**
   * 获取命令的使用方法
   * @param command 命令对象
   * @param session 会话对象
   * @param name 命令名称
   * @returns 使用方法字符串的 Promise
   */
  private async getUsage(command: any, session: any, name: string): Promise<string> {
    return command?._usage
      ? (typeof command._usage === 'string' ? command._usage : await command._usage(session))
      : session?.text?.([`commands.${name}.usage`, '']) || ''
  }

  /**
   * 获取命令的使用示例
   * @param command 命令对象
   * @param getText 获取文本的函数
   * @param name 命令名称
   * @returns 使用示例字符串
   */
  private getExamples(command: any, getText: Function, name: string): string {
    return command?._examples?.length
      ? command._examples.join('\n\n')
      : getText([`commands.${name}.examples`, '']).split('\n').filter((line: string) => line.trim()).join('\n\n')
  }

  /**
   * 构建命令选项列表
   * @param command 命令对象
   * @param session 会话对象
   * @param userAuth 用户权限等级
   * @param getText 获取文本的函数
   * @param cmdName 命令名称
   * @returns 选项列表
   */
  private buildOptions(command: any, session: any, userAuth: number, getText: Function, cmdName: string): Option[] {
    const options: Option[] = []
    const addOption = (option: any, name: string) => {
      if (!option || userAuth < (option?.authority || 0)) return
      const desc = getText(option?.descPath ?? [`commands.${cmdName}.options.${name}`, ''])
      if (desc || option?.syntax) {
        options.push({
          name, desc, syntax: option?.syntax || '',
          hidden: session?.resolve(option?.hidden) || false,
          authority: option?.authority || 0
        })
      }
    }
    Object.values(command?._options || {}).forEach((opt: any) => {
      if (!('value' in opt)) addOption(opt, opt?.name)
      if (opt?.variants) Object.keys(opt.variants).forEach(key => addOption(opt.variants[key], `${opt?.name}.${key}`))
    })
    return options
  }

  /**
   * 构建子命令列表
   * @param command 命令对象
   * @param session 会话对象
   * @param userAuth 用户权限等级
   * @returns 子命令列表的 Promise，如果没有子命令则返回 undefined
   */
  private async buildSubCommands(command: any, session: any, userAuth: number): Promise<Command[] | undefined> {
    if (!command?.children?.length) return undefined
    const subs = (await Promise.all(
      command.children
        .filter((sub: any) => sub?.ctx?.filter(session) && userAuth >= (sub?.config?.authority || 0))
        .map((sub: any) => this.build(sub, session, userAuth))
    )).filter(Boolean)
    return subs.length ? subs : undefined
  }
}
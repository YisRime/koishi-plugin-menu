import { Context } from 'koishi'

/**
 * 选项配置接口
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
 * 命令配置接口
 */
export interface Command {
  /** 命令分组 */
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
 * 命令提取器，从 Koishi 上下文中提取和处理命令数据
 */
export class Extract {
  /**
   * 创建命令提取器实例
   * @param ctx Koishi 上下文对象
   */
  constructor(private readonly ctx: Context) {}

  /**
   * 获取会话的语言设置
   * @param session 会话对象
   * @returns 语言代码
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
   * 获取所有可用命令
   * @param session 会话对象
   * @param locale 语言代码
   * @returns 命令列表
   */
  async all(session: any, locale = ''): Promise<Command[]> {
    if (locale) session.locales = [locale, ...(session?.locales || [])]
    const commands = await Promise.all(
      this.ctx.$commander?._commandList
        ?.filter(cmd => !cmd?.parent && cmd?.ctx?.filter(session))
        ?.map(cmd => this.build(cmd, session)) || []
    )
    return commands.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * 获取单个命令数据
   * @param session 会话对象
   * @param cmdName 命令名称
   * @param locale 语言代码
   * @returns 命令对象或null
   */
  async single(session: any, cmdName: string, locale = ''): Promise<Command | null> {
    if (locale) session.locales = [locale, ...(session?.locales || [])]
    const command = this.find(cmdName, session)
    return command && !Array.isArray(command) ? await this.build(command, session) : null
  }

  /**
   * 获取相关命令（包括父命令）
   * @param session 会话对象
   * @param cmdName 命令名称
   * @param locale 语言代码
   * @returns 相关命令列表
   */
  async related(session: any, cmdName: string, locale = ''): Promise<Command[]> {
    const target = await this.single(session, cmdName, locale)
    if (!target) return []
    const commands = [target]
    // 如果是子命令，添加父命令
    if (cmdName.includes('.')) {
      const parent = await this.single(session, cmdName.split('.')[0], locale)
      if (parent && !commands.some(cmd => cmd.name === parent.name)) commands.unshift(parent)
    }
    return commands
  }

  /**
   * 过滤命令列表（权限和隐藏检查）
   * @param commands 原始命令列表
   * @param session 会话对象
   * @param showHidden 是否显示隐藏项
   * @returns 过滤后的命令列表
   */
  async filter(commands: Command[], session: any, showHidden = false): Promise<Command[]> {
    const userAuth = session.user?.authority || 0
    const result: Command[] = []
    for (const command of commands) {
      if (userAuth < command.authority) continue
      if (!showHidden && command.hidden) continue
      const options = command.options.filter(option =>
        userAuth >= option.authority && (showHidden || !option.hidden)
      )
      let subs: Command[] | undefined
      if (command.subs?.length) {
        subs = await this.filter(command.subs, session, showHidden)
        if (!subs.length) subs = undefined
      }
      result.push({ ...command, options, subs })
    }
    return result
  }

  /**
   * 查找命令对象
   * @param target 目标命令名
   * @param session 会话对象
   * @returns 命令对象或快捷方式数组
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
   * 构建命令数据对象
   * @param command 原始命令对象
   * @param session 会话对象
   * @returns 构建的命令对象或null
   */
  private async build(command: any, session: any): Promise<Command | null> {
    const getText = (path: string | string[], params = {}) => session?.text?.(path, params) || ''
    const clean = (data: any): string => {
      if (typeof data === 'string') return data
      if (Array.isArray(data)) {
        return data.map(item => typeof item === 'string' ? item : item?.attrs?.content || '')
          .filter(Boolean).join(' ').trim()
      }
      return ''
    }
    const desc = getText([`commands.${command?.name}.description`, ''])
    const usage = command?._usage
      ? (typeof command._usage === 'string' ? command._usage : await command._usage(session))
      : getText([`commands.${command?.name}.usage`, ''])
    // 构建选项列表
    const options: Option[] = []
    Object.values(command?._options || {}).forEach((opt: any) => {
      const addOpt = (option: any, name: string) => {
        if (!option) return
        const desc = getText(option?.descPath ?? [`commands.${command?.name}.options.${name}`, ''])
        if (desc || option?.syntax) {
          options.push({
            name, desc, syntax: option?.syntax || '',
            hidden: session?.resolve(option?.hidden) || false,
            authority: option?.authority || 0
          })
        }
      }
      if (!('value' in opt)) addOpt(opt, opt?.name)
      if (opt?.variants) Object.keys(opt.variants).forEach(key => addOpt(opt.variants[key], `${opt?.name}.${key}`))
    })
    const examples = command?._examples?.length
      ? command._examples.join('\n\n')
      : getText([`commands.${command?.name}.examples`, '']).split('\n').filter(line => line.trim()).join('\n\n')
    const subs = command?.children?.length
      ? (await Promise.all(
          command.children
            .filter((sub: any) => sub?.ctx?.filter(session))
            .map((sub: any) => this.build(sub, session))
        )).filter(Boolean)
      : []
    return {
      group: session?.resolve(command?.config?.group) || '未分组',
      name: command?.name || '', authority: command?.config?.authority || 0,
      hidden: session?.resolve(command?.config?.hidden) || false,
      desc: clean(desc), usage: clean(usage),
      options, examples, subs: subs.length ? subs : undefined,
    }
  }
}
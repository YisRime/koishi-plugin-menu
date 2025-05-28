import { Context } from 'koishi'

/**
 * 指令选项接口
 * @interface Option
 * @description 定义指令选项的结构
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
 * 指令名称项接口
 * @interface NameItem
 * @description 定义指令名称的结构，包含别名信息
 */
interface NameItem {
  /** 名称或别名 */
  name: string
  /** 是否启用 */
  enabled: boolean
  /** 是否为默认名称 */
  isDefault?: boolean
}

/**
 * 指令接口
 * @interface Command
 * @description 定义完整的指令结构
 */
export interface Command {
  /** 指令分组 */
  group: string
  /** 指令名称列表（包含别名） */
  name: NameItem[]
  /** 是否隐藏 */
  hidden: boolean
  /** 权限等级 */
  authority: number
  /** 指令描述 */
  desc: string
  /** 使用方法 */
  usage: string
  /** 示例 */
  examples: string
  /** 选项列表 */
  options: Option[]
  /** 子指令列表 */
  subs?: Command[]
}

/**
 * 指令提取器
 * @class Extract
 * @description 负责从Koishi上下文中提取和处理指令信息
 */
export class Extract {
  /**
   * 构造函数
   * @param {Context} ctx - Koishi上下文实例
   */
  constructor(private readonly ctx: Context) {}

  /**
   * 获取会话语言代码
   * @param {any} session - 会话对象
   * @returns {string} 语言代码，默认为'zh-CN'
   * @description 从会话的多个来源获取语言设置，按优先级返回最合适的语言代码
   */
  locale(session: any): string {
    const locales = [...(session?.locales || []), ...(session?.channel?.locales || []), ...(session?.guild?.locales || []), ...(session?.user?.locales || [])]
    return this.ctx.i18n?.fallback(locales)?.[0] || 'zh-CN'
  }

  /**
   * 获取所有可用指令（仅根命令基本信息）
   * @param {any} session - 会话对象
   * @param {string} [locale=''] - 语言代码
   * @param {boolean} [showHidden=false] - 是否显示隐藏指令
   * @returns {Promise<Command[]>} 指令列表
   * @description 获取所有根命令的基本信息，不包含详细的选项和子命令数据
   */
  async all(session: any, locale = '', showHidden = false): Promise<Command[]> {
    if (!this.ctx.$commander) return []
    this.setLocale(session, locale)
    const userAuth = session.user?.authority || 0
    const commands = this.ctx.$commander._commandList
      ?.filter(cmd => !cmd?.parent && cmd?.ctx?.filter?.(session) && userAuth >= (cmd.config?.authority || 0) && (showHidden || !session?.resolve?.(cmd.config?.hidden)))
      .map(cmd => this.buildListCommand(cmd, session)) || []
    return commands.sort((a, b) => a.name[0].name.localeCompare(b.name[0].name))
  }

  /**
   * 获取单个指令详细信息
   * @param {any} session - 会话对象
   * @param {string} cmdName - 指令名称
   * @param {string} [locale=''] - 语言代码
   * @param {boolean} [showHidden=false] - 是否显示隐藏内容
   * @returns {Promise<Command | null>} 指令详细信息，未找到时返回null
   * @description 获取指定指令的完整信息，包括选项、子命令等详细数据
   */
  async single(session: any, cmdName: string, locale = '', showHidden = false): Promise<Command | null> {
    if (!cmdName) return null
    this.setLocale(session, locale)
    const command = this.findCommand(cmdName, session)
    return command ? this.buildDetailCommand(command, session, showHidden) : null
  }

  /**
   * 获取相关指令列表
   * @param {any} session - 会话对象
   * @param {string} cmdName - 指令名称
   * @param {string} [locale=''] - 语言代码
   * @param {boolean} [showHidden=false] - 是否显示隐藏内容
   * @returns {Promise<Command[]>} 相关指令列表
   * @description 获取与指定指令相关的指令列表，包括父命令（如果是子命令）
   */
  async related(session: any, cmdName: string, locale = '', showHidden = false): Promise<Command[]> {
    const target = await this.single(session, cmdName, locale, showHidden)
    if (!target) return []
    const commands = [target]
    if (cmdName.includes('.')) {
      const parent = await this.single(session, cmdName.split('.')[0], locale, showHidden)
      if (parent) commands.unshift(parent)
    }
    return commands
  }

  /**
   * 过滤指令列表
   * @param {Command[]} commands - 原始指令列表
   * @param {boolean} [showHidden=false] - 是否显示隐藏内容
   * @param {boolean} [isDetailView=false] - 是否为详情视图
   * @returns {Command[]} 过滤后的指令列表
   * @description 根据显示设置过滤指令列表，移除隐藏的指令、选项和子命令
   */
  filter(commands: Command[], showHidden = false, isDetailView = false): Command[] {
    return commands.filter(cmd => isDetailView || showHidden || !cmd.hidden)
      .map(cmd => ({ ...cmd,
        options: cmd.options.filter(opt => showHidden || !opt.hidden),
        subs: cmd.subs?.filter(sub => showHidden || !sub.hidden)
      }))
  }

  /**
   * 设置会话语言
   * @private
   * @param {any} session - 会话对象
   * @param {string} locale - 语言代码
   * @description 将指定语言代码添加到会话的语言列表前端
   */
  private setLocale(session: any, locale: string): void {
    if (locale) session.locales = [locale, ...(session?.locales || [])]
  }

  /**
   * 查找指令
   * @private
   * @param {string} target - 目标指令名称
   * @param {any} session - 会话对象
   * @returns {any} 指令对象，未找到或无权限时返回null
   * @description 通过指令名称查找指令，并检查上下文过滤条件
   */
  private findCommand(target: string, session: any) {
    const command = this.ctx.$commander?.resolve(target, session)
    return command?.ctx?.filter?.(session) ? command : null
  }

  /**
   * 获取指令名称配置
   * @private
   * @param {any} command - 指令对象
   * @returns {NameItem[]} 名称项列表
   * @description 从指令的别名配置中提取名称项，包括启用状态和默认标记
   */
  private getNameItems(command: any): NameItem[] {
    if (!command?._aliases) return [{ name: command?.name || '', enabled: true, isDefault: true }]
    const entries = Object.entries(command._aliases)
    const nameItems: NameItem[] = []
    let hasDefault = false
    entries.forEach(([alias, config]) => {
      const enabled = (config as any)?.filter !== false
      const isDefault = !hasDefault && enabled
      if (isDefault) hasDefault = true
      nameItems.push({ name: alias, enabled, isDefault })
    })
    if (!hasDefault && nameItems.length > 0) {
      const firstEnabled = nameItems.find(item => item.enabled)
      if (firstEnabled) firstEnabled.isDefault = true
    }
    return nameItems.sort((a, b) => a.isDefault ? -1 : (b.isDefault ? 1 : a.name.localeCompare(b.name)))
  }

  /**
   * 构建列表视图命令（最小信息）
   * @private
   * @param {any} command - 指令对象
   * @param {any} session - 会话对象
   * @returns {Command} 列表视图的指令信息
   * @description 构建用于列表显示的精简指令信息，只包含基本属性，不加载详细的选项和子命令
   */
  private buildListCommand(command: any, session: any): Command {
    const nameItems = this.getNameItems(command)
    const desc = session?.text?.([`commands.${command.name}.description`, '']) || ''
    const subCount = command.children?.filter((sub: any) => sub?.ctx?.filter?.(session) && !session?.resolve?.(sub.config?.hidden)).length || 0
    return {
      group: session?.resolve?.(command.config?.group) || '其它',
      name: nameItems, hidden: session?.resolve?.(command.config?.hidden) || false,
      authority: command.config?.authority || 0, desc: this.cleanText(desc),
      usage: '', examples: '', options: [], subs: subCount > 0 ? [] : undefined
    }
  }

  /**
   * 构建详情视图命令（完整信息）
   * @private
   * @param {any} command - 指令对象
   * @param {any} session - 会话对象
   * @param {boolean} showHidden - 是否显示隐藏内容
   * @returns {Command} 详情视图的指令信息
   * @description 构建包含完整信息的指令对象，包括所有选项和子命令详细数据
   */
  private buildDetailCommand(command: any, session: any, showHidden: boolean): Command {
    const nameItems = this.getNameItems(command)
    const desc = session?.text?.([`commands.${command.name}.description`, '']) || ''
    const usage = session?.text?.([`commands.${command.name}.usage`, '']) || command?._usage || ''
    const examples = this.getExamples(command, session)
    const options = this.buildOptions(command._options, session, showHidden, command.name)
    const subs = this.buildSubCommands(command.children, session, showHidden)
    return {
      group: session?.resolve?.(command.config?.group) || '其它',
      name: nameItems, authority: command.config?.authority || 0,
      hidden: session?.resolve?.(command.config?.hidden) || false,
      desc: this.cleanText(desc), usage: this.cleanText(usage),
      examples: this.cleanText(examples), options,
      subs: subs.length > 0 ? subs : undefined
    }
  }

  /**
   * 获取示例文本
   * @private
   * @param {any} command - 指令对象
   * @param {any} session - 会话对象
   * @returns {string} 示例文本
   * @description 从指令配置或国际化文本中获取使用示例
   */
  private getExamples(command: any, session: any): string {
    if (command?._examples?.length) return command._examples.join('\n\n')
    const examples = session?.text?.([`commands.${command.name}.examples`, '']) || ''
    return typeof examples === 'string' ? examples : ''
  }

  /**
   * 构建选项列表
   * @private
   * @param {any} options - 选项配置对象
   * @param {any} session - 会话对象
   * @param {boolean} showHidden - 是否显示隐藏选项
   * @param {string} cmdName - 指令名称
   * @returns {Option[]} 选项列表
   * @description 根据权限和隐藏设置过滤并构建指令选项列表
   */
  private buildOptions(options: any, session: any, showHidden: boolean, cmdName: string): Option[] {
    if (!options) return []
    const userAuth = session.user?.authority || 0
    return Object.entries(options)
      .filter(([, option]: [string, any]) => {
        const isHidden = session?.resolve?.(option?.hidden) || false
        return userAuth >= (option?.authority || 0) && (showHidden || !isHidden)
      })
      .map(([key, option]: [string, any]) => ({
        name: option?.name || key, syntax: option?.syntax || '', authority: option?.authority || 0,
        desc: this.cleanText(session?.text?.([`commands.${cmdName}.options.${key}`, '']) || ''),
        hidden: session?.resolve?.(option?.hidden) || false
      }))
  }

  /**
   * 构建子命令列表
   * @private
   * @param {any[]} children - 子命令数组
   * @param {any} session - 会话对象
   * @param {boolean} showHidden - 是否显示隐藏子命令
   * @returns {Command[]} 子命令列表
   * @description 根据权限和隐藏设置过滤并构建子命令的基本信息
   */
  private buildSubCommands(children: any[], session: any, showHidden: boolean): Command[] {
    if (!children) return []
    return children
      .filter(sub => sub?.ctx?.filter?.(session) && (showHidden || !session?.resolve?.(sub.config?.hidden)))
      .map(sub => ({
        group: session?.resolve?.(sub.config?.group) || '其它',  name: this.getNameItems(sub),
        hidden: session?.resolve?.(sub.config?.hidden) || false, authority: sub.config?.authority || 0,
        desc: this.cleanText(session?.text?.([`commands.${sub.name}.description`, '']) || ''),
        usage: '', examples: '', options: [], subs: undefined
      }))
  }

  /**
   * 清理文本内容
   * @private
   * @param {any} data - 原始数据
   * @returns {string} 清理后的文本
   * @description 将各种格式的数据转换为纯文本字符串，处理数组和对象结构
   */
  private cleanText(data: any): string {
    if (typeof data === 'string') return data
    if (Array.isArray(data)) {
      return data.map(item => typeof item === 'string' ? item : item?.attrs?.content || '')
        .filter(Boolean).join(' ').trim()
    }
    return ''
  }
}
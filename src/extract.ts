import { Context } from 'koishi'

/**
 * 指令选项接口
 */
interface Option {
  name: string
  desc: string
  syntax: string
  hidden: boolean
  authority: number
}

/**
 * 指令名称项接口
 */
interface NameItem {
  name: string
  enabled: boolean
  isDefault?: boolean
}

/**
 * 指令接口
 */
export interface Command {
  group: string
  name: NameItem[]
  hidden: boolean
  authority: number
  desc: string
  usage: string
  examples: string
  options: Option[]
  subs?: Command[]
}

/**
 * 指令提取器
 * @description 负责从Koishi上下文中提取和处理指令信息
 */
export class Extract {
  constructor(private readonly ctx: Context) {}

  /**
   * 获取会话语言代码
   * @param session 会话对象
   * @returns 语言代码
   */
  locale(session: any): string {
    const locales = [...(session?.locales || []), ...(session?.channel?.locales || []), ...(session?.guild?.locales || []), ...(session?.user?.locales || [])]
    return this.ctx.i18n?.fallback(locales)?.[0] || 'zh-CN'
  }

  /**
   * 获取所有可用指令
   * @param session 会话对象
   * @param locale 语言代码
   * @returns 指令列表
   */
  async all(session: any, locale = ''): Promise<Command[]> {
    if (!this.ctx.$commander) return []
    this.setLocale(session, locale)
    const userAuth = session.user?.authority || 0
    const commandList = this.ctx.$commander._commandList?.filter(cmd =>
      !cmd?.parent && cmd?.ctx?.filter?.(session) && userAuth >= this.getAuthority(cmd)) || []
    const commands = (await Promise.all(commandList.map(cmd => this.build(cmd, session, userAuth)))).filter(Boolean)
    return commands.sort((a, b) => a.name[0].name.localeCompare(b.name[0].name))
  }

  /**
   * 获取单个指令信息
   * @param session 会话对象
   * @param cmdName 指令名称
   * @param locale 语言代码
   * @returns 指令对象或null
   */
  async single(session: any, cmdName: string, locale = ''): Promise<Command | null> {
    if (!cmdName) return null
    this.setLocale(session, locale)
    const command = this.find(cmdName, session)
    return command && !Array.isArray(command) ? this.build(command, session, session.user?.authority || 0) : null
  }

  /**
   * 获取相关指令列表
   * @param session 会话对象
   * @param cmdName 指令名称
   * @param locale 语言代码
   * @returns 相关指令列表
   */
  async related(session: any, cmdName: string, locale = ''): Promise<Command[]> {
    const target = await this.single(session, cmdName, locale)
    if (!target) return []
    const commands = [target]
    if (cmdName.includes('.')) {
      const parent = await this.single(session, cmdName.split('.')[0], locale)
      if (parent && !commands.some(cmd => cmd.name[0].name === parent.name[0].name)) commands.unshift(parent)
    }
    return commands
  }

  /**
   * 过滤指令列表
   * @param commands 指令列表
   * @param showHidden 是否显示隐藏项
   * @param isDetailView 是否为详情视图
   * @returns 过滤后的指令列表
   */
  filter(commands: Command[], showHidden = false, isDetailView = false): Command[] {
    return commands.map(cmd => ({
      ...cmd,
      options: cmd.options.filter(opt => showHidden || !opt.hidden),
      subs: cmd.subs?.filter(sub => showHidden || !sub.hidden)
    })).filter(cmd => isDetailView || showHidden || !cmd.hidden)
  }

  /**
   * 设置会话语言
   * @param session 会话对象
   * @param locale 语言代码
   */
  private setLocale(session: any, locale: string): void {
    if (locale) session.locales = [locale, ...(session?.locales || [])]
  }

  /**
   * 查找指令
   * @param target 目标指令名
   * @param session 会话对象
   * @returns 指令对象或快捷方式列表
   */
  private find(target: string, session: any) {
    if (!target || !this.ctx.$commander) return null
    const command = this.ctx.$commander.resolve(target, session)
    if (command?.ctx?.filter?.(session)) {
      const { aliases } = this.getEffectiveData(command)
      return aliases[target]?.filter !== false ? command : null
    }
    const shortcuts = this.ctx.i18n?.find?.('commands.(name).shortcuts.(variant)', target)
      ?.map(item => ({ ...item, command: this.ctx.$commander?.resolve(item?.data?.name, session) }))
      ?.filter(item => item?.command?.match?.(session)) || []
    const perfect = shortcuts.filter(item => item?.similarity === 1)
    return perfect.length ? perfect[0]?.command : (shortcuts.length ? shortcuts : null)
  }

  /**
   * 处理指令名称配置
   * @param command 指令对象
   * @returns 名称配置数组
   */
  private processNameConfig(command: any): NameItem[] {
    if (!command) return []
    const { aliases } = this.getEffectiveData(command)
    const aliasEntries = Object.entries(aliases || {})
    if (!aliasEntries.length) return [{ name: command.name || '', enabled: true, isDefault: true }]
    const nameItems: NameItem[] = []
    let hasDefault = false
    // 处理所有别名
    aliasEntries.forEach(([alias, config]) => {
      const enabled = (config as any)?.filter !== false
      const isDefault = !hasDefault && enabled
      if (isDefault) hasDefault = true
      nameItems.push({ name: alias, enabled, isDefault })
    })
    return nameItems.sort((a, b) => {
      if (a.isDefault) return -1
      if (b.isDefault) return 1
      return a.name.localeCompare(b.name)
    })
  }

  /**
   * 获取有效数据
   * @param command 指令对象
   * @returns 有效的配置数据
   */
  private getEffectiveData(command: any) {
    if (!command) return { config: {}, options: {}, aliases: {}, texts: null }
    const snapshot = this.ctx.get('commands')?.snapshots?.[command.name]
    if (!snapshot) {
      return {
        config: command.config || {}, options: command._options || {},
        aliases: command._aliases || {}, texts: null
      }
    }
    const mergedOptions = { ...snapshot.initial.options }
    Object.entries(snapshot.override.options || {}).forEach(([key, override]) => {
      mergedOptions[key] = override && typeof override === 'object'
        ? { ...mergedOptions[key], ...(override as Record<string, any>) }
        : override
    })
    return {
      config: { ...(snapshot.initial.config || {}), ...(snapshot.override.config || {}) },
      options: mergedOptions, aliases: snapshot.override.aliases || command._aliases || {},
      texts: snapshot.override.texts || null
    }
  }

  /**
   * 获取指令权限等级
   * @param command 指令对象
   * @returns 权限等级
   */
  private getAuthority(command: any): number {
    return this.getEffectiveData(command).config?.authority || command.config?.authority || 0
  }

  /**
   * 获取有效文本内容
   * @param texts 文本配置
   * @param path 文本路径
   * @param session 会话对象
   * @param fallback 回退函数
   * @returns 文本内容
   */
  private getEffectiveText(texts: any, path: string, session: any, fallback: () => string): string {
    if (!texts?.[path]) return fallback()
    const overrideText = texts[path]
    if (typeof overrideText === 'string') return overrideText
    if (typeof overrideText === 'object' && overrideText) {
      const locale = session.locales?.[0] || 'zh-CN'
      return overrideText[locale] || overrideText['zh-CN'] || overrideText['en-US'] ||
             Object.values(overrideText).find(v => typeof v === 'string') || fallback()
    }
    return fallback()
  }

  /**
   * 构建指令对象
   * @param command 原始指令对象
   * @param session 会话对象
   * @param userAuth 用户权限
   * @returns 构建的指令对象或null
   */
  private async build(command: any, session: any, userAuth: number): Promise<Command | null> {
    if (!command) return null
    const { config, options, texts } = this.getEffectiveData(command)
    const cmdAuth = config?.authority || 0
    if (userAuth < cmdAuth) return null
    const getText = (path: string | string[]) => session?.text?.(path) || ''
    const nameConfig = this.processNameConfig(command)
    const [description, usage, examples] = await Promise.all([
      Promise.resolve(this.getEffectiveText(texts, 'description', session,
        () => this.cleanText(getText([`commands.${command.name}.description`, ''])))),
      this.getUsageText(command, session, command.name, texts),
      Promise.resolve(this.getExamplesText(command, getText, command.name))
    ])
    return {
      group: session?.resolve?.(config?.group) || '其它', name: nameConfig, authority: cmdAuth,
      hidden: session?.resolve?.(config?.hidden) || false, desc: description, usage: this.cleanText(usage), examples,
      options: this.buildOptions(options, session, userAuth, getText, command.name, texts),
      subs: await this.buildSubCommands(command, session, userAuth)
    }
  }

  /**
   * 清理文本内容
   * @param data 原始数据
   * @returns 清理后的文本
   */
  private cleanText(data: any): string {
    if (typeof data === 'string') return data
    if (Array.isArray(data)) return data.map(item => typeof item === 'string' ? item : item?.attrs?.content || '').filter(Boolean).join(' ').trim()
    return ''
  }

  /**
   * 获取使用方法文本
   * @param command 指令对象
   * @param session 会话对象
   * @param name 指令名称
   * @param texts 文本配置
   * @returns 使用方法文本
   */
  private async getUsageText(command: any, session: any, name: string, texts?: any): Promise<string> {
    const overrideUsage = this.getEffectiveText(texts, 'usage', session, () => '')
    if (overrideUsage) return overrideUsage
    try {
      return command?._usage
        ? (typeof command._usage === 'string' ? command._usage : await command._usage(session))
        : session?.text?.([`commands.${name}.usage`, '']) || ''
    } catch {
      return session?.text?.([`commands.${name}.usage`, '']) || ''
    }
  }

  /**
   * 获取示例文本
   * @param command 指令对象
   * @param getText 获取文本函数
   * @param name 指令名称
   * @returns 示例文本
   */
  private getExamplesText(command: any, getText: Function, name: string): string {
    return command?._examples?.length
      ? command._examples.join('\n\n')
      : getText([`commands.${name}.examples`, '']).split('\n').filter((line: string) => line.trim()).join('\n\n')
  }

  /**
   * 构建选项列表
   * @param effectiveOptions 有效选项配置
   * @param session 会话对象
   * @param userAuth 用户权限
   * @param getText 获取文本函数
   * @param cmdName 指令名称
   * @param texts 文本配置
   * @returns 选项列表
   */
  private buildOptions(effectiveOptions: any, session: any, userAuth: number, getText: Function, cmdName: string, texts?: any): Option[] {
    if (!effectiveOptions || typeof effectiveOptions !== 'object') return []
    const options: Option[] = []
    const seenOptions = new Set<string>()
    const addOption = (option: any, name: string) => {
      if (!option || !name || userAuth < (option?.authority || 0) || seenOptions.has(name)) return
      const desc = this.getEffectiveText(texts?.options, name, session, () => getText(option?.descPath ?? [`commands.${cmdName}.options.${name}`, '']))
      if (desc || option?.syntax) {
        seenOptions.add(name)
        options.push({
          name, desc: desc || '', syntax: option?.syntax || '',
          hidden: session?.resolve?.(option?.hidden) || false,
          authority: option?.authority || 0
        })
      }
    }
    Object.entries(effectiveOptions).forEach(([key, opt]: [string, any]) => {
      if (!opt) return
      if (!('value' in opt)) addOption(opt, opt?.name || key)
      if (opt?.variants) Object.keys(opt.variants).forEach(variantKey => {
        addOption(opt.variants[variantKey], `${opt?.name || key}.${variantKey}`)
      })
    })
    return options
  }

  /**
   * 构建子指令列表
   * @param command 指令对象
   * @param session 会话对象
   * @param userAuth 用户权限
   * @returns 子指令列表或undefined
   */
  private async buildSubCommands(command: any, session: any, userAuth: number): Promise<Command[] | undefined> {
    if (!command?.children?.length) return undefined
    try {
      const uniqueChildren = command.children.filter((sub: any, index: number, arr: any[]) =>
        sub?.name && arr.findIndex((s: any) => s?.name === sub.name) === index
      )
      const subs = (await Promise.all(
        uniqueChildren
          .filter((sub: any) => sub?.ctx?.filter?.(session) && userAuth >= this.getAuthority(sub))
          .map((sub: any) => this.build(sub, session, userAuth))
      )).filter(Boolean)
      return subs.length ? subs : undefined
    } catch {
      return undefined
    }
  }
}
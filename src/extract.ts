import { Context } from 'koishi'

/**
 * 指令选项接口
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
 * 别名配置接口
 */
interface AliasConfig {
  /** 别名名称 */
  name: string
  /** 是否启用 */
  enabled: boolean
  /** 是否为默认名称 */
  isDefault?: boolean
}

/**
 * 指令接口
 */
export interface Command {
  /** 指令组名 */
  group: string
  /** 指令名称（当前显示的默认名称） */
  name: string
  /** 别名列表（包含启用状态） */
  aliases: AliasConfig[]
  /** 是否隐藏 */
  hidden: boolean
  /** 权限等级 */
  authority: number
  /** 指令描述 */
  desc: string
  /** 使用方法 */
  usage: string
  /** 使用示例 */
  examples: string
  /** 选项列表 */
  options: Option[]
  /** 子指令列表 */
  subs?: Command[]
}

/**
 * 指令提取器
 *
 * 负责从Koishi上下文中提取和构建指令信息，支持commands插件的所有修改功能
 */
export class Extract {
  constructor(private readonly ctx: Context) {}

  /**
   * 获取会话的语言环境
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
   * 获取所有可用的指令
   */
  async all(session: any, locale = ''): Promise<Command[]> {
    this.setLocale(session, locale)
    const userAuth = session.user?.authority || 0

    const commands = await Promise.all(
      (this.ctx.$commander?._commandList || [])
        .filter(cmd => !cmd?.parent && cmd?.ctx?.filter(session) && userAuth >= this.getAuthority(cmd))
        .map(cmd => this.build(cmd, session, userAuth))
    )

    return commands.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * 获取单个指令信息
   */
  async single(session: any, cmdName: string, locale = ''): Promise<Command | null> {
    this.setLocale(session, locale)
    const command = this.find(cmdName, session)
    return command && !Array.isArray(command) ? this.build(command, session, session.user?.authority || 0) : null
  }

  /**
   * 获取相关指令（包括目标指令和其父指令）
   */
  async related(session: any, cmdName: string, locale = ''): Promise<Command[]> {
    const target = await this.single(session, cmdName, locale)
    if (!target) return []

    const commands = [target]
    if (cmdName.includes('.')) {
      const parent = await this.single(session, cmdName.split('.')[0], locale)
      if (parent && !commands.some(cmd => cmd.name === parent.name)) {
        commands.unshift(parent)
      }
    }
    return commands
  }

  /**
   * 过滤指令列表（隐藏项、权限等）
   */
  filter(commands: Command[], session: any, showHidden = false, isDetailView = false): Command[] {
    return commands.map(cmd => ({
      ...cmd,
      options: cmd.options.filter(opt => showHidden || !opt.hidden),
      subs: cmd.subs?.filter(sub => showHidden || !sub.hidden)
    })).filter(cmd => isDetailView || showHidden || !cmd.hidden)
  }

  private setLocale(session: any, locale: string): void {
    if (locale) session.locales = [locale, ...(session?.locales || [])]
  }

  private find(target: string, session: any) {
    const command = this.ctx.$commander?.resolve(target, session)
    if (command?.ctx?.filter(session)) {
      const { aliases } = this.getEffectiveData(command)
      return aliases[target]?.filter !== false ? command : null
    }

    const shortcuts = this.ctx.i18n?.find?.('commands.(name).shortcuts.(variant)', target)
      ?.map(item => ({ ...item, command: this.ctx.$commander?.resolve(item?.data?.name, session) }))
      ?.filter(item => item?.command?.match(session)) || []

    const perfect = shortcuts.filter(item => item?.similarity === 1)
    return perfect.length ? perfect[0]?.command : (shortcuts.length ? shortcuts : null)
  }

  /**
   * 处理别名配置，返回结构化的别名信息
   */
  private processAliases(command: any): { name: string; aliases: AliasConfig[] } {
    const { aliases } = this.getEffectiveData(command)
    const aliasKeys = Object.keys(aliases)
    const defaultAlias = aliasKeys[0] || command.name

    const aliasConfigs = aliasKeys.map((aliasName, index) => ({
      name: aliasName,
      enabled: (aliases[aliasName] || {}).filter !== false,
      isDefault: index === 0
    }))

    // 按默认名称优先、启用状态、字母顺序排序
    aliasConfigs.sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    return { name: defaultAlias, aliases: aliasConfigs }
  }

  private getEffectiveData(command: any) {
    const snapshot = this.ctx.get('commands')?.snapshots?.[command.name]
    if (!snapshot) {
      return {
        config: command.config || {},
        options: command._options || {},
        aliases: command._aliases || {},
        texts: null
      }
    }

    const mergedOptions = { ...snapshot.initial.options }
    Object.entries(snapshot.override.options || {}).forEach(([key, override]) => {
      if (override && typeof override === 'object') {
        mergedOptions[key] = { ...mergedOptions[key], ...(override as Record<string, any>) }
      } else {
        mergedOptions[key] = override
      }
    })

    return {
      config: { ...(snapshot.initial.config || {}), ...(snapshot.override.config || {}) },
      options: mergedOptions,
      aliases: snapshot.override.aliases || command._aliases || {},
      texts: snapshot.override.texts || null
    }
  }

  private getAuthority(command: any): number {
    return this.getEffectiveData(command).config?.authority || 0
  }

  private getEffectiveText(texts: any, path: string, session: any, fallback: () => string): string {
    if (!texts?.[path]) return fallback()

    const overrideText = texts[path]
    if (typeof overrideText === 'string') return overrideText

    if (typeof overrideText === 'object') {
      const locale = session.locales?.[0] || 'zh-CN'
      return overrideText[locale] || overrideText['zh-CN'] ||
             overrideText['en-US'] || Object.values(overrideText)[0] || fallback()
    }

    return fallback()
  }

  /**
   * 构建指令对象
   */
  private async build(command: any, session: any, userAuth: number): Promise<Command | null> {
    const { config, options, texts } = this.getEffectiveData(command)
    const cmdAuth = config?.authority || 0
    if (userAuth < cmdAuth) return null

    const getText = (path: string | string[]) => session?.text?.(path) || ''
    const { name: displayName, aliases } = this.processAliases(command)

    const getTextWithOverride = (textPath: string, fallbackFn: () => string) =>
      this.getEffectiveText(texts, textPath, session, fallbackFn)

    const [description, usage, examples] = await Promise.all([
      getTextWithOverride('description',
        () => this.cleanText(getText([`commands.${command.name}.description`, '']))),
      getTextWithOverride('usage',
        () => this.getUsageText(command, session, command.name)),
      getTextWithOverride('examples',
        () => this.getExamplesText(command, getText, command.name))
    ])

    return {
      group: session?.resolve(config?.group) || '其它',
      name: displayName,
      aliases,
      authority: cmdAuth,
      hidden: session?.resolve(config?.hidden) || false,
      desc: description,
      usage: usage ? this.cleanText(usage) : this.cleanText(await this.getUsage(command, session, command.name)),
      examples,
      options: this.buildOptions(options, session, userAuth, getText, command.name, texts),
      subs: await this.buildSubCommands(command, session, userAuth)
    }
  }

  private cleanText(data: any): string {
    if (typeof data === 'string') return data
    if (Array.isArray(data)) {
      return data.map(item => typeof item === 'string' ? item : item?.attrs?.content || '')
        .filter(Boolean).join(' ').trim()
    }
    return ''
  }

  private async getUsage(command: any, session: any, name: string): Promise<string> {
    return command?._usage
      ? (typeof command._usage === 'string' ? command._usage : await command._usage(session))
      : session?.text?.([`commands.${name}.usage`, '']) || ''
  }

  private getUsageText(command: any, session: any, name: string): string {
    if (command?._usage && typeof command._usage === 'string') return command._usage
    return session?.text?.([`commands.${name}.usage`, '']) || ''
  }

  private getExamplesText(command: any, getText: Function, name: string): string {
    return command?._examples?.length
      ? command._examples.join('\n\n')
      : getText([`commands.${name}.examples`, '']).split('\n').filter((line: string) => line.trim()).join('\n\n')
  }

  /**
   * 构建指令选项列表
   */
  private buildOptions(effectiveOptions: any, session: any, userAuth: number, getText: Function, cmdName: string, texts?: any): Option[] {
    const options: Option[] = []
    const seenOptions = new Set<string>()

    const addOption = (option: any, name: string) => {
      if (!option || userAuth < (option?.authority || 0) || seenOptions.has(name)) return

      const desc = this.getEffectiveText(
        texts?.options, name, session,
        () => getText(option?.descPath ?? [`commands.${cmdName}.options.${name}`, ''])
      )

      if (desc || option?.syntax) {
        seenOptions.add(name)
        options.push({
          name,
          desc: desc || '',
          syntax: option?.syntax || '',
          hidden: session?.resolve(option?.hidden) || false,
          authority: option?.authority || 0
        })
      }
    }

    Object.values(effectiveOptions || {}).forEach((opt: any) => {
      if (!opt) return

      if (!('value' in opt)) addOption(opt, opt?.name)

      if (opt?.variants && typeof opt.variants === 'object') {
        Object.keys(opt.variants).forEach(key => {
          addOption(opt.variants[key], `${opt?.name}.${key}`)
        })
      }
    })

    return options
  }

  /**
   * 构建子指令列表
   */
  private async buildSubCommands(command: any, session: any, userAuth: number): Promise<Command[] | undefined> {
    if (!command?.children?.length) return undefined

    const uniqueChildren = command.children.filter((sub: any, index: number, arr: any[]) =>
      arr.findIndex((s: any) => s.name === sub.name) === index
    )

    const subs = (await Promise.all(
      uniqueChildren
        .filter((sub: any) => sub?.ctx?.filter(session) && userAuth >= this.getAuthority(sub))
        .map((sub: any) => this.build(sub, session, userAuth))
    )).filter(Boolean)

    return subs.length ? subs : undefined
  }
}

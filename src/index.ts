import { Context, Schema, Logger, Element, h } from 'koishi'
import { StyleManager, Theme } from './style-manager'
import { CommandExtractor, CommandData, CategoryData } from './command-extractor'
import { ImageRenderer } from './image-renderer'
import { CacheManager } from './cache-manager'

export const name = 'menu'
export const inject = ['puppeteer']
export const logger = new Logger('menu')

// 配置模式定义
export interface Config {
  theme: string
  prerender: boolean
  cacheEnabled: boolean
  refreshInterval: number
}

export const Config: Schema<Config> = Schema.object({
  theme: Schema.string()
    .description('选择主题 (light: 亮色主题, dark: 暗色主题, warm: 温暖主题，或自定义主题名称)')
    .default('light'),
  prerender: Schema.boolean()
    .description('启动时预渲染所有命令图片')
    .default(true),
  cacheEnabled: Schema.boolean()
    .description('启用缓存')
    .default(true),
  refreshInterval: Schema.number()
    .description('缓存刷新间隔(小时), 0表示不自动刷新')
    .default(0)
})

/**
 * 菜单插件主类，负责处理命令渲染和展示
 */
class MenuPlugin {
  private ctx: Context
  private config: Config
  private styleManager: StyleManager
  private commandExtractor: CommandExtractor
  private renderer: ImageRenderer
  private cacheManager: CacheManager
  private categoriesData: Map<string, CategoryData[]> = new Map()
  private refreshTimer: NodeJS.Timeout = null
  private ready: boolean = false
  private defaultLocale: string
  private availableThemes: Theme[] = []

  /**
   * 创建菜单插件实例
   * @param ctx Koishi上下文
   * @param config 插件配置
   */
  constructor(ctx: Context, config: Config) {
    this.ctx = ctx
    this.config = config
    this.defaultLocale = typeof ctx.i18n.locales[0] === 'string' ? ctx.i18n.locales[0] : 'zh-CN'
    logger.info(`使用默认语言: ${this.defaultLocale}`)

    // 初始化组件
    this.styleManager = new StyleManager(ctx.baseDir, config.theme)
    this.commandExtractor = new CommandExtractor(ctx)
    this.cacheManager = new CacheManager(ctx.baseDir, this.defaultLocale, this.styleManager.getThemeId())

    this.registerCommands()
    ctx.on('ready', () => this.initialize().catch(err => logger.error('初始化菜单插件失败:', err)))
  }

  /**
   * 初始化插件组件
   */
  private async initialize() {
    logger.info('初始化菜单插件...')

    await Promise.all([
      this.cacheManager.initialize(),
      this.styleManager.initialize()
    ])

    this.renderer = new ImageRenderer(this.ctx, this.styleManager)
    this.availableThemes = this.styleManager.getAvailableThemes()
    logger.info(`加载了 ${this.availableThemes.length} 个可用主题`)

    this.setupRefreshTimer()

    if (this.config.prerender) {
      await this.prerenderCommands()
    }

    this.ready = true
    logger.info('菜单插件初始化完成')
  }

  /**
   * 设置缓存刷新计时器
   */
  private setupRefreshTimer() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }

    if (this.config.refreshInterval > 0 && this.config.cacheEnabled) {
      const intervalMs = this.config.refreshInterval * 60 * 60 * 1000 // 转换为毫秒
      this.refreshTimer = setInterval(() => {
        logger.info('刷新缓存...')
        this.rerenderCache(this.defaultLocale).catch(err => logger.error('刷新缓存失败:', err))
      }, intervalMs)
      logger.info(`缓存刷新计时器已设置，间隔: ${this.config.refreshInterval} 小时`)
    }
  }

  /**
   * 预渲染命令列表和命令详情
   */
  private async prerenderCommands() {
    logger.info(`开始预渲染默认语言(${this.defaultLocale})的命令...`)

    try {
      // 1. 加载或生成分类数据
      const cachedData = await this.cacheManager.loadCommandsData()
      if (!cachedData) {
        const extractedData = await this.commandExtractor.extractCategories(this.defaultLocale)
        this.categoriesData.set(this.defaultLocale, extractedData)
        if (this.config.cacheEnabled) await this.cacheManager.saveCommandsData(extractedData)
      } else {
        this.categoriesData.set(this.defaultLocale, cachedData)
      }

      // 2. 渲染命令列表
      if (this.config.cacheEnabled && !this.cacheManager.hasCommandListCache()) {
        logger.info('预渲染命令列表')
        const listImage = await this.renderer.renderCommandList(this.categoriesData.get(this.defaultLocale))
        await this.cacheManager.saveImageCache(this.cacheManager.getCommandListPath(), listImage)
      }

      // 3. 渲染各个命令
      if (this.config.cacheEnabled) {
        logger.info('预渲染单个命令...')
        await this.prerenderIndividualCommands(this.defaultLocale)
      }

      logger.info('命令预渲染完成')
      return true
    } catch (error) {
      logger.error('命令预渲染失败', error)
      return false
    }
  }

  /**
   * 预渲染所有单独命令
   * @param locale 语言代码
   */
  private async prerenderIndividualCommands(locale: string) {
    const allCommands = this.commandExtractor.collectAllCommands()
    const total = allCommands.length
    let [processed, cached, rendered, failed] = [0, 0, 0, 0]

    // 为当前语言设置缓存管理器
    this.cacheManager.updateConfig(locale, this.styleManager.getThemeId())

    // 处理每个命令
    for (const commandName of allCommands) {
      processed++

      try {
        // 跳过已缓存的命令
        if (this.cacheManager.hasCommandCache(commandName)) {
          cached++
          continue
        }

        // 提取命令数据并渲染
        const commandData = await this.commandExtractor.getCommandData(commandName, locale)
        if (!commandData) {
          failed++
          continue
        }

        const image = await this.renderer.renderCommandHTML(commandData, { title: `命令: ${commandName}` })
        await this.cacheManager.saveImageCache(this.cacheManager.getCommandImagePath(commandName), image)
        rendered++
      } catch (error) {
        failed++
        logger.debug(`预渲染命令失败: ${commandName}`, error)
      }

      // 记录进度
      if (processed % 10 === 0 || processed === total) {
        logger.info(`命令预渲染进度: ${processed}/${total}, 已缓存: ${cached}, 已渲染: ${rendered}, 失败: ${failed}`)
      }
    }
  }

  /**
   * 重新渲染缓存
   * @param locale 语言代码
   */
  private async rerenderCache(locale: string) {
    logger.info(`重新渲染缓存(语言: ${locale})...`)

    // 更新缓存管理器的语言设置并清除旧缓存
    this.cacheManager.updateConfig(locale, this.styleManager.getThemeId())
    await this.cacheManager.clearAllCache()

    // 重新提取命令数据
    const extractedData = await this.commandExtractor.extractCategories(locale)
    this.categoriesData.set(locale, extractedData)

    if (this.config.cacheEnabled) {
      await this.cacheManager.saveCommandsData(extractedData)
    }

    // 渲染命令列表
    logger.info('重新渲染命令列表')
    const listImage = await this.renderer.renderCommandList(extractedData)
    await this.cacheManager.saveImageCache(this.cacheManager.getCommandListPath(), listImage)

    logger.info('缓存刷新完成')
  }

  /**
   * 注册插件命令
   */
  private registerCommands() {
    // 基本命令：显示命令列表或特定命令
    this.ctx.command('menu [command:string]', '显示命令帮助')
      .userFields(['authority'])
      .option('refresh', '-r 刷新命令缓存')
      .action(async ({ session, options, args }) => {
        if (!this.ready) return '插件正在初始化，请稍后再试...'

        // 获取用户的语言设置
        const userLocale = session.locales?.[0] || this.defaultLocale

        // 处理刷新选项
        if (options.refresh) {
          try {
            logger.info('手动刷新缓存')
            await this.rerenderCache(userLocale)
            return '命令缓存已刷新'
          } catch (err) {
            logger.error('手动刷新缓存失败', err)
            return '刷新缓存时发生错误'
          }
        }

        // 显示命令列表或特定命令
        return await this.handleMenuCommand(session, args[0])
      })

    // 主题列表命令
    this.ctx.command('menu.themes', '列出可用的主题')
      .action(async () => {
        if (!this.ready) return '插件正在初始化，请稍后再试...'

        const themes = this.styleManager.getAvailableThemes()
        const currentTheme = this.styleManager.getThemeId()
        const themeList = themes.map(theme =>
          `${theme.id === currentTheme ? '* ' : '  '}${theme.id} - ${theme.name}`
        ).join('\n')

        return `可用主题列表 (当前使用: ${currentTheme}):\n${themeList}`
      })

    // 管理命令
    this.ctx.command('menu.admin', '管理菜单插件')
      .userFields(['authority'])
      .option('clear', '-c 清除所有缓存')
      .option('theme', '-t <theme> 切换主题 (如 light, dark, warm 等)')
      .action(async ({ session, options }) => {
        if (!this.ready) return '插件正在初始化，请稍后再试...'

        const result = []
        const userLocale = session.locales?.[0] || this.defaultLocale

        try {
          // 处理清除缓存
          if (options.clear) {
            this.cacheManager.updateConfig(userLocale, this.styleManager.getThemeId())
            await this.cacheManager.clearAllCache()
            result.push('已清除所有缓存')
          }

          // 处理主题切换
          if (options.theme) {
            const newTheme = options.theme.toLowerCase()

            if (this.availableThemes.some(theme => theme.id === newTheme)) {
              this.config.theme = newTheme

              if (this.styleManager.updateTheme(newTheme)) {
                this.cacheManager.updateConfig(userLocale, this.styleManager.getThemeId())
                this.renderer.updateStyleManager(this.styleManager)
                result.push(`已切换到"${newTheme}"主题`)
              } else {
                result.push(`切换主题失败: ${newTheme} 不是有效的主题`)
              }
            } else {
              const availableThemes = this.availableThemes.map(t => t.id).join(', ')
              result.push(`无效的主题，可用主题: ${availableThemes}`)
            }
          }

          // 如果有改变配置，重新预渲染
          if (options.theme) {
            await this.prerenderIndividualCommands(userLocale)
          }

          return result.length ? result.join('\n') : '没有执行任何操作'
        } catch (error) {
          logger.error('执行管理命令失败', error)
          return `执行失败: ${error.message || '未知错误'}`
        }
      })
  }

  /**
   * 处理菜单命令
   * @param session 会话对象
   * @param commandName 可选的命令名
   * @returns 命令结果
   */
  private async handleMenuCommand(session, commandName?: string): Promise<Element | string> {
    const userLocale = session.locales?.[0] || this.defaultLocale

    try {
      return commandName
        ? await this.getCommandImage(commandName, userLocale)
        : await this.getCommandListImage(userLocale)
    } catch (error) {
      logger.error('处理菜单命令失败', error)
      return '执行命令时发生错误，请稍后再试'
    }
  }

  /**
   * 获取命令列表图片
   * @param locale 语言代码
   * @returns 图片元素
   */
  private async getCommandListImage(locale: string): Promise<Element> {
    this.cacheManager.updateConfig(locale, this.styleManager.getThemeId())
    let image: Buffer = null

    // 尝试从缓存获取
    if (this.config.cacheEnabled && this.cacheManager.hasCommandListCache()) {
      image = await this.cacheManager.readImageCache(this.cacheManager.getCommandListPath())
    }

    // 缓存不存在或无效，重新渲染
    if (!image) {
      if (!this.categoriesData.has(locale)) {
        const extractedData = await this.commandExtractor.extractCategories(locale)
        this.categoriesData.set(locale, extractedData)
        if (this.config.cacheEnabled) {
          await this.cacheManager.saveCommandsData(extractedData)
        }
      }

      image = await this.renderer.renderCommandList(this.categoriesData.get(locale))

      if (this.config.cacheEnabled) {
        await this.cacheManager.saveImageCache(this.cacheManager.getCommandListPath(), image)
      }
    }

    return h.image(image, 'image/png')
  }

  /**
   * 获取单个命令图片
   * @param commandName 命令名称
   * @param locale 语言代码
   * @returns 图片元素
   */
  private async getCommandImage(commandName: string, locale: string): Promise<Element> {
    this.cacheManager.updateConfig(locale, this.styleManager.getThemeId())
    let image: Buffer = null

    // 尝试从缓存获取
    if (this.config.cacheEnabled && this.cacheManager.hasCommandCache(commandName)) {
      image = await this.cacheManager.readImageCache(this.cacheManager.getCommandImagePath(commandName))
    }

    // 缓存不存在或无效，重新渲染
    if (!image) {
      const commandData = await this.commandExtractor.getCommandData(commandName, locale)
      if (!commandData) {
        throw new Error(`命令 ${commandName} 不存在或无法访问`)
      }

      image = await this.renderer.renderCommandHTML(commandData, { title: `命令: ${commandName}` })

      if (this.config.cacheEnabled) {
        await this.cacheManager.saveImageCache(this.cacheManager.getCommandImagePath(commandName), image)
      }
    }

    return h.image(image, 'image/png')
  }
}

/**
 * 插件应用函数
 * @param ctx Koishi上下文
 * @param config 插件配置
 * @returns 插件实例
 */
export function apply(ctx: Context, config: Config) {
  return new MenuPlugin(ctx, config)
}

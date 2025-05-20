import { Context, Schema, Logger, Element, h } from 'koishi'
import { StyleManager, Theme } from './style-manager'
import { CommandExtractor, CategoryData } from './command-extractor'
import { ImageRenderer } from './image-renderer'
import { CacheManager } from './cache-manager'

export const name = 'menu'
export const inject = ['puppeteer']
export const logger = new Logger('menu')

// 配置模式定义
export interface Config {
  theme: string
  cacheEnabled: boolean
  refreshInterval: number
  customIconsEnabled: boolean  // 新增：是否启用自定义图标
  useGroupsLayout: boolean     // 新增：是否使用分组布局
  pageTitle: string            // 新增：页面标题
}

export const Config: Schema<Config> = Schema.object({
  theme: Schema.string()
    .description('选择主题 (light: 亮色主题, dark: 暗色主题，或自定义主题名称)')
    .default('light'),
  cacheEnabled: Schema.boolean()
    .description('启用缓存')
    .default(true),
  refreshInterval: Schema.number()
    .description('缓存刷新间隔(小时), 0表示不自动刷新')
    .default(0),
  customIconsEnabled: Schema.boolean()
    .description('启用自定义图标')
    .default(true),
  useGroupsLayout: Schema.boolean()
    .description('使用分组布局展示命令')
    .default(true),
  pageTitle: Schema.string()
    .description('页面顶部标题')
    .default('帮助菜单')
})

/**
 * 插件应用函数
 * @param ctx Koishi上下文
 * @param config 插件配置
 */
export function apply(ctx: Context, config: Config) {
  // 内部变量
  const defaultLocale = typeof ctx.i18n.locales[0] === 'string' ? ctx.i18n.locales[0] : 'zh-CN'
  let styleManager: StyleManager
  let commandExtractor: CommandExtractor
  let renderer: ImageRenderer
  let cacheManager: CacheManager
  let categoriesData: Map<string, CategoryData[]> = new Map()
  let refreshTimer: NodeJS.Timeout = null
  let ready: boolean = false
  let availableThemes: Theme[] = []

  // 初始化组件
  styleManager = new StyleManager(ctx.baseDir, config.theme)
  commandExtractor = new CommandExtractor(ctx)
  cacheManager = new CacheManager(ctx.baseDir, defaultLocale, styleManager.getThemeId())

  logger.info(`使用默认语言: ${defaultLocale}`)

  // 注册命令
  registerCommands()

  // 初始化插件
  ctx.on('ready', () => initialize().catch(err => logger.error('初始化菜单插件失败:', err)))

  /**
   * 初始化插件组件
   */
  async function initialize() {
    logger.info('初始化菜单插件...')

    await Promise.all([
      cacheManager.initialize(),
      styleManager.initialize()
    ])

    renderer = new ImageRenderer(ctx, styleManager)
    availableThemes = styleManager.getAvailableThemes()
    logger.info(`加载了 ${availableThemes.length} 个可用主题`)

    setupRefreshTimer()

    // 总是预渲染命令
    await prerenderCommands()

    ready = true
    logger.info('菜单插件初始化完成')
  }

  /**
   * 设置缓存刷新计时器
   */
  function setupRefreshTimer() {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }

    if (config.refreshInterval > 0 && config.cacheEnabled) {
      const intervalMs = config.refreshInterval * 60 * 60 * 1000 // 转换为毫秒
      refreshTimer = setInterval(() => {
        logger.info('刷新缓存...')
        rerenderCache(defaultLocale).catch(err => logger.error('刷新缓存失败:', err))
      }, intervalMs)
      logger.info(`缓存刷新计时器已设置，间隔: ${config.refreshInterval} 小时`)
    }
  }

  /**
   * 预渲染命令列表和命令详情
   */
  async function prerenderCommands() {
    logger.info(`开始预渲染默认语言(${defaultLocale})的命令...`)

    try {
      // 1. 加载或生成分类数据
      const cachedData = await cacheManager.loadCommandsData()
      if (!cachedData) {
        const extractedData = await commandExtractor.extractCategories(defaultLocale)
        categoriesData.set(defaultLocale, extractedData)
        if (config.cacheEnabled) await cacheManager.saveCommandsData(extractedData)
      } else {
        categoriesData.set(defaultLocale, cachedData)
      }

      // 2. 渲染命令列表
      if (config.cacheEnabled && !cacheManager.hasCommandListCache()) {
        logger.info('预渲染命令列表')
        const listImage = await renderer.renderCommandList(categoriesData.get(defaultLocale))
        await cacheManager.saveImageCache(cacheManager.getCommandListPath(), listImage)
      }

      // 3. 渲染各个命令
      if (config.cacheEnabled) {
        logger.info('预渲染单个命令...')
        await prerenderIndividualCommands(defaultLocale)
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
  async function prerenderIndividualCommands(locale: string) {
    const allCommands = commandExtractor.collectAllCommands()
    const total = allCommands.length
    let [processed, cached, rendered, failed] = [0, 0, 0, 0]

    // 为当前语言设置缓存管理器
    cacheManager.updateConfig(locale, styleManager.getThemeId())

    // 处理每个命令
    for (const commandName of allCommands) {
      processed++

      try {
        // 跳过已缓存的命令
        if (cacheManager.hasCommandCache(commandName)) {
          cached++
          continue
        }

        // 提取命令数据并渲染
        const commandData = await commandExtractor.getCommandData(commandName, locale)
        if (!commandData) {
          failed++
          continue
        }

        const image = await renderer.renderCommandHTML(commandData, { title: `命令: ${commandName}` })
        await cacheManager.saveImageCache(cacheManager.getCommandImagePath(commandName), image)
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
  async function rerenderCache(locale: string) {
    logger.info(`重新渲染缓存(语言: ${locale})...`)

    // 更新缓存管理器的语言设置并清除旧缓存
    cacheManager.updateConfig(locale, styleManager.getThemeId())
    await cacheManager.clearAllCache()

    // 重新提取命令数据
    const extractedData = await commandExtractor.extractCategories(locale)
    categoriesData.set(locale, extractedData)

    if (config.cacheEnabled) {
      await cacheManager.saveCommandsData(extractedData)
    }

    // 渲染命令列表
    logger.info('重新渲染命令列表')
    const listImage = await renderer.renderCommandList(categoriesData.get(locale))
    await cacheManager.saveImageCache(cacheManager.getCommandListPath(), listImage)

    logger.info('缓存刷新完成')
  }

  /**
   * 注册插件命令
   */
  function registerCommands() {
    // 基本命令：显示命令列表或特定命令
    ctx.command('menu [command:string]', '显示命令帮助')
      .userFields(['authority'])
      .option('refresh', '-r 刷新命令缓存')
      .action(async ({ session, options, args }) => {
        if (!ready) return '插件正在初始化，请稍后再试...'

        // 获取用户的语言设置
        const userLocale = session.locales?.[0] || defaultLocale

        // 处理刷新选项
        if (options.refresh) {
          try {
            logger.info('手动刷新缓存')
            await rerenderCache(userLocale)
            return '命令缓存已刷新'
          } catch (err) {
            logger.error('手动刷新缓存失败', err)
            return '刷新缓存时发生错误'
          }
        }

        // 显示命令列表或特定命令
        return await handleMenuCommand(session, args[0])
      })
  }

  /**
   * 处理菜单命令
   * @param session 会话对象
   * @param commandName 可选的命令名
   * @returns 命令结果
   */
  async function handleMenuCommand(session, commandName?: string): Promise<Element | string> {
    const userLocale = session.locales?.[0] || defaultLocale

    try {
      return commandName
        ? await getCommandImage(commandName, userLocale)
        : await getCommandListImage(userLocale)
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
  async function getCommandListImage(locale: string): Promise<Element> {
    cacheManager.updateConfig(locale, styleManager.getThemeId())
    let image: Buffer = null

    // 尝试从缓存获取
    if (config.cacheEnabled && cacheManager.hasCommandListCache()) {
      image = await cacheManager.readImageCache(cacheManager.getCommandListPath())
    }

    // 缓存不存在或无效，重新渲染
    if (!image) {
      if (!categoriesData.has(locale)) {
        const extractedData = await commandExtractor.extractCategories(locale)
        categoriesData.set(locale, extractedData)
        if (config.cacheEnabled) {
          await cacheManager.saveCommandsData(extractedData)
        }
      }

      // 使用新的渲染配置，支持分组布局和页面标题
      image = await renderer.renderCommandList(categoriesData.get(locale), {
        pageTitle: config.pageTitle,
        showGroups: config.useGroupsLayout
      })

      if (config.cacheEnabled) {
        await cacheManager.saveImageCache(cacheManager.getCommandListPath(), image)
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
  async function getCommandImage(commandName: string, locale: string): Promise<Element> {
    cacheManager.updateConfig(locale, styleManager.getThemeId())
    let image: Buffer = null

    // 尝试从缓存获取
    if (config.cacheEnabled && cacheManager.hasCommandCache(commandName)) {
      image = await cacheManager.readImageCache(cacheManager.getCommandImagePath(commandName))
    }

    // 缓存不存在或无效，重新渲染
    if (!image) {
      const commandData = await commandExtractor.getCommandData(commandName, locale)
      if (!commandData) {
        throw new Error(`命令 ${commandName} 不存在或无法访问`)
      }

      image = await renderer.renderCommandHTML(commandData, { title: `命令: ${commandName}` })

      if (config.cacheEnabled) {
        await cacheManager.saveImageCache(cacheManager.getCommandImagePath(commandName), image)
      }
    }

    return h.image(image, 'image/png')
  }
}

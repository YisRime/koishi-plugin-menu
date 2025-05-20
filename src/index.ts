import { Context, Schema, Logger, Element, h } from 'koishi'
import { StyleManager } from './style-manager'
import { CommandExtractor, CommandData, CategoryData } from './command-extractor'
import { ImageRenderer, RenderConfig } from './image-renderer'
import { CacheManager } from './cache-manager'

export const name = 'menu'
export const inject = ['puppeteer']
export const logger = new Logger('menu')

// 配置模式定义
export interface Config {
  locale: string
  darkMode: boolean
  customStyle: boolean
  prerender: boolean
  cacheEnabled: boolean
  refreshInterval: number
}

export const Config: Schema<Config> = Schema.object({
  locale: Schema.string().description('使用的语言代码').default('zh-CN'),
  darkMode: Schema.boolean().description('使用暗色主题').default(false),
  customStyle: Schema.boolean().description('使用自定义样式').default(false),
  prerender: Schema.boolean().description('启动时预渲染所有命令图片').default(true),
  cacheEnabled: Schema.boolean().description('启用缓存').default(true),
  refreshInterval: Schema.number().description('缓存刷新间隔(小时), 0表示不自动刷新').default(0)
})

class MenuPlugin {
  private ctx: Context
  private config: Config
  private styleManager: StyleManager
  private commandExtractor: CommandExtractor
  private renderer: ImageRenderer
  private cacheManager: CacheManager
  private categoriesData: CategoryData[] = null
  private refreshTimer: NodeJS.Timeout = null
  private ready: boolean = false

  constructor(ctx: Context, config: Config) {
    this.ctx = ctx
    this.config = config

    // 初始化各组件
    this.styleManager = new StyleManager(config.darkMode, config.customStyle)
    this.commandExtractor = new CommandExtractor(ctx, config.locale)
    this.renderer = new ImageRenderer(ctx, this.styleManager)
    this.cacheManager = new CacheManager(
      ctx.baseDir,
      config.locale,
      this.styleManager.getThemeIdentifier()
    )

    // 注册命令和初始化
    this.registerCommands()

    // 在应用准备好后进行初始化
    ctx.on('ready', () => this.initialize().catch(err =>
      logger.error('初始化菜单插件失败:', err)
    ))
  }

  private async initialize() {
    logger.info('初始化菜单插件...')

    // 初始化缓存系统
    await this.cacheManager.initialize()

    // 设置刷新计时器
    this.setupRefreshTimer()

    // 预加载和渲染命令
    if (this.config.prerender) {
      await this.prerenderCommands()
    }

    this.ready = true
    logger.info('菜单插件初始化完成')
  }

  private setupRefreshTimer() {
    // 清除旧的定时器
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }

    // 设置新的定时器
    if (this.config.refreshInterval > 0 && this.config.cacheEnabled) {
      const intervalMs = this.config.refreshInterval * 60 * 60 * 1000 // 转换为毫秒
      this.refreshTimer = setInterval(() => {
        logger.info('刷新缓存...')
        this.rerenderCache().catch(err =>
          logger.error('刷新缓存失败:', err)
        )
      }, intervalMs)
      logger.info(`缓存刷新计时器已设置，间隔: ${this.config.refreshInterval} 小时`)
    }
  }

  private async prerenderCommands() {
    logger.info('开始预渲染命令...')

    try {
      // 1. 加载或生成分类数据
      this.categoriesData = await this.cacheManager.loadCommandsData()

      if (!this.categoriesData) {
        this.categoriesData = await this.commandExtractor.extractCategories()
        if (this.config.cacheEnabled) {
          await this.cacheManager.saveCommandsData(this.categoriesData)
        }
      }

      // 2. 渲染命令列表
      if (this.config.cacheEnabled && !this.cacheManager.hasCommandListCache()) {
        logger.info('预渲染命令列表')
        const listImage = await this.renderer.renderCommandList(this.categoriesData)
        await this.cacheManager.saveImageCache(
          this.cacheManager.getCommandListPath(),
          listImage
        )
      }

      // 3. 渲染各个命令
      if (this.config.cacheEnabled) {
        logger.info('预渲染单个命令...')
        await this.prerenderIndividualCommands()
      }

      logger.info('命令预渲染完成')
      return true
    } catch (error) {
      logger.error('命令预渲染失败', error)
      return false
    }
  }

  private async prerenderIndividualCommands() {
    // 收集所有命令
    const allCommands = this.commandExtractor.collectAllCommands()
    const total = allCommands.length
    let processed = 0
    let cached = 0
    let rendered = 0
    let failed = 0

    // 处理每个命令
    for (const commandName of allCommands) {
      processed++

      try {
        // 跳过已缓存的命令
        if (this.cacheManager.hasCommandCache(commandName)) {
          cached++
          continue
        }

        // 提取命令数据
        const commandData = await this.commandExtractor.getCommandData(commandName)
        if (!commandData) {
          failed++
          continue
        }

        // 渲染命令图片
        const image = await this.renderer.renderCommandHTML(commandData, {
          title: `命令: ${commandName}`
        })

        // 保存到缓存
        await this.cacheManager.saveImageCache(
          this.cacheManager.getCommandImagePath(commandName),
          image
        )
        rendered++
      } catch (error) {
        failed++
        logger.debug(`预渲染命令失败: ${commandName}`, error)
      }

      // 每处理10个命令或最后一次处理时记录进度
      if (processed % 10 === 0 || processed === total) {
        logger.info(`命令预渲染进度: ${processed}/${total}, 已缓存: ${cached}, 已渲染: ${rendered}, 失败: ${failed}`)
      }
    }
  }

  private async rerenderCache() {
    logger.info('重新渲染缓存...')

    // 清除旧缓存
    await this.cacheManager.clearAllCache()

    // 重新提取命令数据
    this.categoriesData = await this.commandExtractor.extractCategories()
    if (this.config.cacheEnabled) {
      await this.cacheManager.saveCommandsData(this.categoriesData)
    }

    // 渲染命令列表
    logger.info('重新渲染命令列表')
    const listImage = await this.renderer.renderCommandList(this.categoriesData)
    await this.cacheManager.saveImageCache(
      this.cacheManager.getCommandListPath(),
      listImage
    )

    logger.info('缓存刷新完成')
  }

  private registerCommands() {
    // 基本命令：显示命令列表或特定命令
    this.ctx.command('menu [command:string]', '显示命令帮助')
      .userFields(['authority'])
      .option('refresh', '-r 刷新命令缓存')
      .action(async ({ options, args }) => {
        if (!this.ready) return '插件正在初始化，请稍后再试...'

        // 处理刷新选项
        if (options.refresh) {
          logger.info('手动刷新缓存')
          await this.rerenderCache().catch(err => {
            logger.error('手动刷新缓存失败', err)
            return '刷新缓存时发生错误'
          })
          return '命令缓存已刷新'
        }

        // 显示命令列表或特定命令
        const commandName = args[0]
        return await this.handleMenuCommand(commandName)
      })

    // 管理命令：管理菜单插件
    this.ctx.command('menu.admin', '管理菜单插件')
      .userFields(['authority'])
      .option('clear', '-c 清除所有缓存')
      .option('theme', '-t <theme> 切换主题 (light/dark/custom)')
      .option('locale', '-l <locale> 切换语言')
      .action(async ({ options }) => {
        if (!this.ready) return '插件正在初始化，请稍后再试...'

        const result = []

        try {
          // 处理清除缓存
          if (options.clear) {
            await this.cacheManager.clearAllCache()
            result.push('已清除所有缓存')
          }

          // 处理主题切换
          if (options.theme) {
            const theme = options.theme.toLowerCase()

            if (['light', 'dark', 'custom'].includes(theme)) {
              const darkMode = theme === 'dark'
              const customStyle = theme === 'custom'

              // 更新配置
              this.config.darkMode = darkMode
              this.config.customStyle = customStyle

              // 更新样式和缓存
              this.styleManager.updateStyle(darkMode, customStyle)
              this.cacheManager.updateConfig(this.config.locale, this.styleManager.getThemeIdentifier())

              result.push(`已切换到${theme === 'custom' ? '自定义' : (theme === 'dark' ? '暗色' : '亮色')}主题`)
            } else {
              result.push('无效的主题，可选值: light, dark, custom')
            }
          }

          // 处理语言切换
          if (options.locale) {
            const locale = options.locale

            // 更新配置
            this.config.locale = locale

            // 更新提取器和缓存
            this.commandExtractor.setLocale(locale)
            this.cacheManager.updateConfig(locale, this.styleManager.getThemeIdentifier())

            result.push(`已切换语言为: ${locale}`)
          }

          // 如果有改变配置，重新预渲染
          if (options.theme || options.locale) {
            await this.prerenderCommands()
          }

          return result.length ? result.join('\n') : '没有执行任何操作'
        } catch (error) {
          logger.error('执行管理命令失败', error)
          return `执行失败: ${error.message || '未知错误'}`
        }
      })
  }

  private async handleMenuCommand(commandName?: string): Promise<Element | string> {
    try {
      if (!commandName) {
        // 显示命令列表
        return await this.getCommandListImage()
      } else {
        // 显示特定命令
        return await this.getCommandImage(commandName)
      }
    } catch (error) {
      logger.error('处理菜单命令失败', error)
      return '执行命令时发生错误，请稍后再试'
    }
  }

  private async getCommandListImage(): Promise<Element> {
    let image: Buffer = null

    // 尝试从缓存获取
    if (this.config.cacheEnabled && this.cacheManager.hasCommandListCache()) {
      image = await this.cacheManager.readImageCache(this.cacheManager.getCommandListPath())
    }

    // 如果缓存不存在或者无效，重新渲染
    if (!image) {
      // 确保有分类数据
      if (!this.categoriesData) {
        this.categoriesData = await this.commandExtractor.extractCategories()

        if (this.config.cacheEnabled) {
          await this.cacheManager.saveCommandsData(this.categoriesData)
        }
      }

      // 渲染图片
      image = await this.renderer.renderCommandList(this.categoriesData)

      // 缓存图片
      if (this.config.cacheEnabled) {
        await this.cacheManager.saveImageCache(
          this.cacheManager.getCommandListPath(),
          image
        )
      }
    }

    return h.image(image, 'image/png')
  }

  private async getCommandImage(commandName: string): Promise<Element> {
    let image: Buffer = null

    // 尝试从缓存获取
    if (this.config.cacheEnabled && this.cacheManager.hasCommandCache(commandName)) {
      image = await this.cacheManager.readImageCache(
        this.cacheManager.getCommandImagePath(commandName)
      )
    }

    // 如果缓存不存在或者无效，重新渲染
    if (!image) {
      // 获取命令数据
      const commandData = await this.commandExtractor.getCommandData(commandName)

      if (!commandData) {
        throw new Error(`命令 ${commandName} 不存在或无法访问`)
      }

      // 渲染图片
      image = await this.renderer.renderCommandHTML(commandData, {
        title: `命令: ${commandName}`
      })

      // 缓存图片
      if (this.config.cacheEnabled) {
        await this.cacheManager.saveImageCache(
          this.cacheManager.getCommandImagePath(commandName),
          image
        )
      }
    }

    return h.image(image, 'image/png')
  }
}

export function apply(ctx: Context, config: Config) {
  return new MenuPlugin(ctx, config)
}

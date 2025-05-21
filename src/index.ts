import { Context, Schema, Logger, Element, h } from 'koishi'
import { Style } from './style'
import { Command, CategoryData } from './command'
import { Render } from './render'
import { Cache } from './cache'

export const name = 'menu'
export const inject = ['puppeteer']
export const logger = new Logger('menu')

// 配置模式
export interface Config {
  theme: string
  cacheEnabled: boolean
  refreshInterval: number
  customIconsEnabled: boolean
  useGroupsLayout: boolean
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
    .default(true)
})

/**
 * 插件应用函数
 */
export function apply(ctx: Context, config: Config) {
  // 变量初始化
  const defLocale = typeof ctx.i18n.locales[0] === 'string' ? ctx.i18n.locales[0] : 'zh-CN'
  let style = new Style(ctx.baseDir, config.theme)
  let cmd = new Command(ctx)
  let cache = new Cache(ctx.baseDir, defLocale, style.getThemeId())
  let render: Render
  let catData: Map<string, CategoryData[]> = new Map()
  let timer: NodeJS.Timeout = null
  let ready = false
  let groupsData = null

  // 注册命令
  ctx.command('menu [command:text]', '显示命令帮助')
    .userFields(['authority'])
    .option('refresh', '-r 刷新命令缓存')
    .action(async ({ session, options, args }) => {
      const locale = session.locales?.[0] || defLocale

      if (options.refresh) {
        try {
          await refreshCache(locale)
          return '命令缓存已刷新'
        } catch (err) {
          logger.error('手动刷新失败', err)
          return '刷新缓存失败'
        }
      }

      try {
        return args[0]
          ? await getCmdImg(args[0].trim().replace(/\s+/g, "."), locale) // 将空格替换为点
          : await getListImg(locale)
      } catch (error) {
        logger.error('处理菜单命令失败', error)
        return '执行命令时发生错误，请稍后再试'
      }
    })

  // 初始化插件
  ctx.on('ready', async () => {
    try {
      // 并行初始化
      logger.info('菜单插件开始初始化')
      await Promise.all([cache.initialize(), style.initialize()])
      render = new Render(ctx, style)

      // 设置定时刷新
      if (config.refreshInterval > 0 && config.cacheEnabled) {
        if (timer) clearInterval(timer)
        timer = setInterval(() => {
          refreshCache(defLocale).catch(err => logger.error('刷新缓存失败:', err))
        }, config.refreshInterval * 60 * 60 * 1000)
        logger.info(`已设置缓存刷新间隔: ${config.refreshInterval} 小时`)
      }

      // 加载命令数据
      const cached = await cache.loadCommandsData()
      if (cached) {
        catData.set(defLocale, cached)
      } else {
        const data = await cmd.extractCategories(defLocale)
        catData.set(defLocale, data)
        if (config.cacheEnabled) await cache.saveCommandsData(data)
      }

      // 加载分组配置
      groupsData = await cache.loadGroupsData()

      // 如果没有分组数据或加载失败，创建并保存默认分组
      if (!groupsData) {
        groupsData = {
          groups: [
            {
              name: "所有命令",
              icon: "apps",
              commands: []  // 空数组表示包含所有命令
            }
          ],
          version: 1
        };
        await cache.saveGroupsData(groupsData);
      }

      // 准备缓存
      if (config.cacheEnabled) {
        // 命令列表缓存
        if (!cache.hasCommandListCache()) {
          const img = await render.renderList(catData.get(defLocale), {
            showGroups: config.useGroupsLayout,
            title: "命令列表",
            groupsData: groupsData // 传递分组数据
          })
          await cache.saveImageCache(cache.getCommandListPath(), img)
        }
        // 预渲染命令
        await prerenderCmds(defLocale)
      }

      ready = true
      logger.info('菜单插件初始化完成')
    } catch (err) {
      logger.error('初始化失败:', err)
    }
  })

  /**
   * 预渲染所有命令
   */
  async function prerenderCmds(locale: string) {
    const allCmds = cmd.getAllCmds()
    const total = allCmds.length
    let [count, cached, rendered, failed] = [0, 0, 0, 0]

    cache.updateConfig(locale, style.getThemeId())

    for (const name of allCmds) {
      count++
      try {
        if (cache.hasCommandCache(name)) {
          cached++; continue
        }

        const data = await cmd.getCommandData(name, locale)
        if (!data) {
          failed++; continue
        }

        const img = await render.renderCmd(data, { title: `命令: ${name}` })
        await cache.saveImageCache(cache.getCommandImagePath(name), img)
        rendered++
      } catch (error) {
        failed++
      }

      // 仅在完成时输出日志
      if (count === total) {
        logger.info(`预渲染完成: ${cached}个缓存, ${rendered}个新渲染, ${failed}个失败`)
      }
    }
  }

  /**
   * 刷新缓存
   */
  async function refreshCache(locale: string) {
    cache.updateConfig(locale, style.getThemeId())
    await cache.clearAllCache()

    const data = await cmd.extractCategories(locale)
    catData.set(locale, data)

    if (config.cacheEnabled) await cache.saveCommandsData(data)

    // 重新加载分组数据
    groupsData = await cache.loadGroupsData()

    const img = await render.renderList(catData.get(locale), {
      showGroups: config.useGroupsLayout,
      title: "命令列表",
      groupsData: groupsData
    })
    await cache.saveImageCache(cache.getCommandListPath(), img)
    logger.info(`已刷新缓存(${locale}, ${style.getThemeId()})`)
  }

  /**
   * 获取列表图片
   */
  async function getListImg(locale: string): Promise<Element> {
    cache.updateConfig(locale, style.getThemeId())
    let img: Buffer = null

    // 尝试加载分组数据
    if (!groupsData) {
      groupsData = await cache.loadGroupsData()
    }

    // 尝试从缓存获取
    if (config.cacheEnabled && cache.hasCommandListCache()) {
      img = await cache.readImageCache(cache.getCommandListPath())
    }

    // 重新渲染
    if (!img) {
      if (!catData.has(locale)) {
        const data = await cmd.extractCategories(locale)
        catData.set(locale, data)
        if (config.cacheEnabled) await cache.saveCommandsData(data)
      }

      img = await render.renderList(catData.get(locale), {
        showGroups: config.useGroupsLayout,
        title: "命令列表",
        groupsData: groupsData // 传递分组数据
      })
      if (config.cacheEnabled) await cache.saveImageCache(cache.getCommandListPath(), img)
    }

    return h.image(img, 'image/png')
  }

  /**
   * 获取命令图片
   */
  async function getCmdImg(name: string, locale: string): Promise<Element> {
    cache.updateConfig(locale, style.getThemeId())

    // 尝试从缓存获取
    let img = config.cacheEnabled && cache.hasCommandCache(name)
      ? await cache.readImageCache(cache.getCommandImagePath(name))
      : null

    // 重新渲染
    if (!img) {
      const data = await cmd.getCommandData(name, locale)
      if (!data) throw new Error(`命令 ${name} 不存在或无法访问`)

      img = await render.renderCmd(data, { title: `命令: ${name}` })
      if (config.cacheEnabled) await cache.saveImageCache(cache.getCommandImagePath(name), img)
    }

    return h.image(img, 'image/png')
  }
}

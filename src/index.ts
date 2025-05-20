import { Context, Schema, Service, h, Logger } from 'koishi'
import { resolve } from 'path'
import { promises as fs } from 'fs'
import { renderCommandHelp, renderCommandList } from './renderer'
import { defaultStyle, darkStyle } from './styles'
import { loadCommands, extractCommandInfo } from './loader'

export const name = 'ocr'
export const inject = ['puppeteer']

// 创建logger
const logger = new Logger('ocr')

export interface Config {
  title: string
  description: string
  locale: string
  renderOnStartup: boolean
  cacheTime: number
  darkMode: boolean
  dataDir: string
}

export const Config: Schema<Config> = Schema.object({
  title: Schema.string().description('帮助菜单标题').default('命令帮助'),
  description: Schema.string().description('帮助菜单描述').default(''),
  locale: Schema.string().description('使用的语言代码').default('zh-CN'),
  renderOnStartup: Schema.boolean().description('启动时预渲染帮助').default(true),
  cacheTime: Schema.number().description('帮助缓存有效时间(毫秒)，0表示始终使用缓存').default(3600000), // 默认1小时
  darkMode: Schema.boolean().description('使用暗色主题').default(false),
  dataDir: Schema.string().description('数据存储目录').default('data/ocr')
})

export function apply(ctx: Context, config: Config) {
  // 目录设置
  const baseDir = resolve(ctx.baseDir, config.dataDir)
  const stylesDir = resolve(baseDir, 'styles')
  const imagesDir = resolve(baseDir, 'images')
  const commandsDir = resolve(baseDir, 'commands')

  // 确保目录存在
  async function ensureDirectories() {
    try {
      await fs.mkdir(baseDir, { recursive: true })
      await fs.mkdir(stylesDir, { recursive: true })
      await fs.mkdir(imagesDir, { recursive: true })
      await fs.mkdir(commandsDir, { recursive: true })
      logger.info(`确保目录存在: ${baseDir}`)
    } catch (err) {
      logger.error('创建目录失败', err)
      throw err
    }
  }

  // 保存样式到文件
  async function saveStyles() {
    try {
      const defaultStylePath = resolve(stylesDir, 'default.json')
      const darkStylePath = resolve(stylesDir, 'dark.json')

      await fs.writeFile(defaultStylePath, JSON.stringify(defaultStyle, null, 2))
      await fs.writeFile(darkStylePath, JSON.stringify(darkStyle, null, 2))

      logger.info('样式文件已保存')
    } catch (err) {
      logger.error('保存样式文件失败', err)
    }
  }

  // 保存菜单缓存
  async function saveMenuCache(image: Buffer, type: string, locale: string, timestamp: number) {
    try {
      const filename = resolve(imagesDir, `${type}-${locale}.png`)
      const infoFilename = resolve(imagesDir, `${type}-${locale}.json`)

      await fs.writeFile(filename, image)
      await fs.writeFile(infoFilename, JSON.stringify({ timestamp }))

      logger.info(`菜单图片已保存: ${filename}`)
    } catch (err) {
      logger.error('保存菜单缓存失败', err)
    }
  }

  // 加载菜单缓存
  async function loadMenuCache(type: string, locale: string) {
    try {
      const filename = resolve(imagesDir, `${type}-${locale}.png`)
      const infoFilename = resolve(imagesDir, `${type}-${locale}.json`)

      try {
        await fs.access(filename)
        await fs.access(infoFilename)
      } catch {
        logger.info(`菜单缓存文件不存在: ${filename}`)
        return null
      }

      const image = await fs.readFile(filename)
      const infoData = await fs.readFile(infoFilename, 'utf8')
      const info = JSON.parse(infoData)

      logger.info(`从文件加载菜单缓存: ${filename}`)
      return { image, timestamp: info.timestamp }
    } catch (err) {
      logger.error('读取菜单缓存失败', err)
      return null
    }
  }

  // 保存命令信息
  async function saveCommandInfo(commandsData: any, locale: string) {
    try {
      const filename = resolve(commandsDir, `commands-${locale}.json`)
      await fs.writeFile(filename, JSON.stringify(commandsData, null, 2))
      logger.info(`命令信息已保存: ${filename}`)
    } catch (err) {
      logger.error('保存命令信息失败', err)
    }
  }

  // 加载命令信息
  async function loadCommandInfo(locale: string) {
    try {
      const filename = resolve(commandsDir, `commands-${locale}.json`)
      try {
        await fs.access(filename)
      } catch {
        logger.info(`命令信息文件不存在: ${filename}`)
        return null
      }

      const data = await fs.readFile(filename, 'utf8')
      return JSON.parse(data)
    } catch (err) {
      logger.error('读取命令信息失败', err)
      return null
    }
  }

  // 创建渲染会话
  async function createRenderSession(locale: string) {
    const session = {
      app: ctx.app,
      user: { authority: 4 }, // 使用高权限以查看所有命令
      resolve: (val) => typeof val === 'function' ? val(session) : val,
      text: (path, params) => ctx.i18n.render([locale], Array.isArray(path) ? path : [path], params),
      isDirect: true,
    }
    return session
  }

  // 渲染命令帮助
  async function renderCommandHelpImage(commandName: string, forceRender: boolean = false, localeOverride?: string) {
    const locale = localeOverride || config.locale || 'zh-CN'
    const now = Date.now()

    // 检查缓存
    if (!forceRender) {
      const fileCache = await loadMenuCache(`command-${commandName.replace(/\./g, '-')}`, locale)
      if (fileCache && (config.cacheTime === 0 || now - fileCache.timestamp < config.cacheTime)) {
        logger.info(`使用缓存的命令帮助 (${commandName})`)
        return fileCache.image
      }
    }

    try {
      const session = await createRenderSession(locale)
      const commander = ctx.$commander
      const command = commander.get(commandName)

      if (!command) {
        throw new Error(`命令 ${commandName} 不存在`)
      }

      const commandData = await extractCommandInfo(command, session)
      if (!commandData) {
        throw new Error(`无法获取命令 ${commandName} 的信息`)
      }

      const style = config.darkMode ? darkStyle : defaultStyle

      logger.info(`渲染命令帮助: ${commandName}`)
      const image = await renderCommandHelp(ctx, commandData, {
        title: `命令: ${commandName}`,
        style,
        locale
      })

      await saveMenuCache(image, `command-${commandName.replace(/\./g, '-')}`, locale, now)
      return image
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`渲染命令帮助失败: ${commandName}`, error)
      throw new Error(`渲染命令帮助失败: ${errorMessage}`)
    }
  }

  // 渲染命令列表
  async function renderCommandListImage(forceRender: boolean = false, localeOverride?: string) {
    const locale = localeOverride || config.locale || 'zh-CN'
    const now = Date.now()

    // 检查缓存
    if (!forceRender) {
      const fileCache = await loadMenuCache('command-list', locale)
      if (fileCache && (config.cacheTime === 0 || now - fileCache.timestamp < config.cacheTime)) {
        logger.info(`使用缓存的命令列表`)
        return fileCache.image
      }
    }

    try {
      const session = await createRenderSession(locale)
      const commandsData = await loadCommandInfo(locale) || await loadCommands(ctx, session)

      if (!commandsData) {
        throw new Error('无法加载命令信息')
      }

      const style = config.darkMode ? darkStyle : defaultStyle

      logger.info('渲染命令列表')
      const image = await renderCommandList(ctx, commandsData, {
        title: config.title,
        description: config.description,
        style,
        locale
      })

      await saveMenuCache(image, 'command-list', locale, now)
      return image
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('渲染命令列表失败', error)
      throw new Error(`渲染命令列表失败: ${errorMessage}`)
    }
  }

  // 预渲染命令列表
  async function preRender() {
    if (!config.renderOnStartup) {
      logger.info('预渲染功能已关闭')
      return
    }

    try {
      logger.info('开始预渲染命令列表')
      const session = await createRenderSession(config.locale)
      const commandsData = await loadCommands(ctx, session)

      await saveCommandInfo(commandsData, config.locale)
      await renderCommandListImage(true)

      logger.success('预渲染命令列表完成')
    } catch (error) {
      logger.error('预渲染失败', error)
    }
  }

  // 初始化
  ctx.on('ready', async () => {
    await ensureDirectories()
    await saveStyles()
    await preRender()
  })

  // 注册命令
  ctx.command('ocr', '显示命令帮助')
    .userFields(['authority'])
    .option('locale', '-l <locale:string> 指定语言')
    .option('reload', '-r 强制重新渲染')
    .option('dark', '-d 使用暗黑模式')
    .option('command', '-c <cmd:string> 查看特定命令帮助')
    .action(async ({ options }) => {
      try {
        if (options.dark !== undefined) {
          config.darkMode = options.dark
        }

        if (options.command) {
          logger.info(`查看命令帮助: ${options.command}`)
          const image = await renderCommandHelpImage(options.command, options.reload, options.locale)
          return h.image(image, 'image/png')
        } else {
          logger.info(`查看命令列表${options.reload ? ' (强制刷新)' : ''}`)
          const image = await renderCommandListImage(options.reload, options.locale)
          return h.image(image, 'image/png')
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('命令执行失败', error)
        return `执行失败: ${errorMessage}`
      }
    })
}

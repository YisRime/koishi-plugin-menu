import { Context, Schema, Logger, h } from 'koishi'
import * as crypto from 'crypto'
import { existsSync } from 'fs'
import { promises as fs } from 'fs'
import * as renderer from './render'
import { defaultStyle, darkStyle, customStyle } from './styles'
import { loadCommands, extractCommandInfo } from './loader'
import { CacheManager } from './cache'

export const name = 'menu'
export const inject = ['puppeteer']

// 创建logger
const logger = new Logger('menu')

/**
 * 配置对象
 * @typedef {Object} Config
 * @property {string} title - 帮助菜单标题
 * @property {string} description - 帮助菜单描述
 * @property {string} locale - 使用的语言代码
 * @property {boolean} darkMode - 是否使用暗色主题
 * @property {string} dataDir - 数据存储目录
 * @property {boolean} useCache - 是否使用本地缓存
 * @property {number} cacheExpiry - 缓存过期时间(分钟，0表示永不过期)
 * @property {boolean} prerender - 是否启动时预渲染所有命令图片
 * @property {boolean} customStyle - 是否使用自定义样式
 */
export interface Config {
  title: string
  description: string
  locale: string
  darkMode: boolean
  dataDir: string
  useCache: boolean
  cacheExpiry: number
  prerender: boolean
  customStyle: boolean
}

export const Config: Schema<Config> = Schema.object({
  title: Schema.string().description('帮助菜单标题').default('命令帮助'),
  description: Schema.string().description('帮助菜单描述').default(''),
  locale: Schema.string().description('使用的语言代码').default('zh-CN'),
  darkMode: Schema.boolean().description('使用暗色主题').default(false),
  dataDir: Schema.string().description('数据存储目录').default('data/menu'),
  useCache: Schema.boolean().description('使用本地缓存').default(true),
  cacheExpiry: Schema.number().description('缓存过期时间(分钟，0表示永不过期)').default(60),
  prerender: Schema.boolean().description('启动时预渲染所有命令图片').default(true),
  customStyle: Schema.boolean().description('使用自定义样式(而非暗/亮色主题)').default(false)
})

/**
 * 应用插件
 * @param {Context} ctx - Koishi上下文
 * @param {Config} config - 配置对象
 */
export function apply(ctx: Context, config: Config) {
  // 缓存管理器
  let cacheManager: CacheManager

  /**
   * 获取样式配置
   * @returns {Object} - 样式对象
   */
  function getStyleConfig() {
    if (config.customStyle) return customStyle
    return config.darkMode ? darkStyle : defaultStyle
  }

  /**
   * 创建渲染会话
   * @param {string} locale - 语言代码
   * @returns {Object} - 渲染会话对象
   */
  function createRenderSession(locale: string) {
    const session: any = {
      app: ctx.app,
      user: { authority: 4 }, // 使用高权限以查看所有命令
      text: (path, params) => ctx.i18n.render([locale], Array.isArray(path) ? path : [path], params),
      isDirect: true,
    }
    session.resolve = (val) => typeof val === 'function' ? val(session) : val
    return session
  }

  /**
   * 获取命令列表哈希值
   * @returns {Promise<string>} - 命令列表的哈希值
   */
  async function getCommandsHash() {
    const session = createRenderSession(config.locale)
    const commandsData = await loadCommands(ctx, session)
    const hash = crypto.createHash('md5')
    hash.update(JSON.stringify(commandsData))
    return hash.digest('hex')
  }

  /**
   * 获取命令对象
   * @param {string} commandName - 命令名称
   * @returns {Object|null} - 命令对象
   */
  function getCommand(commandName: string) {
    try {
      // 处理子命令格式 (如 "info.user")
      if (commandName.includes('.')) {
        const parts = commandName.split('.')
        let currentCmd = ctx.$commander.get(parts[0])
        if (!currentCmd) return null

        // 遍历子命令路径
        for (let i = 1; i < parts.length; i++) {
          let found = false
          for (const child of currentCmd.children) {
            if (child.name === parts.slice(0, i+1).join('.')) {
              currentCmd = child
              found = true
              break
            }
          }
          if (!found) return null
        }
        return currentCmd
      } else {
        // 直接获取顶级命令
        return ctx.$commander.get(commandName)
      }
    } catch (error) {
      logger.debug(`查找命令出错: ${commandName}`, error)
      return null
    }
  }

  /**
   * 渲染并缓存单个命令帮助
   * @param {string} commandName - 命令名称
   * @returns {Promise<Buffer>} - 图片缓冲区
   */
  async function renderAndCacheCommandHelp(commandName: string) {
    try {
      const session = createRenderSession(config.locale)
      const command = getCommand(commandName)

      if (!command) {
        throw new Error(`命令 ${commandName} 不存在`)
      }

      const commandData = await extractCommandInfo(command, session)
      if (!commandData) {
        throw new Error(`无法获取命令 ${commandName} 的信息`)
      }

      logger.debug(`渲染命令帮助: ${commandName}`)
      const image = await renderer.renderCommandHelp(ctx, commandData, {
        title: `命令: ${commandName}`,
        style: getStyleConfig()
      })

      // 保存到文件
      const cachePath = cacheManager.getCommandPath(commandName)
      await fs.writeFile(cachePath, image)
      return image
    } catch (error) {
      logger.error(`渲染命令帮助失败: ${commandName}`, error)
      throw new Error(`渲染失败: ${error.message || String(error)}`)
    }
  }

  /**
   * 渲染并缓存命令列表
   * @returns {Promise<Buffer>} - 图片缓冲区
   */
  async function renderAndCacheCommandList() {
    try {
      const session = createRenderSession(config.locale)
      const commandsData = await loadCommands(ctx, session)

      logger.info('渲染命令列表')
      const image = await renderer.renderCommandList(ctx, commandsData, {
        title: config.title,
        description: config.description,
        style: getStyleConfig()
      })

      // 保存命令数据到JSON文件
      await cacheManager.saveCommandsData(commandsData)

      // 保存图片到文件
      await fs.writeFile(cacheManager.getCommandListPath(), image)
      return image
    } catch (error) {
      logger.error('渲染命令列表失败', error)
      throw new Error(`渲染失败: ${error.message || String(error)}`)
    }
  }

  /**
   * 获取命令图片(带缓存)
   * @param {string} commandName - 命令名称
   * @returns {Promise<Buffer>} - 图片缓冲区
   */
  async function getCommandImage(commandName: string) {
    const cachePath = cacheManager.getCommandPath(commandName)

    if (config.useCache && existsSync(cachePath) && cacheManager.isCacheValid(config.cacheExpiry)) {
      logger.debug(`使用缓存命令帮助: ${commandName}`)
      return await fs.readFile(cachePath)
    }

    return await renderAndCacheCommandHelp(commandName)
  }

  /**
   * 获取命令列表图片(带缓存)
   * @returns {Promise<Buffer>} - 图片缓冲区
   */
  async function getCommandListImage() {
    const cachePath = cacheManager.getCommandListPath()

    if (config.useCache && existsSync(cachePath) && cacheManager.isCacheValid(config.cacheExpiry)) {
      logger.debug(`使用缓存命令列表`)
      return await fs.readFile(cachePath)
    }

    return await renderAndCacheCommandList()
  }

  /**
   * 预渲染所有命令
   */
  async function prerenderAllCommands() {
    if (!config.prerender) return

    logger.info('开始预渲染所有命令图片')
    try {
      // 先渲染命令列表
      await renderAndCacheCommandList()

      // 获取所有命令
      const allCommands = ctx.$commander._commandList.map(cmd => cmd.name)
      // 记录成功和失败的命令数
      let succeeded = 0
      let failed = 0

      // 使用较低优先级的循环处理所有命令，避免阻塞
      for (const cmdName of allCommands) {
        logger.debug(`预渲染命令: ${cmdName}`)
        try {
          await renderAndCacheCommandHelp(cmdName)
          succeeded++
        } catch (e) {
          failed++
          logger.warn(`预渲染命令 ${cmdName} 失败: ${e.message}`)
          // 继续下一个命令
        }
      }

      // 处理子命令 - 由于会有重复，只尝试没有缓存的命令
      const processedCommands = new Set(allCommands)
      const childCommands = []

      // 收集所有子命令
      ctx.$commander._commandList.forEach(cmd => {
        function collectChildren(command, parentPath = '') {
          const fullPath = parentPath ? `${parentPath}.${command.name}` : command.name
          command.children.forEach(child => {
            const childPath = child.name
            if (!processedCommands.has(childPath)) {
              childCommands.push(childPath)
              processedCommands.add(childPath)
            }
            collectChildren(child, childPath)
          })
        }
        collectChildren(cmd)
      })

      // 处理子命令
      for (const cmdName of childCommands) {
        logger.debug(`预渲染子命令: ${cmdName}`)
        try {
          await renderAndCacheCommandHelp(cmdName)
          succeeded++
        } catch (e) {
          failed++
          // 对于子命令，降低日志级别避免大量警告
          logger.debug(`预渲染子命令 ${cmdName} 失败: ${e.message}`)
        }
      }

      logger.info(`预渲染完成，成功: ${succeeded} 个命令，失败: ${failed} 个命令`)
    } catch (error) {
      logger.error('预渲染命令图片失败', error)
    }
  }

  // 初始化
  ctx.on('ready', async () => {
    // 初始化缓存管理器
    cacheManager = new CacheManager(ctx.baseDir, config.locale, config.darkMode)

    // 确保目录存在
    await cacheManager.ensureDirectories()
    await cacheManager.loadMetadata()

    // 检查命令哈希是否变化
    const commandHash = await getCommandsHash()
    const hashChanged = commandHash !== cacheManager.getCommandHash()

    if (hashChanged || !cacheManager.isCacheValid(config.cacheExpiry)) {
      logger.info('命令数据已更改或缓存过期，将重新生成缓存')
      cacheManager.updateMetadata(commandHash)
      await cacheManager.saveMetadata()
      await prerenderAllCommands()
    } else if (config.prerender) {
      logger.info('使用现有缓存')
    }
  })

  // 注册命令
  ctx.command('menu', '显示命令帮助')
    .userFields(['authority'])
    .option('locale', '-l <locale:string> 指定语言')
    .option('dark', '-d 使用暗黑模式')
    .option('command', '-c <cmd:string> 查看特定命令帮助')
    .option('refresh', '-r 强制刷新缓存')
    .action(async ({ options }) => {
      try {
        // 临时应用选项
        const originalConfig = {
          darkMode: config.darkMode,
          locale: config.locale,
          useCache: config.useCache
        }

        if (options.dark !== undefined) config.darkMode = options.dark
        if (options.locale) config.locale = options.locale
        if (options.refresh) config.useCache = false

        // 如果更改了主题或语言，重新创建缓存管理器
        if (options.dark !== undefined || options.locale) {
          cacheManager = new CacheManager(ctx.baseDir, config.locale, config.darkMode)
        }

        // 获取图片
        const image = options.command
          ? await getCommandImage(options.command)
          : await getCommandListImage()

        // 恢复原始设置
        Object.assign(config, originalConfig)

        return h.image(image, 'image/png')
      } catch (error) {
        logger.error('命令执行失败', error)
        return `执行失败: ${error.message || String(error)}`
      }
    })
}

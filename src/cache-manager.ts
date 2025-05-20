import { Logger } from 'koishi'
import { promises as fs, existsSync } from 'fs'
import { resolve, join } from 'path'
import { CategoryData, CommandData } from './command-extractor'

const logger = new Logger('menu:cache-manager')

/**
 * 缓存管理类，负责管理和维护命令数据和图片缓存
 */
export class CacheManager {
  private dataDir: string
  private imagesDir: string
  private commandsDataPath: string
  private locale: string
  private themeId: string

  constructor(baseDir: string, locale: string, themeId: string) {
    this.dataDir = resolve(baseDir, 'data/menu')
    this.imagesDir = resolve(this.dataDir, 'images')
    this.commandsDataPath = resolve(this.dataDir, `commands_${locale}.json`)
    this.locale = locale
    this.themeId = themeId
    logger.info(`缓存管理器初始化: 语言=${locale}, 主题=${themeId}`)
  }

  /**
   * 初始化缓存目录
   * @returns {Promise<boolean>} 成功状态
   */
  public async initialize(): Promise<boolean> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true })
      await fs.mkdir(this.imagesDir, { recursive: true })
      logger.info('缓存目录初始化成功')
      return true
    } catch (error) {
      logger.error('初始化缓存目录失败', error)
      return false
    }
  }

  /**
   * 获取命令列表图片路径
   * @returns {string} 图片路径
   */
  public getCommandListPath(): string {
    return join(this.imagesDir, `command_list_${this.locale}_${this.themeId}.png`)
  }

  /**
   * 获取单个命令图片路径
   * @param {string} commandName - 命令名称
   * @returns {string} 图片路径
   */
  public getCommandImagePath(commandName: string): string {
    // 安全处理命令名称，避免文件系统问题
    const safeName = commandName.replace(/[\/\\?%*:|"<>]/g, '_').replace(/\./g, '_')
    return join(this.imagesDir, `cmd_${safeName}_${this.locale}_${this.themeId}.png`)
  }

  /**
   * 保存命令数据
   * @param {CategoryData[]} categoriesData - 分类数据
   * @returns {Promise<boolean>} 成功状态
   */
  public async saveCommandsData(categoriesData: CategoryData[]): Promise<boolean> {
    if (!categoriesData) return false

    try {
      await fs.writeFile(
        this.commandsDataPath,
        JSON.stringify(categoriesData, null, 2),
        'utf8'
      )
      logger.debug('命令数据保存成功')
      return true
    } catch (error) {
      logger.error('保存命令数据失败', error)
      return false
    }
  }

  /**
   * 安全保存文件
   * @param {string} path - 文件路径
   * @param {Buffer|string} data - 数据
   * @returns {Promise<boolean>} 成功状态
   */
  private async safeWriteFile(path: string, data: Buffer|string): Promise<boolean> {
    // 创建临时文件路径
    const tempPath = `${path}.tmp`

    try {
      // 先写入临时文件
      await fs.writeFile(tempPath, data)

      // 如果目标文件已存在，先尝试删除
      if (existsSync(path)) {
        await fs.unlink(path).catch(() => {})
      }

      // 重命名临时文件为目标文件
      await fs.rename(tempPath, path)
      return true
    } catch (error) {
      // 清理临时文件
      if (existsSync(tempPath)) {
        await fs.unlink(tempPath).catch(() => {})
      }
      throw error
    }
  }

  /**
   * 保存图片缓存
   * @param {string} path - 文件路径
   * @param {Buffer} data - 图片数据
   * @returns {Promise<boolean>} 成功状态
   */
  public async saveImageCache(path: string, data: Buffer): Promise<boolean> {
    if (!data || !Buffer.isBuffer(data)) return false

    try {
      await this.safeWriteFile(path, data)
      logger.debug(`图片缓存保存成功: ${path}`)
      return true
    } catch (error) {
      logger.error(`保存图片缓存失败: ${path}`, error)
      return false
    }
  }

  /**
   * 加载命令数据
   * @returns {Promise<CategoryData[]|null>} 分类数据
   */
  public async loadCommandsData(): Promise<CategoryData[]|null> {
    try {
      if (existsSync(this.commandsDataPath)) {
        const rawData = await fs.readFile(this.commandsDataPath, 'utf8')
        const data = JSON.parse(rawData)

        // 验证数据格式是否有效
        if (Array.isArray(data) && data.length > 0 && data[0].commands) {
          return data as CategoryData[]
        }
        logger.warn('命令数据格式无效')
        return null
      }
      logger.info('找不到命令数据缓存文件')
      return null
    } catch (error) {
      logger.warn('加载命令数据失败', error)
      return null
    }
  }

  /**
   * 读取图片缓存
   * @param {string} path - 缓存路径
   * @returns {Promise<Buffer|null>} 图片数据
   */
  public async readImageCache(path: string): Promise<Buffer|null> {
    try {
      if (existsSync(path)) {
        const data = await fs.readFile(path)

        // 验证数据是否为有效的图片缓存
        if (Buffer.isBuffer(data) && data.length > 0) {
          return data
        }
        logger.warn(`图片缓存数据无效: ${path}`)
        return null
      }
      logger.debug(`找不到图片缓存: ${path}`)
      return null
    } catch (error) {
      logger.warn(`读取图片缓存失败: ${path}`, error)
      return null
    }
  }

  /**
   * 检查命令列表缓存是否存在
   * @returns {boolean} 是否存在
   */
  public hasCommandListCache(): boolean {
    return existsSync(this.getCommandListPath())
  }

  /**
   * 检查命令缓存是否存在
   * @param {string} commandName - 命令名称
   * @returns {boolean} 是否存在
   */
  public hasCommandCache(commandName: string): boolean {
    return existsSync(this.getCommandImagePath(commandName))
  }

  /**
   * 更新缓存配置
   * @param {string} locale - 语言代码
   * @param {string} themeId - 主题ID
   */
  public updateConfig(locale: string, themeId: string): void {
    this.locale = locale
    this.themeId = themeId
    this.commandsDataPath = resolve(this.dataDir, `commands_${locale}.json`)
    logger.info(`更新缓存配置: 语言=${locale}, 主题=${themeId}`)
  }

  /**
   * 清除所有缓存
   * @returns {Promise<boolean>} 成功状态
   */
  public async clearAllCache(): Promise<boolean> {
    try {
      if (!existsSync(this.imagesDir)) {
        return true
      }

      const files = await fs.readdir(this.imagesDir)
      const cachePattern = new RegExp(`_${this.locale}_${this.themeId}\\.png$`)

      // 批量删除匹配的缓存文件
      const deletePromises = files
        .filter(file => cachePattern.test(file))
        .map(file => fs.unlink(join(this.imagesDir, file)).catch(err => {
          logger.debug(`删除缓存文件失败: ${file}`, err)
        }))

      // 等待所有删除操作完成
      await Promise.all(deletePromises)

      // 删除命令数据缓存
      if (existsSync(this.commandsDataPath)) {
        await fs.unlink(this.commandsDataPath).catch(err => {
          logger.debug(`删除命令数据缓存失败`, err)
        })
      }

      logger.info('缓存已清除')
      return true
    } catch (error) {
      logger.error('清除缓存失败', error)
      return false
    }
  }
}

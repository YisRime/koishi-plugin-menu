import { Logger } from 'koishi'
import { promises as fs, existsSync } from 'fs'
import { resolve, join } from 'path'
import { CategoryData } from './command-extractor'

const logger = new Logger('menu:cache-manager')

/**
 * 缓存管理类，负责管理和维护命令数据和图片缓存
 */
export class CacheManager {
  private baseDir: string
  private dataDir: string
  private imagesDir: string
  private commandsDataDir: string
  private locale: string
  private themeId: string

  /**
   * 创建缓存管理器
   * @param baseDir 基础目录路径
   * @param locale 当前语言
   * @param themeId 当前主题ID
   */
  constructor(baseDir: string, locale: string, themeId: string) {
    this.baseDir = baseDir
    this.dataDir = resolve(baseDir, 'data/menu')
    this.imagesDir = resolve(this.dataDir, 'images')
    this.commandsDataDir = resolve(this.dataDir, 'data')
    this.locale = locale
    this.themeId = themeId
    logger.info(`缓存管理器初始化: 语言=${locale}, 主题=${themeId}`)
  }

  /**
   * 初始化缓存目录
   * @returns 是否初始化成功
   */
  public async initialize(): Promise<boolean> {
    try {
      // 创建所有必要的目录
      await Promise.all([
        fs.mkdir(this.dataDir, { recursive: true }),
        fs.mkdir(this.imagesDir, { recursive: true }),
        fs.mkdir(this.commandsDataDir, { recursive: true }),
        fs.mkdir(resolve(this.dataDir, 'themes'), { recursive: true })
      ])
      logger.info('缓存目录初始化成功')
      return true
    } catch (error) {
      logger.error('初始化缓存目录失败', error)
      return false
    }
  }

  /**
   * 获取命令列表图片路径
   * @returns 图片路径
   */
  public getCommandListPath(): string {
    const safeLocale = this.locale.replace(/[\/\\?%*:|"<>]/g, '_')
    return join(this.imagesDir, `command_list_${safeLocale}_${this.themeId}.png`)
  }

  /**
   * 获取单个命令图片路径
   * @param commandName 命令名称
   * @returns 图片路径
   */
  public getCommandImagePath(commandName: string): string {
    // 安全处理命令名称和语言标识，避免文件系统问题
    const safeName = commandName.replace(/[\/\\?%*:|"<>]/g, '_').replace(/\./g, '_')
    const safeLocale = this.locale.replace(/[\/\\?%*:|"<>]/g, '_')
    return join(this.imagesDir, `cmd_${safeName}_${safeLocale}_${this.themeId}.png`)
  }

  /**
   * 获取命令数据文件路径
   * @returns 文件路径
   */
  private getCommandsDataPath(): string {
    const safeLocale = this.locale.replace(/[\/\\?%*:|"<>]/g, '_')
    return join(this.commandsDataDir, `commands_${safeLocale}.json`)
  }

  /**
   * 保存命令数据
   * @param categoriesData 分类数据
   * @returns 是否保存成功
   */
  public async saveCommandsData(categoriesData: CategoryData[]): Promise<boolean> {
    if (!categoriesData) return false

    try {
      await this.safeWriteFile(
        this.getCommandsDataPath(),
        JSON.stringify(categoriesData, null, 2)
      )
      logger.debug(`命令数据保存成功: ${this.locale}`)
      return true
    } catch (error) {
      logger.error(`保存命令数据失败: ${this.locale}`, error)
      return false
    }
  }

  /**
   * 安全保存文件
   * @param path 文件路径
   * @param data 数据
   * @returns 是否保存成功
   */
  private async safeWriteFile(path: string, data: Buffer|string): Promise<boolean> {
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
   * @param path 文件路径
   * @param data 图片数据
   * @returns 是否保存成功
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
   * @returns 分类数据或null
   */
  public async loadCommandsData(): Promise<CategoryData[]|null> {
    const dataPath = this.getCommandsDataPath()

    try {
      if (existsSync(dataPath)) {
        const rawData = await fs.readFile(dataPath, 'utf8')
        const data = JSON.parse(rawData)

        // 验证数据格式是否有效
        if (Array.isArray(data) && data.length > 0 && data[0].commands) {
          return data as CategoryData[]
        }
        logger.warn(`命令数据格式无效: ${this.locale}`)
      } else {
        logger.info(`找不到命令数据缓存文件: ${this.locale}`)
      }
    } catch (error) {
      logger.warn(`加载命令数据失败: ${this.locale}`, error)
    }
    return null
  }

  /**
   * 读取图片缓存
   * @param path 缓存路径
   * @returns 图片数据或null
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
      } else {
        logger.debug(`找不到图片缓存: ${path}`)
      }
    } catch (error) {
      logger.warn(`读取图片缓存失败: ${path}`, error)
    }
    return null
  }

  /**
   * 检查命令列表缓存是否存在
   * @returns 是否存在
   */
  public hasCommandListCache(): boolean {
    return existsSync(this.getCommandListPath())
  }

  /**
   * 检查命令缓存是否存在
   * @param commandName 命令名称
   * @returns 是否存在
   */
  public hasCommandCache(commandName: string): boolean {
    return existsSync(this.getCommandImagePath(commandName))
  }

  /**
   * 更新缓存配置
   * @param locale 语言代码
   * @param themeId 主题ID
   */
  public updateConfig(locale: string, themeId: string): void {
    this.locale = locale
    this.themeId = themeId
    logger.info(`更新缓存配置: 语言=${locale}, 主题=${themeId}`)
  }

  /**
   * 清除所有缓存
   * @returns 是否清除成功
   */
  public async clearAllCache(): Promise<boolean> {
    try {
      // 清除图片缓存
      if (existsSync(this.imagesDir)) {
        const files = await fs.readdir(this.imagesDir)
        const safeLocale = this.locale.replace(/[\/\\?%*:|"<>]/g, '_')
        const cachePattern = new RegExp(`_${safeLocale}_${this.themeId}\\.png$`)

        // 批量删除匹配的缓存文件
        await Promise.all(
          files
            .filter(file => cachePattern.test(file))
            .map(file => fs.unlink(join(this.imagesDir, file))
              .catch(err => logger.debug(`删除缓存文件失败: ${file}`, err)))
        )
      }

      // 删除命令数据缓存
      const dataPath = this.getCommandsDataPath()
      if (existsSync(dataPath)) {
        await fs.unlink(dataPath).catch(err => logger.debug('删除命令数据缓存失败', err))
      }

      logger.info(`缓存已清除: 语言=${this.locale}, 主题=${this.themeId}`)
      return true
    } catch (error) {
      logger.error('清除缓存失败', error)
      return false
    }
  }

  /**
   * 获取基础目录
   * @returns 基础目录路径
   */
  public getBaseDir(): string {
    return this.baseDir;
  }
}

import { promises as fs, existsSync } from 'fs'
import { resolve, join } from 'path'
import { CategoryData } from './command'
import { logger } from './index'

/**
 * 缓存管理类
 */
export class Cache {
  private baseDir: string
  private dataDir: string
  private imgDir: string
  private cmdDataDir: string
  private locale: string
  private themeId: string

  /**
   * 创建缓存管理器
   */
  constructor(baseDir: string, locale: string, themeId: string) {
    this.baseDir = baseDir
    this.dataDir = resolve(baseDir, 'data/menu')
    this.imgDir = resolve(this.dataDir, 'images')
    this.cmdDataDir = resolve(this.dataDir, 'data')
    this.locale = locale
    this.themeId = themeId
    logger.info(`缓存初始化: 语言=${locale}, 主题=${themeId}`)
  }

  /**
   * 初始化缓存目录
   */
  public async initialize(): Promise<boolean> {
    try {
      // 创建所有必需目录
      await Promise.all([
        fs.mkdir(this.dataDir, { recursive: true }),
        fs.mkdir(this.imgDir, { recursive: true }),
        fs.mkdir(this.cmdDataDir, { recursive: true }),
        fs.mkdir(resolve(this.dataDir, 'themes'), { recursive: true })
      ])
      return true
    } catch (err) {
      logger.error('初始化缓存目录失败', err)
      return false
    }
  }

  /**
   * 安全名称（删除非法字符）
   */
  private safeName(name: string): string {
    return name.replace(/[\/\\?%*:|"<>]/g, '_')
  }

  /**
   * 获取列表路径
   */
  public getCommandListPath(): string {
    const safeLoc = this.safeName(this.locale)
    return join(this.imgDir, `cmd_list_${safeLoc}_${this.themeId}.png`)
  }

  /**
   * 获取命令图片路径
   */
  public getCommandImagePath(name: string): string {
    const safeName = this.safeName(name).replace(/\./g, '_')
    const safeLoc = this.safeName(this.locale)
    return join(this.imgDir, `cmd_${safeName}_${safeLoc}_${this.themeId}.png`)
  }

  /**
   * 获取数据路径
   */
  private getDataPath(): string {
    return join(this.cmdDataDir, `cmds_${this.safeName(this.locale)}.json`)
  }

  /**
   * 安全写入文件
   */
  private async safeWrite(path: string, data: Buffer|string): Promise<boolean> {
    const tmp = `${path}.tmp`

    try {
      // 写入临时文件
      await fs.writeFile(tmp, data)

      // 如果目标文件存在，先删除
      if (existsSync(path)) {
        await fs.unlink(path).catch(() => {})
      }

      // 重命名临时文件
      await fs.rename(tmp, path)
      return true
    } catch (err) {
      // 清理临时文件
      if (existsSync(tmp)) {
        await fs.unlink(tmp).catch(() => {})
      }
      throw err
    }
  }

  /**
   * 保存命令数据
   */
  public async saveCommandsData(data: CategoryData[]): Promise<boolean> {
    if (!data) return false

    try {
      await this.safeWrite(
        this.getDataPath(),
        JSON.stringify(data, null, 2)
      )
      return true
    } catch (err) {
      logger.error(`保存命令数据失败: ${this.locale}`, err)
      return false
    }
  }

  /**
   * 保存图片缓存
   */
  public async saveImageCache(path: string, data: Buffer): Promise<boolean> {
    if (!data || !Buffer.isBuffer(data)) return false

    try {
      await this.safeWrite(path, data)
      return true
    } catch (err) {
      logger.error(`保存图片失败: ${path}`, err)
      return false
    }
  }

  /**
   * 加载命令数据
   */
  public async loadCommandsData(): Promise<CategoryData[]|null> {
    const path = this.getDataPath()

    try {
      if (existsSync(path)) {
        const raw = await fs.readFile(path, 'utf8')
        const data = JSON.parse(raw)

        // 验证数据格式
        if (Array.isArray(data) && data.length > 0 && data[0].commands) {
          return data as CategoryData[]
        }
        logger.warn(`命令数据格式无效: ${this.locale}`)
      } else {
        logger.info(`未找到命令数据: ${this.locale}`)
      }
    } catch (err) {
      logger.warn(`加载命令数据失败: ${this.locale}`, err)
    }
    return null
  }

  /**
   * 读取图片缓存
   */
  public async readImageCache(path: string): Promise<Buffer|null> {
    try {
      if (existsSync(path)) {
        const data = await fs.readFile(path)
        if (Buffer.isBuffer(data) && data.length > 0) {
          return data
        }
        logger.warn(`图片缓存无效: ${path}`)
      }
    } catch (err) {
      logger.warn(`读取图片缓存失败: ${path}`, err)
    }
    return null
  }

  /**
   * 检查列表缓存
   */
  public hasCommandListCache(): boolean {
    return existsSync(this.getCommandListPath())
  }

  /**
   * 检查命令缓存
   */
  public hasCommandCache(name: string): boolean {
    return existsSync(this.getCommandImagePath(name))
  }

  /**
   * 更新配置
   */
  public updateConfig(locale: string, themeId: string): void {
    this.locale = locale
    this.themeId = themeId
    logger.info(`更新缓存配置: 语言=${locale}, 主题=${themeId}`)
  }

  /**
   * 清除缓存
   */
  public async clearAllCache(): Promise<boolean> {
    try {
      // 清除图片
      if (existsSync(this.imgDir)) {
        const files = await fs.readdir(this.imgDir)
        const safeLoc = this.safeName(this.locale)
        const pattern = new RegExp(`_${safeLoc}_${this.themeId}\\.png$`)

        await Promise.all(
          files
            .filter(file => pattern.test(file))
            .map(file => fs.unlink(join(this.imgDir, file))
              .catch(() => {}))
        )
      }

      // 删除数据文件
      const dataPath = this.getDataPath()
      if (existsSync(dataPath)) {
        await fs.unlink(dataPath).catch(() => {})
      }

      logger.info(`缓存已清除: 语言=${this.locale}, 主题=${this.themeId}`)
      return true
    } catch (err) {
      logger.error('清除缓存失败', err)
      return false
    }
  }

  /**
   * 获取基础目录
   */
  public getBaseDir(): string {
    return this.baseDir
  }
}

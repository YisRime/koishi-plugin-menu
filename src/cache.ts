import { Logger } from 'koishi'
import { promises as fs, existsSync } from 'fs'
import { resolve } from 'path'

const logger = new Logger('menu:cache')

/**
 * 缓存元数据接口
 * @typedef {Object} CacheMetadata
 * @property {number} timestamp - 缓存时间戳
 * @property {string} commandHash - 命令哈希值
 */
export interface CacheMetadata {
  timestamp: number
  commandHash: string
}

/**
 * 缓存管理类
 */
export class CacheManager {
  private metadataPath: string
  private imagesDir: string
  private commandsDataPath: string
  private metadata: CacheMetadata = {
    timestamp: 0,
    commandHash: ''
  }

  constructor(private baseDir: string, private locale: string, private isDark: boolean) {
    const dataDir = resolve(baseDir, 'data/menu')
    this.metadataPath = resolve(dataDir, 'meta.json')
    this.imagesDir = resolve(dataDir, 'images')
    this.commandsDataPath = resolve(dataDir, 'commands.json')
  }

  /**
   * 确保目录存在
   */
  async ensureDirectories() {
    try {
      // 创建主数据目录
      await fs.mkdir(resolve(this.baseDir, 'data/menu'), { recursive: true })
      // 创建图片子目录
      await fs.mkdir(this.imagesDir, { recursive: true })
    } catch (err) {
      logger.error(`创建缓存目录失败`, err)
      throw err
    }
  }

  /**
   * 加载缓存元数据
   * @returns {Promise<boolean>} - 是否成功加载
   */
  async loadMetadata(): Promise<boolean> {
    try {
      if (existsSync(this.metadataPath)) {
        const data = await fs.readFile(this.metadataPath, 'utf8')
        Object.assign(this.metadata, JSON.parse(data))
        return true
      }
    } catch (err) {
      logger.warn('读取缓存元数据失败', err)
    }
    return false
  }

  /**
   * 保存缓存元数据
   */
  async saveMetadata() {
    try {
      await fs.writeFile(this.metadataPath, JSON.stringify(this.metadata), 'utf8')
    } catch (err) {
      logger.error('保存缓存元数据失败', err)
    }
  }

  /**
   * 验证缓存是否有效
   * @param {number} cacheExpiry - 缓存过期时间(分钟)
   * @returns {boolean} - 缓存是否有效
   */
  isCacheValid(cacheExpiry: number): boolean {
    if (cacheExpiry === 0) return true // 永不过期

    const now = Date.now()
    const cacheAge = (now - this.metadata.timestamp) / (60 * 1000) // 转换为分钟
    return cacheAge < cacheExpiry
  }

  /**
   * 更新缓存时间戳和命令哈希
   * @param {string} commandHash - 新的命令哈希值
   */
  updateMetadata(commandHash: string) {
    this.metadata.commandHash = commandHash
    this.metadata.timestamp = Date.now()
  }

  /**
   * 获取当前的命令哈希
   * @returns {string} - 当前命令哈希值
   */
  getCommandHash(): string {
    return this.metadata.commandHash
  }

  /**
   * 获取命令列表图片路径
   * @returns {string} - 图片路径
   */
  getCommandListPath(): string {
    const themeStr = this.isDark ? 'dark' : 'light'
    return resolve(this.imagesDir, `commands_${this.locale}_${themeStr}.png`)
  }

  /**
   * 获取单个命令图片路径
   * @param {string} commandName - 命令名称
   * @returns {string} - 图片路径
   */
  getCommandPath(commandName: string): string {
    const themeStr = this.isDark ? 'dark' : 'light'
    return resolve(this.imagesDir, `cmd_${commandName.replace(/\./g, '_')}_${this.locale}_${themeStr}.png`)
  }

  /**
   * 保存命令数据到JSON文件
   * @param {Object} commandsData - 命令数据
   */
  async saveCommandsData(commandsData: any): Promise<void> {
    try {
      await fs.writeFile(this.commandsDataPath, JSON.stringify(commandsData), 'utf8')
    } catch (err) {
      logger.error('保存命令数据失败', err)
    }
  }

  /**
   * 从JSON文件加载命令数据
   * @returns {Promise<Object|null>} - 加载的命令数据
   */
  async loadCommandsData(): Promise<any> {
    try {
      if (existsSync(this.commandsDataPath)) {
        const data = await fs.readFile(this.commandsDataPath, 'utf8')
        return JSON.parse(data)
      }
    } catch (err) {
      logger.warn('读取命令数据失败', err)
    }
    return null
  }
}

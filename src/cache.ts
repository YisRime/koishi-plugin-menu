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

  constructor(baseDir: string, locale: string, themeId: string) {
    this.baseDir = baseDir
    this.dataDir = resolve(baseDir, 'data/menu')
    this.imgDir = resolve(this.dataDir, 'images')
    this.cmdDataDir = resolve(this.dataDir, 'data')
    this.locale = locale
    this.themeId = themeId
  }

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

  private safeName(name: string): string {
    return name.replace(/[\/\\?%*:|"<>]/g, '_')
  }

  public getCommandListPath(): string {
    return join(this.imgDir, `cmd_list_${this.safeName(this.locale)}_${this.themeId}.png`)
  }

  public getCommandImagePath(name: string): string {
    const safeName = this.safeName(name).replace(/\./g, '_')
    return join(this.imgDir, `cmd_${safeName}_${this.safeName(this.locale)}_${this.themeId}.png`)
  }

  private getDataPath(): string {
    return join(this.cmdDataDir, `cmds_${this.safeName(this.locale)}.json`)
  }

  private async safeWrite(path: string, data: Buffer|string): Promise<boolean> {
    const tmp = `${path}.tmp`
    try {
      await fs.writeFile(tmp, data)
      if (existsSync(path)) await fs.unlink(path).catch(() => {})
      await fs.rename(tmp, path)
      return true
    } catch (err) {
      if (existsSync(tmp)) await fs.unlink(tmp).catch(() => {})
      throw err
    }
  }

  public async saveCommandsData(data: CategoryData[]): Promise<boolean> {
    if (!data) return false
    try {
      await this.safeWrite(this.getDataPath(), JSON.stringify(data, null, 2))
      return true
    } catch (err) {
      logger.error(`保存命令数据失败: ${this.locale}`, err)
      return false
    }
  }

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

  public async loadCommandsData(): Promise<CategoryData[]|null> {
    const path = this.getDataPath()
    try {
      if (existsSync(path)) {
        const data = JSON.parse(await fs.readFile(path, 'utf8'))
        if (Array.isArray(data) && data.length > 0 && data[0].commands) {
          return data as CategoryData[]
        }
      }
    } catch (err) {
      logger.error(`加载命令数据失败: ${this.locale}`, err)
    }
    return null
  }

  public async readImageCache(path: string): Promise<Buffer|null> {
    try {
      if (existsSync(path)) {
        const data = await fs.readFile(path)
        if (Buffer.isBuffer(data) && data.length > 0) return data
      }
    } catch (err) {
      logger.error(`读取图片缓存失败: ${path}`, err)
    }
    return null
  }

  public hasCommandListCache(): boolean {
    return existsSync(this.getCommandListPath())
  }

  public hasCommandCache(name: string): boolean {
    return existsSync(this.getCommandImagePath(name))
  }

  public updateConfig(locale: string, themeId: string): void {
    this.locale = locale
    this.themeId = themeId
  }

  public async clearAllCache(): Promise<boolean> {
    try {
      // 仅清除当前语言和主题的图片缓存
      if (existsSync(this.imgDir)) {
        const files = await fs.readdir(this.imgDir)
        const safeLoc = this.safeName(this.locale)
        const pattern = new RegExp(`_${safeLoc}_${this.themeId}\\.png$`)

        await Promise.all(
          files.filter(file => pattern.test(file))
               .map(file => fs.unlink(join(this.imgDir, file)).catch(() => {}))
        )
      }

      // 删除数据文件
      const dataPath = this.getDataPath()
      if (existsSync(dataPath)) await fs.unlink(dataPath).catch(() => {})

      return true
    } catch (err) {
      logger.error('清除缓存失败', err)
      return false
    }
  }

  public getBaseDir(): string {
    return this.baseDir
  }
}
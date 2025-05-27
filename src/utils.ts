import { dirname, join } from 'path'
import { promises } from 'fs'

/**
 * 文件管理器类，处理菜单相关文件的读写操作
 */
export class FileStore {
  private readonly baseDir: string

  /**
   * 创建文件存储实例
   * @param rootDir 根目录路径
   */
  constructor(rootDir: string) {
    this.baseDir = join(rootDir, 'data/menu')
  }

  /**
   * 构建文件路径
   * @param type 文件类型
   * @param locale 语言代码
   * @returns 完整文件路径
   */
  private makePath(type: string, locale?: string): string {
    const fileName = type === 'commands'
      ? (locale ? `commands-${locale}.json` : 'commands.json')
      : `${type}.json`
    return join(this.baseDir, fileName)
  }

  /**
   * 检查文件是否存在
   * @param type 文件类型
   * @param locale 语言代码
   * @returns 文件是否存在
   */
  async exists(type: string, locale?: string): Promise<boolean> {
    try {
      await promises.access(this.makePath(type, locale))
      return true
    } catch {
      return false
    }
  }

  /**
   * 写入数据到文件
   * @param type 文件类型
   * @param data 要写入的数据
   * @param locale 语言代码
   */
  async save<T>(type: string, data: T, locale?: string): Promise<void> {
    const path = this.makePath(type, locale)
    await promises.mkdir(dirname(path), { recursive: true })
    await promises.writeFile(path, JSON.stringify(data, null, 2), 'utf8')
  }

  /**
   * 从文件读取数据
   * @param type 文件类型
   * @param locale 语言代码
   * @returns 读取的数据或null
   */
  async load<T>(type: string, locale?: string): Promise<T | null> {
    try {
      const content = await promises.readFile(this.makePath(type, locale), 'utf8')
      return JSON.parse(content) as T
    } catch {
      return null
    }
  }

  /**
   * 解析资源路径，支持 URL 或本地 assets 文件
   * @param path 输入路径（URL 或文件名）
   * @returns 处理后的路径
   */
  resolve(path: string): string {
    if (!path || /^https?:\/\//.test(path)) return path || ''
    const assetsPath = join(this.baseDir, path)
    return `file:///${assetsPath.replace(/\\/g, '/')}`
  }

  /**
   * 检查本地资源文件是否存在
   * @param filename 文件名
   * @returns 是否存在
   */
  async check(filename: string): Promise<boolean> {
    if (!filename || /^https?:\/\//.test(filename)) return true
    try {
      const assetsPath = join(this.baseDir, filename)
      await promises.access(assetsPath)
      return true
    } catch {
      return false
    }
  }
}
import { dirname, join } from 'path'
import { createHash } from 'crypto'
import { promises } from 'fs'

/**
 * 文件管理器类，处理菜单相关文件的读写操作
 */
export class FileStore {
  /** 基础目录路径，用于存储菜单相关文件 */
  private readonly baseDir: string
  /** 缓存目录路径，用于存储生成的图片缓存 */
  private readonly cacheDir: string

  /**
   * 创建文件存储实例
   * @param rootDir 根目录路径
   */
  constructor(rootDir: string) {
    this.baseDir = join(rootDir, 'data/menu')
    this.cacheDir = join(this.baseDir, 'cache')
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

  /**
   * 生成缓存键
   * @param commands 指令列表
   * @param config 渲染配置
   * @param cmdName 指令名称
   * @returns 缓存键字符串
   */
  generateCacheKey(commands: any[], config: any, cmdName?: string): string {
    const prefix = cmdName?.replace(/[^a-zA-Z0-9\-_\.]/g, '_') || (commands.length === 1 ? commands[0].name.replace(/[^a-zA-Z0-9\-_\.]/g, '_') : 'menu')
    const hash = createHash('md5').update(JSON.stringify({
      commands: commands.map(cmd => ({ name: cmd.name, desc: cmd.desc, group: cmd.group, options: cmd.options?.length || 0, subs: cmd.subs?.length || 0 })),
      config: { padding: config.padding, radius: config.radius, fontSize: config.fontSize, titleSize: config.titleSize, primary: config.primary, secondary: config.secondary, bgColor: config.bgColor, textColor: config.textColor, header: config.header, footer: config.footer }
    })).digest('hex').substring(0, 12)
    return `${prefix}_${hash}`
  }

  /**
   * 获取缓存文件内容
   * @param key 缓存键
   * @returns 缓存文件的Buffer数据，如果不存在则返回null
   */
  async getCache(key: string): Promise<Buffer | null> {
    try { return await promises.readFile(join(this.cacheDir, `${key}.png`)) } catch { return null }
  }

  /**
   * 保存数据到缓存文件
   * @param key 缓存键
   * @param buffer 要保存的Buffer数据
   */
  async saveCache(key: string, buffer: Buffer): Promise<void> {
    const path = join(this.cacheDir, `${key}.png`)
    await promises.mkdir(dirname(path), { recursive: true })
    await promises.writeFile(path, buffer)
  }

  /**
   * 清除缓存文件
   * @param cmdName 可选的指令名称，如果提供则只清除该指令相关的缓存，否则清除所有缓存
   */
  async clearCache(cmdName?: string): Promise<void> {
    try {
      const files = await promises.readdir(this.cacheDir).catch(() => [])
      const pattern = cmdName?.replace(/[^a-zA-Z0-9\-_\.]/g, '_') || ''
      await Promise.all(files.filter(f => f.endsWith('.png') && (pattern ? f.startsWith(pattern + '_') : true))
        .map(f => promises.unlink(join(this.cacheDir, f)).catch(() => {})))
    } catch {}
  }
}
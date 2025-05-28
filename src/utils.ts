import { dirname, join } from 'path'
import { createHash } from 'crypto'
import { promises } from 'fs'

/**
 * 文件存储管理器
 * @description 提供文件读写、缓存管理、路径解析等功能
 */
export class FileStore {
  private readonly baseDir: string
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
   * @param locale 可选的语言代码
   * @returns 完整文件路径
   */
  private makePath(type: string, locale?: string): string {
    const fileName = type === 'commands' && locale ? `commands-${locale}.json` : `${type}.json`
    return join(this.baseDir, fileName)
  }

  /**
   * 检查文件是否存在
   * @param type 文件类型
   * @param locale 可选的语言代码
   * @returns 文件是否存在
   */
  async exists(type: string, locale?: string): Promise<boolean> {
    try {
      await promises.access(this.makePath(type, locale))
      return true
    } catch { return false }
  }

  /**
   * 保存数据到文件
   * @param type 文件类型
   * @param data 要保存的数据
   * @param locale 可选的语言代码
   */
  async save<T>(type: string, data: T, locale?: string): Promise<void> {
    const path = this.makePath(type, locale)
    await promises.mkdir(dirname(path), { recursive: true })
    await promises.writeFile(path, JSON.stringify(data, null, 2), 'utf8')
  }

  /**
   * 从文件读取数据
   * @param type 文件类型
   * @param locale 可选的语言代码
   * @returns 读取的数据或null
   */
  async load<T>(type: string, locale?: string): Promise<T | null> {
    try {
      const content = await promises.readFile(this.makePath(type, locale), 'utf8')
      return JSON.parse(content) as T
    } catch { return null }
  }

  /**
   * 解析资源路径
   * @param path 输入路径（URL或文件名）
   * @returns 处理后的路径
   */
  resolve(path: string): string {
    return !path || /^https?:\/\//.test(path) ? path || '' : `file:///${join(this.baseDir, path).replace(/\\/g, '/')}`
  }

  /**
   * 检查本地资源文件是否存在
   * @param filename 文件名
   * @returns 是否存在
   */
  async check(filename: string): Promise<boolean> {
    if (!filename || /^https?:\/\//.test(filename)) return true
    try {
      await promises.access(join(this.baseDir, filename))
      return true
    } catch { return false }
  }

  /**
   * 生成缓存键
   * @param commands 指令列表
   * @param config 配置对象
   * @param cmdName 可选的指令名称
   * @returns 缓存键字符串
   */
  generateCacheKey(commands: any[], config: any, cmdName?: string): string {
    if (!commands?.length || !config) return 'invalid'
    const prefix = cmdName?.replace(/[^a-zA-Z0-9\-_\.]/g, '_') || 'menu'
    const hash = createHash('md5')
      .update(`${commands.length}:${this.hashConfig(config)}:${this.hashCommands(commands)}`)
      .digest('hex').substring(0, 12)
    return `${prefix}_${hash}`
  }

  /**
   * 生成配置哈希
   * @param config 配置对象
   * @returns 配置哈希字符串
   */
  private hashConfig(config: any): string {
    if (!config || typeof config !== 'object') return 'empty'
    const keys = ['padding', 'radius', 'fontSize', 'titleSize', 'primary', 'secondary', 'bgColor', 'textColor', 'glassBlur']
    return createHash('md5')
      .update(keys.map(k => `${k}:${config[k] ?? ''}`).join('|'))
      .digest('hex').substring(0, 8)
  }

  /**
   * 生成指令列表哈希
   * @param commands 指令列表
   * @returns 指令哈希字符串
   */
  private hashCommands(commands: any[]): string {
    if (!Array.isArray(commands) || !commands.length) return 'empty'
    const signature = commands
      .filter(cmd => cmd && typeof cmd === 'object')
      .map(cmd => `${cmd.name?.name || 'unknown'}:${cmd.desc?.length || 0}:${cmd.options?.length || 0}:${cmd.subs?.length || 0}`)
      .sort().join('|')
    return createHash('md5').update(signature || 'empty').digest('hex').substring(0, 8)
  }

  /**
   * 获取缓存文件内容
   * @param key 缓存键
   * @returns 缓存文件的Buffer数据，如果不存在则返回null
   */
  async getCache(key: string): Promise<Buffer | null> {
    try {
      return await promises.readFile(join(this.cacheDir, `${key}.png`))
    } catch { return null }
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
   * @param cmdName 可选的指令名称，用于清除特定指令的缓存
   */
  async clearCache(cmdName?: string): Promise<void> {
    try {
      const files = await promises.readdir(this.cacheDir).catch(() => [])
      const pattern = cmdName?.replace(/[^a-zA-Z0-9\-_\.]/g, '_')
      await Promise.all(files
        .filter(f => f.endsWith('.png') && (!pattern || f.startsWith(pattern + '_')))
        .map(f => promises.unlink(join(this.cacheDir, f)).catch(() => {})))
    } catch {}
  }
}
import { dirname, join } from 'path'
import { createHash } from 'crypto'
import { promises } from 'fs'

/**
 * 文件管理器
 *
 * 负责处理菜单相关文件的读写操作，包括数据存储、资源管理、缓存管理等功能
 */
export class FileStore {
  /** 基础目录路径 */
  private readonly baseDir: string
  /** 缓存目录路径 */
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
   * @private
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
   * 保存数据到文件
   * @param type 文件类型
   * @param data 要保存的数据
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
   * 解析资源路径
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
      await promises.access(join(this.baseDir, filename))
      return true
    } catch {
      return false
    }
  }

  /**
   * 生成高效的缓存键
   *
   * 优化算法：
   * 1. 使用增量哈希避免重复序列化
   * 2. 只提取关键字段用于哈希计算
   * 3. 预处理去重和排序
   *
   * @param commands 指令列表
   * @param config 渲染配置
   * @param cmdName 指令名称
   * @param commandsHash 指令修改状态哈希
   * @returns 缓存键字符串
   */
  generateCacheKey(commands: any[], config: any, cmdName?: string, commandsHash?: string): string {
    // 生成前缀
    const prefix = cmdName?.replace(/[^a-zA-Z0-9\-_\.]/g, '_') ||
                  (commands.length === 1 ? commands[0].name.replace(/[^a-zA-Z0-9\-_\.]/g, '_') : 'menu')

    // 创建增量哈希器
    const hasher = createHash('md5')

    // 包含commands插件的修改状态
    if (commandsHash) {
      hasher.update(`commands:${commandsHash}`)
    }

    // 处理指令数据：去重、排序、提取关键字段
    this.hashCommands(commands, hasher)

    // 处理配置数据：只包含影响渲染的字段
    const configFields = [
      'padding', 'radius', 'fontSize', 'titleSize',
      'primary', 'secondary', 'bgColor', 'textColor',
      'header', 'footer', 'glassBlur'
    ]

    configFields.forEach(field => {
      if (config[field] !== undefined) {
        hasher.update(`${field}:${config[field]}`)
      }
    })

    return `${prefix}_${hasher.digest('hex').substring(0, 12)}`
  }

  /**
   * 高效哈希指令数据
   * @param commands 指令列表
   * @param hasher 哈希器实例
   * @returns 更新后的哈希器
   * @private
   */
  private hashCommands(commands: any[], hasher: any): any {
    // 去重并排序
    const uniqueCommands = new Map<string, any>()

    commands.forEach(cmd => {
      const key = cmd.name // 使用当前显示名称作为键
      if (!uniqueCommands.has(key)) {
        // 处理别名信息
        const aliasesData = Array.isArray(cmd.aliases)
          ? cmd.aliases.map((alias: any) => ({
              name: typeof alias === 'string' ? alias : alias.name,
              enabled: typeof alias === 'string' ? true : alias.enabled,
              isDefault: typeof alias === 'string' ? false : alias.isDefault
            })).sort((a: any, b: any) => a.name.localeCompare(b.name))
          : [...new Set(cmd.aliases || [])].sort()

        uniqueCommands.set(key, {
          name: cmd.name,
          aliases: aliasesData,
          desc: cmd.desc?.substring(0, 50) || '',
          group: cmd.group,
          hidden: cmd.hidden,
          authority: cmd.authority,
          optCount: cmd.options?.length || 0,
          subCount: cmd.subs?.length || 0
        })
      }
    })

    // 按名称排序并哈希
    Array.from(uniqueCommands.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(cmd => {
        hasher.update(JSON.stringify(cmd))
      })

    return hasher
  }

  /**
   * 生成指令修改状态的哈希值
   * @param ctx Koishi上下文
   * @returns 指令修改状态哈希
   */
  generateCommandsHash(ctx: any): string {
    const snapshots = ctx.get('commands')?.snapshots
    if (!snapshots) return ''

    const hasher = createHash('md5')

    // 只哈希override部分的关键字段
    Object.entries(snapshots).forEach(([name, snapshot]: [string, any]) => {
      const override = snapshot.override || {}
      hasher.update(`${name}:${JSON.stringify({
        config: override.config || {},
        aliases: override.aliases || {},
        hasTexts: !!override.texts,
        hasOptions: Object.keys(override.options || {}).length > 0
      })}`)
    })

    return hasher.digest('hex').substring(0, 8)
  }

  /**
   * 获取缓存文件内容
   * @param key 缓存键
   * @returns 缓存文件的Buffer数据，如果不存在则返回null
   */
  async getCache(key: string): Promise<Buffer | null> {
    try {
      return await promises.readFile(join(this.cacheDir, `${key}.png`))
    } catch {
      return null
    }
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

      const filesToDelete = files.filter(f =>
        f.endsWith('.png') && (pattern ? f.startsWith(pattern + '_') : true)
      )

      await Promise.all(
        filesToDelete.map(f =>
          promises.unlink(join(this.cacheDir, f)).catch(() => {})
        )
      )
    } catch {}
  }
}

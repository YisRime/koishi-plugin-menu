import { dirname, join } from 'path'
import { promises } from 'fs'
import { createLayout } from './extract'

/**
 * 文件管理器类
 */
export class FileStore {
  private readonly baseDir: string

  /**
   * 创建文件管理器实例
   * @param rootDir - 根目录路径
   */
  constructor(rootDir: string) {
    this.baseDir = join(rootDir, 'data/menu')
  }

  /**
   * 获取文件路径
   * @param type - 文件类型 ('commands' | 'layouts' | 'assets' | 其他)
   * @param locale - 语言代码，可选
   * @param id - 文件标识符，可选
   * @returns 构建的文件完整路径
   * @private
   */
  private buildPath(type: string, locale?: string, id?: string): string {
    const localeFile = locale ? `commands-${locale}.json` : 'commands.json'
    const paths = {
      commands: join(this.baseDir, 'commands', localeFile),
      layouts: join(this.baseDir, 'layouts.json'),
      assets: id ? join(this.baseDir, 'assets', id) : join(this.baseDir, 'assets')
    }
    return paths[type] || join(this.baseDir, `${id || 'data'}.json`)
  }

  /**
   * 检查文件是否存在
   * @param type - 文件类型
   * @param locale - 语言代码，可选
   * @param id - 文件标识符，可选
   * @returns Promise<boolean> 文件是否存在
   */
  async has(type: string, locale?: string, id?: string): Promise<boolean> {
    try {
      await promises.access(this.buildPath(type, locale, id))
      return true
    } catch {
      return false
    }
  }

  /**
   * 保存数据到文件
   * @template T - 数据类型
   * @param type - 文件类型
   * @param data - 要保存的数据
   * @param locale - 语言代码，可选
   * @param id - 文件标识符，可选
   * @returns Promise<void>
   * @throws {Error} 当文件写入失败时抛出错误
   */
  async write<T>(type: string, data: T, locale?: string, id?: string): Promise<void> {
    const path = this.buildPath(type, locale, id)
    await promises.mkdir(dirname(path), { recursive: true })
    if (type === 'assets') {
      await promises.writeFile(path, String(data), 'utf8')
    } else {
      await promises.writeFile(path, JSON.stringify(data, null, 2), 'utf8')
    }
  }

  /**
   * 从文件读取数据
   * @template T - 期望的数据类型
   * @param type - 文件类型
   * @param locale - 语言代码，可选
   * @param id - 文件标识符，可选
   * @returns Promise<T | null> 读取的数据，如果文件不存在或读取失败则返回 null
   */
  async read<T>(type: string, locale?: string, id?: string): Promise<T | null> {
    try {
      const path = this.buildPath(type, locale, id)
      const content = await promises.readFile(path, 'utf8')
      return type === 'assets' ? content as T : JSON.parse(content) as T
    } catch {
      return null
    }
  }
}

/**
 * 数据服务类
 */
export class DataStore {
  /**
   * 创建数据服务实例
   * @param files - 文件管理器实例
   * @param extract - 命令提取器实例
   */
  constructor(
    private readonly files: FileStore,
    private readonly extract: any
  ) {}

  /**
   * 获取命令数据
   * @param cmdName - 命令名称，为空时返回所有命令
   * @param session - 会话对象
   * @param locale - 语言代码
   * @returns Promise<any[]> 命令数据数组
   */
  async getCommands(cmdName: string, session: any, locale: string) {
    let allCommands = await this.files.read<any[]>('commands', locale)
    if (!allCommands) {
      allCommands = await this.extract.getAll(session, locale)
      await this.files.write('commands', allCommands, locale)
    }
    // 应用过滤
    let commands = await this.extract.filterCommands(allCommands, session)
    commands = commands.map(command => this.extract.filterCommandOptions(command, session))
    if (!cmdName) return commands
    // 查找特定命令
    const found = commands.find(c => c.name === cmdName) ||
                  commands.flatMap(c => c.subs || []).find(s => s.name === cmdName)
    if (found) return [found]
    // 尝试单独获取
    const single = await this.extract.getSingle(session, cmdName, locale)
    if (single) {
      const filtered = await this.extract.filterCommands([single], session)
      if (filtered.length) {
        allCommands.push(single)
        await this.files.write('commands', allCommands, locale)
        return [this.extract.filterCommandOptions(filtered[0], session)]
      }
    }
    return []
  }

  /**
   * 获取布局数据
   * @param cmdName - 命令名称，为空时返回主布局
   * @param commands - 命令数据数组
   * @returns Promise<any | null> 布局数据，如果不存在则返回 null
   */
  async getLayout(cmdName: string, commands: any[]) {
    let layouts = await this.files.read('layouts')
    if (!layouts) {
      layouts = await this.generateAllLayouts(commands)
      if (layouts) await this.files.write('layouts', layouts)
    }
    return layouts[cmdName || 'main'] || null
  }

  /**
   * 生成所有命令的布局数据
   * @param commands - 命令数据数组
   * @returns Promise<Record<string, any>> 布局数据映射表，键为命令名称，值为布局数据
   * @private
   */
  private async generateAllLayouts(commands: any[]): Promise<Record<string, any>> {
    const layouts: Record<string, any> = {}
    // 生成主菜单布局
    const mainLayout = await createLayout(null, commands)
    if (mainLayout) layouts.main = mainLayout
    // 批量生成所有命令布局
    const allCommands = [...commands, ...commands.flatMap(cmd => cmd.subs || [])]
    const layoutPromises = allCommands
      .filter(cmd => cmd.name)
      .map(async cmd => {
        const layout = await createLayout(cmd.name, commands)
        if (layout) layouts[cmd.name] = layout
      })
    await Promise.all(layoutPromises)
    return layouts
  }
}

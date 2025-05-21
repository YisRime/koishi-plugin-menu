import { promises as fs, existsSync } from 'fs'
import { resolve, join } from 'path'
import { CategoryData } from './command'
import { logger } from './index'

// 添加分组配置接口
export interface GroupConfig {
  name: string;
  icon: string;
  commands: string[];  // 命令名称列表
}

export interface GroupsData {
  groups: GroupConfig[];
  version: number;     // 版本号，方便未来扩展
}
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

  /**
   * 简化命令数据结构
   */
  private simplifyCommandData(data: CategoryData[]): CategoryData[] {
    // 创建深拷贝以避免修改原始数据
    const simplifiedData = JSON.parse(JSON.stringify(data));

    // 递归处理所有命令
    const processCommands = (commands: any[]) => {
      if (!commands?.length) return;

      for (const cmd of commands) {
        // 简化描述字段
        if (Array.isArray(cmd.description)) {
          let simpleDesc = '';
          for (const desc of cmd.description) {
            if (desc && typeof desc === 'object' && desc.attrs?.content) {
              simpleDesc += desc.attrs.content + ' ';
            } else if (typeof desc === 'string') {
              simpleDesc += desc + ' ';
            }
          }
          cmd.description = simpleDesc.trim();
        }

        // 简化 usage 字段 - 与 description 类似的处理
        if (Array.isArray(cmd.usage)) {
          let simpleUsage = '';
          for (const usage of cmd.usage) {
            if (usage && typeof usage === 'object' && usage.attrs?.content) {
              simpleUsage += usage.attrs.content + '\n';
            } else if (typeof usage === 'string') {
              simpleUsage += usage + '\n';
            }
          }
          cmd.usage = simpleUsage.trim();
        }

        // 处理选项描述
        if (cmd.options?.length) {
          for (const opt of cmd.options) {
            if (Array.isArray(opt.description)) {
              let simpleOptDesc = '';
              for (const desc of opt.description) {
                if (desc && typeof desc === 'object' && desc.attrs?.content) {
                  simpleOptDesc += desc.attrs.content + ' ';
                } else if (typeof desc === 'string') {
                  simpleOptDesc += desc + ' ';
                }
              }
              opt.description = simpleOptDesc.trim();
            }
          }
        }

        // 递归处理子命令
        if (cmd.subCommands?.length) {
          processCommands(cmd.subCommands);
        }
      }
    };

    // 处理每个分类中的命令
    for (const category of simplifiedData) {
      processCommands(category.commands);

      // 处理分组中的命令
      if (category.groups?.length) {
        for (const group of category.groups) {
          processCommands(group.commands);
        }
      }
    }

    return simplifiedData;
  }

  public async saveCommandsData(data: CategoryData[]): Promise<boolean> {
    if (!data) return false
    try {
      // 在保存前简化数据结构
      const simplifiedData = this.simplifyCommandData(data);
      await this.safeWrite(this.getDataPath(), JSON.stringify(simplifiedData, null, 2))
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
  private getGroupsDataPath(): string {
    return join(this.dataDir, 'groups.json')
  }

  /**
   * 保存分组配置
   */
  public async saveGroupsData(data: GroupsData): Promise<boolean> {
    if (!data) return false
    try {
      await this.safeWrite(this.getGroupsDataPath(), JSON.stringify(data, null, 2))
      return true
    } catch (err) {
      logger.error(`保存分组数据失败`, err)
      return false
    }
  }

  /**
   * 加载分组配置
   */
  public async loadGroupsData(): Promise<GroupsData|null> {
    const path = this.getGroupsDataPath()
    try {
      if (existsSync(path)) {
        const content = await fs.readFile(path, 'utf8')
        if (!content || content.trim() === '') {
          // 文件存在但为空，返回默认配置
          return this.getDefaultGroups()
        }

        try {
          const data = JSON.parse(content)
          if (data && Array.isArray(data.groups)) {
            return data as GroupsData
          }
        } catch (parseError) {
          logger.error(`解析分组数据失败: ${parseError.message}`)
          // JSON解析错误，返回默认配置
          return this.getDefaultGroups()
        }
      }
    } catch (err) {
      logger.error(`加载分组数据失败: ${err}`)
    }

    // 返回默认分组配置
    return this.getDefaultGroups()
  }

  /**
   * 获取默认分组配置
   */
  private getDefaultGroups(): GroupsData {
    return {
      groups: [
        {
          name: "所有命令",
          icon: "apps",
          commands: [] // 空数组表示包含所有命令
        }
      ],
      version: 1
    }
  }
}
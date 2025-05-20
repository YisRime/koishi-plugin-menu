import { Logger } from 'koishi'
import { promises as fs, existsSync } from 'fs'
import { join, resolve } from 'path'

const logger = new Logger('menu:style-manager')

export interface StyleConfig {
  backgroundColor: string
  titleColor: string
  headerColor: string
  fontFamily: string
  commandColor: string
  descriptionColor: string
  optionColor: string
  cardBackground: string
  codeBackground: string
  borderColor: string
  cardShadow: string
}

export interface Theme {
  id: string
  name: string
  styles: StyleConfig
}

/**
 * 样式管理类，负责提供和管理插件的样式配置
 */
export class StyleManager {
  /** 默认样式 (亮色主题) */
  private static readonly DEFAULT_STYLE: StyleConfig = {
    backgroundColor: "#f5f5f5",
    titleColor: "#333333",
    headerColor: "#2196f3",
    fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
    commandColor: "#333",
    descriptionColor: "rgba(0,0,0,0.6)",
    optionColor: "#555",
    cardBackground: "#fff",
    codeBackground: "rgba(128,128,128,0.1)",
    borderColor: "rgba(128,128,128,0.15)",
    cardShadow: "0 2px 4px -1px rgba(0,0,0,0.2), 0 4px 5px 0 rgba(0,0,0,0.14), 0 1px 10px 0 rgba(0,0,0,0.12)"
  }

  /** 暗色主题样式 */
  private static readonly DARK_STYLE: StyleConfig = {
    backgroundColor: "#212121",
    titleColor: "#e0e0e0",
    headerColor: "#1976d2",
    fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
    commandColor: "#e0e0e0",
    descriptionColor: "rgba(255,255,255,0.7)",
    optionColor: "#aaa",
    cardBackground: "#2d2d2d",
    codeBackground: "rgba(255,255,255,0.1)",
    borderColor: "rgba(255,255,255,0.1)",
    cardShadow: "0 2px 4px -1px rgba(0,0,0,0.5), 0 4px 5px 0 rgba(0,0,0,0.34), 0 1px 10px 0 rgba(0,0,0,0.32)"
  }

  /** 模板样式（温暖风格，将被保存到主题文件夹） */
  private static readonly TEMPLATE_STYLE: StyleConfig = {
    backgroundColor: "#fffbf0",
    titleColor: "#795548",
    headerColor: "#ff9800",
    fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
    commandColor: "#4e342e",
    descriptionColor: "rgba(0,0,0,0.7)",
    optionColor: "#5d4037",
    cardBackground: "#fff9e6",
    codeBackground: "rgba(121,85,72,0.1)",
    borderColor: "rgba(121,85,72,0.15)",
    cardShadow: "0 2px 4px -1px rgba(121,85,72,0.2), 0 4px 5px 0 rgba(121,85,72,0.14), 0 1px 10px 0 rgba(121,85,72,0.12)"
  }

  private themes: Map<string, Theme> = new Map() // 存储所有主题
  private currentThemeId: string // 当前主题ID
  private themesDir: string // 主题文件夹路径

  /**
   * 创建样式管理器实例
   * @param baseDir 基础目录路径
   * @param themeId 初始主题ID
   */
  constructor(baseDir: string, themeId: string = 'light') {
    this.themesDir = resolve(baseDir, 'data/menu/themes')
    this.currentThemeId = themeId
    logger.info(`样式管理器初始化: 主题ID=${themeId}`)
  }

  /**
   * 初始化主题系统
   */
  public async initialize(): Promise<void> {
    await fs.mkdir(this.themesDir, { recursive: true }) // 确保主题目录存在

    // 保存模板主题到主题文件夹
    await this.saveTemplateTheme()

    this.registerInternalThemes() // 注册内置主题
    await this.loadCustomThemes() // 加载自定义主题
    logger.info(`主题系统初始化完成，共加载 ${this.themes.size} 个主题`)
  }

  /**
   * 保存模板主题到主题文件夹，作为用户自定义的参考
   */
  private async saveTemplateTheme(): Promise<void> {
    const templatePath = join(this.themesDir, 'warm.json')

    try {
      // 检查文件是否已存在，避免覆盖用户的自定义修改
      if (!existsSync(templatePath)) {
        const templateTheme: Theme = {
          id: 'custom',
          name: '模板主题',
          styles: StyleManager.TEMPLATE_STYLE
        }

        await fs.writeFile(
          templatePath,
          JSON.stringify(templateTheme, null, 2),
          'utf8'
        )
        logger.info('已保存模板主题到主题文件夹')
      }
    } catch (error) {
      logger.error('保存模板主题失败:', error)
    }
  }

  /**
   * 注册内置主题
   */
  private registerInternalThemes(): void {
    // 只注册两个基本主题，warm主题通过文件加载
    this.registerTheme({ id: 'light', name: '亮色主题', styles: StyleManager.DEFAULT_STYLE })
    this.registerTheme({ id: 'dark', name: '暗色主题', styles: StyleManager.DARK_STYLE })
  }

  /**
   * 注册一个主题
   * @param theme 主题对象
   */
  public registerTheme(theme: Theme): void {
    if (!theme?.id || !theme.styles) {
      logger.warn('尝试注册无效的主题')
      return
    }
    this.themes.set(theme.id, theme)
    logger.debug(`已注册主题: ${theme.id} (${theme.name || '未命名'})`)
  }

  /**
   * 加载所有自定义主题文件
   */
  private async loadCustomThemes(): Promise<void> {
    try {
      const files = await fs.readdir(this.themesDir)
      const themeFiles = files.filter(file => file.endsWith('.json'))

      await Promise.all(themeFiles.map(async file => {
        try {
          const themeId = file.replace('.json', '')
          const themePath = join(this.themesDir, file)
          const themeData = JSON.parse(await fs.readFile(themePath, 'utf8'))

          if (themeData?.styles) {
            this.registerTheme({
              id: themeId,
              name: themeData.name || themeId,
              styles: themeData.styles
            })
            logger.debug(`从文件加载主题: ${themeId}`)
          }
        } catch (err) {
          logger.error(`加载主题文件 ${file} 失败:`, err)
        }
      }))
    } catch (err) {
      logger.error('加载自定义主题失败:', err)
    }
  }

  /**
   * 保存主题到文件
   * @param themeId 主题ID
   * @returns 是否保存成功
   */
  public async saveThemeToFile(themeId: string): Promise<boolean> {
    try {
      const theme = this.themes.get(themeId)
      if (!theme) {
        logger.warn(`尝试保存不存在的主题: ${themeId}`)
        return false
      }

      const themePath = join(this.themesDir, `${themeId}.json`)
      await fs.writeFile(themePath, JSON.stringify(theme, null, 2), 'utf8')
      logger.info(`主题已保存到文件: ${themeId}`)
      return true
    } catch (err) {
      logger.error(`保存主题 ${themeId} 失败:`, err)
      return false
    }
  }

  /**
   * 获取当前的样式配置
   * @returns 当前样式配置对象
   */
  public getStyle(): StyleConfig {
    const theme = this.themes.get(this.currentThemeId)
    if (!theme) {
      logger.warn(`主题 ${this.currentThemeId} 不存在，使用默认主题`)
      return StyleManager.DEFAULT_STYLE
    }
    return theme.styles
  }

  /**
   * 更新当前主题
   * @param themeId 主题ID
   * @returns 是否更新成功
   */
  public updateTheme(themeId: string): boolean {
    if (!this.themes.has(themeId)) {
      logger.warn(`尝试切换到不存在的主题: ${themeId}`)
      return false
    }
    this.currentThemeId = themeId
    logger.info(`主题已更新: ${themeId}`)
    return true
  }

  /**
   * 获取当前的主题ID
   * @returns 主题ID
   */
  public getThemeId(): string {
    return this.currentThemeId
  }

  /**
   * 获取所有可用主题
   * @returns 主题列表
   */
  public getAvailableThemes(): Theme[] {
    return Array.from(this.themes.values())
  }

  /**
   * 获取公共CSS样式模板
   * @returns CSS样式字符串
   */
  public getStyleSheet(): string {
    const style = this.getStyle()
    return `
      .ocr-container { max-width: 800px; margin: 0 auto; background-color: ${style.backgroundColor}; padding: 20px; font-family: ${style.fontFamily}; }
      .material-card { border-radius: 10px; overflow: hidden; background-color: ${style.cardBackground}; box-shadow: ${style.cardShadow}; margin: 4px; padding: 12px; }
      .ocr-header { margin-bottom: 16px; padding: 16px; }
      .category { margin-bottom: 16px; padding: 16px; }
      .command-item { padding: 12px 0; }
      .command-header { margin-bottom: 6px; }
      .command-name { font-weight: 500; font-size: 16px; }
      .command-description { margin: 4px 0; font-size: 14px; }
      .command-usage, pre { margin-top: 8px; background: ${style.codeBackground}; border-radius: 4px; padding: 8px; }
      pre { margin: 0; white-space: pre-wrap; font-size: 13px; }
      .command-options, .command-examples { margin-top: 8px; }
      .options-title, .examples-title { font-weight: 500; margin-bottom: 4px; }
      code { background: ${style.codeBackground}; padding: 2px 4px; border-radius: 3px; font-family: monospace; }
      ul { margin-top: 4px; padding-left: 20px; }
      li { margin-bottom: 4px; }
      .command-item:not(:last-child) { border-bottom: 1px solid ${style.borderColor}; }
    `
  }
}

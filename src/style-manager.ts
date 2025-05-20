import { Logger } from 'koishi'
import { promises as fs, existsSync } from 'fs'
import { join, resolve } from 'path'

const logger = new Logger('menu:style-manager')

export interface StyleConfig {
  // 基础颜色
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
  subCommandBorderColor: string
  categoryHeaderBackground: string
  commandHoverBackground: string
  badgeBackground: string
  badgeColor: string
  tagBackground: string
  tagColor: string
  dividerColor: string
  maxWidth: string

  // 圆角和间距设置
  cardBorderRadius: string
  commandItemBorderRadius: string
  headerBorderRadius: string
  badgeBorderRadius: string
  tagBorderRadius: string
  containerPadding: string
  cardPadding: string
  commandItemPadding: string

  // 网格布局设置
  gridGap: string
  gridMinWidth: string
  gridTemplateColumns: string

  // 图标设置
  iconColor: string
  iconSize: string
  headerIconColor: string
  headerIconSize: string

  // 高级卡片效果
  cardElevation: string
  headerTextShadow: string
  secondaryBackground: string

  // 响应式布局断点
  mobileBreakpoint: string

  // 分组相关设置
  groupHeaderBackground: string
  groupHeaderColor: string
  groupHeaderBorderRadius: string
  groupHeaderPadding: string
  groupMarginBottom: string
  groupIconSize: string
  groupHeaderFontSize: string
  groupHeaderFontWeight: string

  // 页面标题设置
  pageTitleBackground: string
  pageTitleColor: string
  pageTitlePadding: string
  pageTitleBorderRadius: string
  pageTitleFontSize: string
  pageTitleFontWeight: string
  pageTitleMarginBottom: string
  pageTitleIconSize: string

  // 卡片网格设置
  cardGridGap: string

  // 菜单项目设置
  menuItemIconSize: string
  menuItemNameFontSize: string
  menuItemDescriptionFontSize: string
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
    backgroundColor: "#f8f9fa",
    titleColor: "#333333",
    headerColor: "#2196f3",
    fontFamily: '"Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif',
    commandColor: "#333",
    descriptionColor: "rgba(0,0,0,0.65)",
    optionColor: "#555",
    cardBackground: "#fff",
    codeBackground: "rgba(128,128,128,0.08)",
    borderColor: "rgba(128,128,128,0.15)",
    cardShadow: "0 2px 8px rgba(0,0,0,0.12)",
    subCommandBorderColor: "rgba(33,150,243,0.2)",
    categoryHeaderBackground: "linear-gradient(135deg, #42a5f5, #2196f3)",
    commandHoverBackground: "rgba(33,150,243,0.05)",
    badgeBackground: "#2196f3",
    badgeColor: "white",
    tagBackground: "rgba(33,150,243,0.1)",
    tagColor: "#0d47a1",
    dividerColor: "rgba(0,0,0,0.1)",
    maxWidth: "520px",

    // 圆角和间距设置
    cardBorderRadius: "12px",
    commandItemBorderRadius: "8px",
    headerBorderRadius: "12px 12px 0 0",
    badgeBorderRadius: "12px",
    tagBorderRadius: "6px",
    containerPadding: "12px",
    cardPadding: "0",
    commandItemPadding: "12px",

    // 网格布局设置
    gridGap: "12px",
    gridMinWidth: "220px",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",

    // 图标设置
    iconColor: "#2196f3",
    iconSize: "16px",
    headerIconColor: "white",
    headerIconSize: "18px",

    // 高级卡片效果
    cardElevation: "0 4px 12px rgba(0,0,0,0.1)",
    headerTextShadow: "0 1px 2px rgba(0,0,0,0.1)",
    secondaryBackground: "#f0f4f8",

    // 响应式布局断点
    mobileBreakpoint: "480px",

    // 分组相关设置
    groupHeaderBackground: "linear-gradient(135deg, #64b5f6, #1976d2)",
    groupHeaderColor: "white",
    groupHeaderBorderRadius: "10px",
    groupHeaderPadding: "10px 16px",
    groupMarginBottom: "24px",
    groupIconSize: "20px",
    groupHeaderFontSize: "16px",
    groupHeaderFontWeight: "500",

    // 页面标题设置
    pageTitleBackground: "linear-gradient(135deg, #2196f3, #0d47a1)",
    pageTitleColor: "white",
    pageTitlePadding: "16px 20px",
    pageTitleBorderRadius: "12px",
    pageTitleFontSize: "18px",
    pageTitleFontWeight: "600",
    pageTitleMarginBottom: "20px",
    pageTitleIconSize: "24px",

    // 卡片网格设置
    cardGridGap: "12px",

    // 菜单项目设置
    menuItemIconSize: "18px",
    menuItemNameFontSize: "14px",
    menuItemDescriptionFontSize: "12px"
  }

  /** 暗色主题样式 */
  private static readonly DARK_STYLE: StyleConfig = {
    backgroundColor: "#121212",
    titleColor: "#e0e0e0",
    headerColor: "#1976d2",
    fontFamily: '"Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif',
    commandColor: "#ddd",
    descriptionColor: "rgba(255,255,255,0.7)",
    optionColor: "#aaa",
    cardBackground: "#1e1e1e",
    codeBackground: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.1)",
    cardShadow: "0 2px 8px rgba(0,0,0,0.5)",
    subCommandBorderColor: "rgba(33,150,243,0.3)",
    categoryHeaderBackground: "linear-gradient(135deg, #1976d2, #0d47a1)",
    commandHoverBackground: "rgba(25,118,210,0.15)",
    badgeBackground: "#1976d2",
    badgeColor: "white",
    tagBackground: "rgba(25,118,210,0.2)",
    tagColor: "#90caf9",
    dividerColor: "rgba(255,255,255,0.1)",
    maxWidth: "520px",

    // 圆角和间距设置
    cardBorderRadius: "12px",
    commandItemBorderRadius: "8px",
    headerBorderRadius: "12px 12px 0 0",
    badgeBorderRadius: "12px",
    tagBorderRadius: "6px",
    containerPadding: "12px",
    cardPadding: "0",
    commandItemPadding: "12px",

    // 网格布局设置
    gridGap: "12px",
    gridMinWidth: "220px",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",

    // 图标设置
    iconColor: "#42a5f5",
    iconSize: "16px",
    headerIconColor: "white",
    headerIconSize: "18px",

    // 高级卡片效果
    cardElevation: "0 4px 12px rgba(0,0,0,0.25)",
    headerTextShadow: "0 1px 3px rgba(0,0,0,0.3)",
    secondaryBackground: "#2a2a2a",

    // 响应式布局断点
    mobileBreakpoint: "480px",

    // 分组相关设置
    groupHeaderBackground: "linear-gradient(135deg, #1976d2, #0d47a1)",
    groupHeaderColor: "white",
    groupHeaderBorderRadius: "10px",
    groupHeaderPadding: "10px 16px",
    groupMarginBottom: "24px",
    groupIconSize: "20px",
    groupHeaderFontSize: "16px",
    groupHeaderFontWeight: "500",

    // 页面标题设置
    pageTitleBackground: "linear-gradient(135deg, #1976d2, #0a3880)",
    pageTitleColor: "white",
    pageTitlePadding: "16px 20px",
    pageTitleBorderRadius: "12px",
    pageTitleFontSize: "18px",
    pageTitleFontWeight: "600",
    pageTitleMarginBottom: "20px",
    pageTitleIconSize: "24px",

    // 卡片网格设置
    cardGridGap: "12px",

    // 菜单项目设置
    menuItemIconSize: "18px",
    menuItemNameFontSize: "14px",
    menuItemDescriptionFontSize: "12px"
  }

  /** 模板样式（将被保存到主题文件夹） */
  private static readonly TEMPLATE_STYLE: StyleConfig = {
    backgroundColor: "#fffbf0",
    titleColor: "#795548",
    headerColor: "#ff9800",
    fontFamily: '"Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif',
    commandColor: "#4e342e",
    descriptionColor: "rgba(0,0,0,0.65)",
    optionColor: "#5d4037",
    cardBackground: "#fff9e6",
    codeBackground: "rgba(121,85,72,0.08)",
    borderColor: "rgba(121,85,72,0.15)",
    cardShadow: "0 2px 8px rgba(121,85,72,0.15)",
    subCommandBorderColor: "rgba(255,152,0,0.3)",
    categoryHeaderBackground: "linear-gradient(135deg, #ff9800, #ef6c00)",
    commandHoverBackground: "rgba(255,152,0,0.08)",
    badgeBackground: "#e65100",
    badgeColor: "white",
    tagBackground: "rgba(255,152,0,0.1)",
    tagColor: "#e65100",
    dividerColor: "rgba(121,85,72,0.15)",
    maxWidth: "520px",

    // 圆角和间距设置
    cardBorderRadius: "16px",
    commandItemBorderRadius: "10px",
    headerBorderRadius: "16px 16px 0 0",
    badgeBorderRadius: "16px",
    tagBorderRadius: "8px",
    containerPadding: "16px",
    cardPadding: "0",
    commandItemPadding: "12px",

    // 网格布局设置
    gridGap: "16px",
    gridMinWidth: "220px",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",

    // 图标设置
    iconColor: "#ff9800",
    iconSize: "16px",
    headerIconColor: "white",
    headerIconSize: "18px",

    // 高级卡片效果
    cardElevation: "0 4px 16px rgba(121,85,72,0.2)",
    headerTextShadow: "0 1px 2px rgba(0,0,0,0.1)",
    secondaryBackground: "#fff0d9",

    // 响应式布局断点
    mobileBreakpoint: "480px",

    // 分组相关设置
    groupHeaderBackground: "linear-gradient(135deg, #ffb74d, #ff9800)",
    groupHeaderColor: "white",
    groupHeaderBorderRadius: "12px",
    groupHeaderPadding: "10px 16px",
    groupMarginBottom: "24px",
    groupIconSize: "20px",
    groupHeaderFontSize: "16px",
    groupHeaderFontWeight: "500",

    // 页面标题设置
    pageTitleBackground: "linear-gradient(135deg, #ff9800, #e65100)",
    pageTitleColor: "white",
    pageTitlePadding: "16px 20px",
    pageTitleBorderRadius: "16px",
    pageTitleFontSize: "18px",
    pageTitleFontWeight: "600",
    pageTitleMarginBottom: "20px",
    pageTitleIconSize: "24px",

    // 卡片网格设置
    cardGridGap: "14px",

    // 菜单项目设置
    menuItemIconSize: "18px",
    menuItemNameFontSize: "14px",
    menuItemDescriptionFontSize: "12px"
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
    const templatePath = join(this.themesDir, 'custom.json')

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
      /* 基础容器样式 */
      .ocr-container {
        max-width: ${style.maxWidth};
        margin: 0;
        background-color: ${style.backgroundColor};
        padding: ${style.containerPadding};
        font-family: ${style.fontFamily};
        border-radius: ${style.cardBorderRadius};
        overflow: hidden;
      }

      /* 卡片样式 */
      .material-card {
        border-radius: ${style.cardBorderRadius};
        background-color: ${style.cardBackground};
        box-shadow: ${style.cardShadow};
        overflow: hidden;
        padding: ${style.cardPadding};
      }

      /* 页面标题样式 */
      .page-title {
        background: ${style.pageTitleBackground};
        color: ${style.pageTitleColor};
        padding: ${style.pageTitlePadding};
        border-radius: ${style.pageTitleBorderRadius};
        font-size: ${style.pageTitleFontSize};
        font-weight: ${style.pageTitleFontWeight};
        margin-bottom: ${style.pageTitleMarginBottom};
        display: flex;
        align-items: center;
        justify-content: center;
        text-shadow: ${style.headerTextShadow};
        box-shadow: ${style.cardElevation};
      }
      .page-title i {
        margin-right: 8px;
        font-size: ${style.pageTitleIconSize};
        color: ${style.headerIconColor};
      }

      /* 分组样式 */
      .command-group {
        margin-bottom: ${style.groupMarginBottom};
      }
      .group-header {
        background: ${style.groupHeaderBackground};
        color: ${style.groupHeaderColor};
        padding: ${style.groupHeaderPadding};
        border-radius: ${style.groupHeaderBorderRadius};
        font-size: ${style.groupHeaderFontSize};
        font-weight: ${style.groupHeaderFontWeight};
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        text-shadow: ${style.headerTextShadow};
        box-shadow: ${style.cardElevation};
      }
      .group-header i {
        margin-right: 8px;
        font-size: ${style.groupIconSize};
        color: ${style.headerIconColor};
      }
      .group-content {
        display: grid;
        grid-template-columns: ${style.gridTemplateColumns};
        gap: ${style.cardGridGap};
      }

      /* 命令容器样式 */
      .commands-card { margin: 0; }
      .category-header {
        padding: 14px 16px;
        background: ${style.categoryHeaderBackground};
        color: white;
        font-size: 16px;
        font-weight: 500;
        text-align: center;
        border-radius: ${style.headerBorderRadius};
        display: flex;
        align-items: center;
        justify-content: center;
        text-shadow: ${style.headerTextShadow};
      }
      .category-header i {
        margin-right: 8px;
        font-size: ${style.headerIconSize};
        color: ${style.headerIconColor};
      }
      .commands-container { padding: 12px; }

      /* 命令项样式 */
      .command-item {
        padding: ${style.commandItemPadding};
        margin-bottom: 8px;
        border-radius: ${style.commandItemBorderRadius};
        border: 1px solid ${style.borderColor};
        background-color: ${style.cardBackground};
        position: relative;
      }
      .command-item:hover {
        background-color: ${style.commandHoverBackground};
      }
      .command-header {
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .command-name {
        font-weight: 500;
        font-size: ${style.menuItemNameFontSize};
        color: ${style.commandColor};
        display: flex;
        align-items: center;
      }
      .command-name i {
        margin-right: 6px;
        font-size: ${style.menuItemIconSize};
        color: ${style.iconColor};
      }
      .command-description {
        margin: 5px 0;
        font-size: ${style.menuItemDescriptionFontSize};
        color: ${style.descriptionColor};
        line-height: 1.5;
      }

      /* 标签和徽章样式 */
      .command-badge {
        background: ${style.badgeBackground};
        color: ${style.badgeColor};
        font-size: 10px;
        padding: 2px 8px;
        border-radius: ${style.badgeBorderRadius};
        margin-left: 8px;
        display: inline-flex;
        align-items: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      .command-badge i {
        margin-right: 3px;
        font-size: 10px;
      }
      .command-tag {
        display: inline-flex;
        align-items: center;
        background: ${style.tagBackground};
        color: ${style.tagColor};
        font-size: 10px;
        padding: 2px 6px;
        border-radius: ${style.tagBorderRadius};
        margin-right: 4px;
        margin-bottom: 4px;
      }
      .command-tag i {
        margin-right: 3px;
        font-size: 10px;
      }

      /* 代码和预格式化文本 */
      .command-usage, pre {
        margin-top: 8px;
        background: ${style.codeBackground};
        border-radius: ${style.commandItemBorderRadius};
        padding: 8px;
        overflow-x: auto;
        font-size: 11px;
      }
      pre {
        margin: 4px 0;
        white-space: pre-wrap;
        font-size: 11px;
      }

      /* 标题和分组 */
      .command-options, .command-examples { margin-top: 10px; }
      .options-title, .examples-title, .subcommands-title {
        font-weight: 500;
        margin-bottom: 6px;
        color: ${style.commandColor};
        font-size: 12px;
        display: flex;
        align-items: center;
      }
      .options-title i, .examples-title i, .subcommands-title i {
        margin-right: 4px;
        color: ${style.iconColor};
        font-size: ${style.iconSize};
      }

      /* 网格布局 */
      .options-grid {
        display: grid;
        grid-template-columns: ${style.gridTemplateColumns};
        gap: ${style.gridGap};
      }
      .option-item {
        padding: 8px;
        border-radius: ${style.tagBorderRadius};
        background: ${style.codeBackground};
        font-size: 11px;
      }
      code {
        background: ${style.codeBackground};
        padding: 1px 3px;
        border-radius: 3px;
        font-family: monospace;
        font-size: 11px;
      }

      /* 列表样式 */
      ul { margin-top: 4px; padding-left: 20px; }
      li { margin-bottom: 4px; font-size: 11px; }

      /* 子命令样式 */
      .subcommands {
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px dashed ${style.dividerColor};
      }
      .subcommand-list {
        display: grid;
        grid-template-columns: ${style.gridTemplateColumns};
        gap: ${style.gridGap};
      }
      .subcommand-item {
        padding: 8px;
        border-radius: ${style.commandItemBorderRadius};
        border: 1px solid ${style.subCommandBorderColor};
        font-size: 11px;
        background-color: ${style.secondaryBackground};
      }
      .subcommand-name {
        color: ${style.commandColor};
        font-weight: 500;
        margin-bottom: 3px;
        font-size: 12px;
        display: flex;
        align-items: center;
      }
      .subcommand-name i {
        margin-right: 4px;
        color: ${style.iconColor};
        font-size: 12px;
      }
      .subcommand-desc {
        font-size: 10px;
        color: ${style.descriptionColor};
        line-height: 1.4;
      }

      /* 命令网格布局 */
      .command-row {
        display: grid;
        grid-template-columns: ${style.gridTemplateColumns};
        gap: ${style.gridGap};
        margin-bottom: 8px;
      }

      /* 图标字体 */
      @font-face {
        font-family: 'Material Icons';
        font-style: normal;
        font-weight: 400;
        src: url(https://fonts.gstatic.com/s/materialicons/v140/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2) format('woff2');
      }
      .material-icons {
        font-family: 'Material Icons';
        font-weight: normal;
        font-style: normal;
        font-size: ${style.iconSize};
        line-height: 1;
        letter-spacing: normal;
        text-transform: none;
        display: inline-block;
        white-space: nowrap;
        word-wrap: normal;
        direction: ltr;
        -webkit-font-smoothing: antialiased;
      }

      /* 响应式布局 */
      @media (max-width: ${style.mobileBreakpoint}) {
        .command-row, .options-grid, .subcommand-list, .group-content {
          grid-template-columns: 1fr;
        }
        .ocr-container {
          padding: 8px;
        }
        .command-item {
          padding: 10px;
        }
      }
    `
  }
}

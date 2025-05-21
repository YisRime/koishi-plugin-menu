import { promises as fs, existsSync } from 'fs'
import { join, resolve } from 'path'
import { logger } from './index'

export interface StyleConfig {
  // 基础颜色
  backgroundColor: string
  titleColor: string
  fontFamily: string
  commandColor: string
  descriptionColor: string
  optionColor: string
  cardBackground: string
  codeBackground: string
  borderColor: string
  cardShadow: string
  subCommandBorderColor: string
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

  // 高级卡片效果
  cardElevation: string
  headerTextShadow: string
  secondaryBackground: string

  // 响应式布局断点
  mobileBreakpoint: string

  // 分组相关设置
  groupTitleBackground: string
  groupTitleTextColor: string
  groupTitleBorderRadius: string
  groupTitlePadding: string
  groupMarginBottom: string
  groupTitleIconSize: string
  groupTitleIconColor: string
  groupTitleFontSize: string
  groupTitleFontWeight: string
  groupContentPadding: string
  groupGridGap: string

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
 * 样式管理类
 */
export class Style {
  /** 默认样式 (亮色主题) */
  private static readonly LIGHT: StyleConfig = {
    backgroundColor: "#f8f9fa",
    titleColor: "#333333",
    fontFamily: '"Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif',
    commandColor: "#333",
    descriptionColor: "rgba(0,0,0,0.65)",
    optionColor: "#555",
    cardBackground: "#fff",
    codeBackground: "rgba(128,128,128,0.08)",
    borderColor: "rgba(128,128,128,0.15)",
    cardShadow: "0 2px 8px rgba(0,0,0,0.12)",
    subCommandBorderColor: "rgba(33,150,243,0.2)",
    commandHoverBackground: "rgba(33,150,243,0.05)",
    badgeBackground: "#2196f3",
    badgeColor: "white",
    tagBackground: "rgba(33,150,243,0.1)",
    tagColor: "#0d47a1",
    dividerColor: "rgba(0,0,0,0.1)",
    maxWidth: "520px",

    // 圆角和间距设置
    cardBorderRadius: "12px",
    commandItemBorderRadius: "10px",
    badgeBorderRadius: "12px",
    tagBorderRadius: "6px",
    containerPadding: "16px",
    cardPadding: "0",
    commandItemPadding: "12px",

    // 网格布局设置
    gridGap: "12px",
    gridMinWidth: "220px",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",

    // 图标设置
    iconColor: "#2196f3",
    iconSize: "16px",

    // 高级卡片效果
    cardElevation: "0 4px 12px rgba(0,0,0,0.1)",
    headerTextShadow: "0 1px 2px rgba(0,0,0,0.1)",
    secondaryBackground: "#f0f4f8",

    // 响应式布局断点
    mobileBreakpoint: "480px",

    // 分组相关设置
    groupTitleBackground: "transparent",
    groupTitleTextColor: "#1976d2",
    groupTitleBorderRadius: "8px",
    groupTitlePadding: "12px 16px",
    groupMarginBottom: "20px",
    groupTitleIconSize: "22px",
    groupTitleIconColor: "#1976d2",
    groupTitleFontSize: "18px",
    groupTitleFontWeight: "600",
    groupContentPadding: "0px",
    groupGridGap: "12px",

    // 菜单项目设置
    menuItemIconSize: "18px",
    menuItemNameFontSize: "14px",
    menuItemDescriptionFontSize: "12px"
  }

  /** 暗色主题样式 */
  private static readonly DARK: StyleConfig = {
    backgroundColor: "#121212",
    titleColor: "#e0e0e0",
    fontFamily: '"Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif',
    commandColor: "#ddd",
    descriptionColor: "rgba(255,255,255,0.7)",
    optionColor: "#aaa",
    cardBackground: "#1e1e1e",
    codeBackground: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.1)",
    cardShadow: "0 2px 8px rgba(0,0,0,0.5)",
    subCommandBorderColor: "rgba(33,150,243,0.3)",
    commandHoverBackground: "rgba(25,118,210,0.15)",
    badgeBackground: "#1976d2",
    badgeColor: "white",
    tagBackground: "rgba(25,118,210,0.2)",
    tagColor: "#90caf9",
    dividerColor: "rgba(255,255,255,0.1)",
    maxWidth: "520px",

    // 圆角和间距设置
    cardBorderRadius: "12px",
    commandItemBorderRadius: "10px",
    badgeBorderRadius: "12px",
    tagBorderRadius: "6px",
    containerPadding: "16px",
    cardPadding: "0",
    commandItemPadding: "12px",

    // 网格布局设置
    gridGap: "12px",
    gridMinWidth: "220px",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",

    // 图标设置
    iconColor: "#42a5f5",
    iconSize: "16px",

    // 高级卡片效果
    cardElevation: "0 4px 12px rgba(0,0,0,0.25)",
    headerTextShadow: "0 1px 3px rgba(0,0,0,0.3)",
    secondaryBackground: "#2a2a2a",

    // 响应式布局断点
    mobileBreakpoint: "480px",

    // 分组相关设置
    groupTitleBackground: "transparent",
    groupTitleTextColor: "#64b5f6",
    groupTitleBorderRadius: "8px",
    groupTitlePadding: "12px 16px",
    groupMarginBottom: "20px",
    groupTitleIconSize: "22px",
    groupTitleIconColor: "#64b5f6",
    groupTitleFontSize: "18px",
    groupTitleFontWeight: "600",
    groupContentPadding: "0px",
    groupGridGap: "12px",

    // 菜单项目设置
    menuItemIconSize: "18px",
    menuItemNameFontSize: "14px",
    menuItemDescriptionFontSize: "12px"
  }

  /** 模板样式 */
  private static readonly TEMPLATE: StyleConfig = {
    backgroundColor: "#fffbf0",
    titleColor: "#795548",
    fontFamily: '"Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif',
    commandColor: "#4e342e",
    descriptionColor: "rgba(0,0,0,0.65)",
    optionColor: "#5d4037",
    cardBackground: "#fff9e6",
    codeBackground: "rgba(121,85,72,0.08)",
    borderColor: "rgba(121,85,72,0.15)",
    cardShadow: "0 2px 8px rgba(121,85,72,0.15)",
    subCommandBorderColor: "rgba(255,152,0,0.3)",
    commandHoverBackground: "rgba(255,152,0,0.08)",
    badgeBackground: "#e65100",
    badgeColor: "white",
    tagBackground: "rgba(255,152,0,0.1)",
    tagColor: "#e65100",
    dividerColor: "rgba(121,85,72,0.15)",
    maxWidth: "520px",

    // 圆角和间距设置
    cardBorderRadius: "16px",
    commandItemBorderRadius: "12px",
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

    // 高级卡片效果
    cardElevation: "0 4px 16px rgba(121,85,72,0.2)",
    headerTextShadow: "0 1px 2px rgba(0,0,0,0.1)",
    secondaryBackground: "#fff0d9",

    // 响应式布局断点
    mobileBreakpoint: "480px",

    // 分组相关设置
    groupTitleBackground: "transparent",
    groupTitleTextColor: "#ef6c00",
    groupTitleBorderRadius: "10px",
    groupTitlePadding: "12px 16px",
    groupMarginBottom: "20px",
    groupTitleIconSize: "22px",
    groupTitleIconColor: "#ef6c00",
    groupTitleFontSize: "18px",
    groupTitleFontWeight: "600",
    groupContentPadding: "0px",
    groupGridGap: "14px",

    // 菜单项目设置
    menuItemIconSize: "18px",
    menuItemNameFontSize: "14px",
    menuItemDescriptionFontSize: "12px"
  }

  private themes = new Map<string, Theme>()
  private curThemeId: string
  private themeDir: string

  /**
   * 创建样式管理器
   */
  constructor(baseDir: string, themeId: string = 'light') {
    this.themeDir = resolve(baseDir, 'data/menu/themes')
    this.curThemeId = themeId
  }

  /**
   * 初始化主题系统
   */
  public async initialize(): Promise<void> {
    await fs.mkdir(this.themeDir, { recursive: true })

    // 保存模板主题
    try {
      const path = join(this.themeDir, 'custom.json')
      if (!existsSync(path)) {
        await fs.writeFile(
          path,
          JSON.stringify({ id: 'custom', name: '模板主题', styles: Style.TEMPLATE }, null, 2),
          'utf8'
        )
      }
    } catch (err) {
      logger.error('保存模板主题失败:', err)
    }

    // 注册内置主题
    this.addTheme({ id: 'light', name: '亮色主题', styles: Style.LIGHT })
    this.addTheme({ id: 'dark', name: '暗色主题', styles: Style.DARK })

    // 加载自定义主题
    try {
      const files = await fs.readdir(this.themeDir)
      await Promise.all(files
        .filter(file => file.endsWith('.json'))
        .map(async file => {
          try {
            const id = file.replace('.json', '')
            const data = JSON.parse(await fs.readFile(join(this.themeDir, file), 'utf8'))
            if (data?.styles) this.addTheme({ id, name: data.name || id, styles: data.styles })
          } catch (err) {
            logger.error(`加载主题文件 ${file} 失败:`, err)
          }
        }))
    } catch (err) {
      logger.error('加载自定义主题失败:', err)
    }
  }

  public addTheme(theme: Theme): void {
    if (theme?.id && theme.styles) this.themes.set(theme.id, theme)
  }

  public getStyle(): StyleConfig {
    const theme = this.themes.get(this.curThemeId)
    if (!theme) {
      logger.error(`主题 ${this.curThemeId} 不存在，使用默认主题`)
      return Style.LIGHT
    }
    return theme.styles
  }

  public setTheme(themeId: string): boolean {
    if (!this.themes.has(themeId)) {
      logger.error(`尝试切换到不存在的主题: ${themeId}`)
      return false
    }
    this.curThemeId = themeId
    return true
  }

  public getThemeId(): string { return this.curThemeId }
  public getAvailableThemes(): Theme[] { return Array.from(this.themes.values()) }

  /**
   * 获取CSS样式
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
        overflow: hidden;
      }

      /* 命令项样式 (Command Card) */
      .command-item {
        padding: ${style.commandItemPadding};
        border-radius: ${style.commandItemBorderRadius};
        border: 1px solid ${style.borderColor};
        background-color: ${style.cardBackground};
        box-shadow: ${style.cardShadow};
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
      }
      .command-item:hover {
        background-color: ${style.commandHoverBackground};
        transform: translateY(-2px);
        box-shadow: ${style.cardElevation};
      }
      .command-header {
        margin-bottom: 6px;
        display: flex;
        align-items: center;
      }
      .command-name {
        font-weight: 500;
        font-size: ${style.menuItemNameFontSize};
        color: ${style.commandColor};
        display: flex;
        align-items: center;
      }
      .command-name i {
        margin-right: 8px;
        font-size: ${style.menuItemIconSize};
        color: ${style.iconColor};
      }
      .command-description {
        margin: 5px 0;
        font-size: ${style.menuItemDescriptionFontSize};
        color: ${style.descriptionColor};
        line-height: 1.5;
        flex-grow: 1;
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
        .options-grid, .subcommand-list, .group-content {
          grid-template-columns: 1fr;
        }
        .ocr-container {
          padding: ${Number.parseInt(style.containerPadding) / 2}px;
        }
        .command-item {
          padding: ${Number.parseInt(style.commandItemPadding) / 1.2}px;
        }
        .group-title-header {
          padding: ${Number.parseInt(style.groupTitlePadding) / 1.2}px;
          font-size: ${Number.parseInt(style.groupTitleFontSize) * 0.9}px;
        }
        .group-title-header i {
          font-size: ${Number.parseInt(style.groupTitleIconSize) * 0.9}px;
        }
      }

      /* 分组相关设置 */
      .command-group {
        margin-bottom: ${style.groupMarginBottom};
      }
      .group-title-header {
        background: ${style.groupTitleBackground};
        color: ${style.groupTitleTextColor};
        padding: ${style.groupTitlePadding};
        border-radius: ${style.groupTitleBorderRadius};
        font-size: ${style.groupTitleFontSize};
        font-weight: ${style.groupTitleFontWeight};
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        text-shadow: ${style.headerTextShadow};
      }
      .group-title-header i {
        margin-right: 10px;
        font-size: ${style.groupTitleIconSize};
        color: ${style.groupTitleIconColor};
      }
      .group-content {
        display: grid;
        grid-template-columns: ${style.gridTemplateColumns};
        gap: ${style.groupGridGap};
        padding: ${style.groupContentPadding};
      }
    `
  }
}

import { Logger } from 'koishi'

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

/**
 * 样式管理类，负责提供和管理插件的样式配置
 */
export class StyleManager {
  /**
   * 默认样式 (亮色主题)
   */
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

  /**
   * 暗色主题样式
   */
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

  /**
   * 自定义样式
   */
  private static readonly CUSTOM_STYLE: StyleConfig = {
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

  private isDarkMode: boolean
  private isCustomStyle: boolean

  constructor(isDarkMode: boolean = false, useCustomStyle: boolean = false) {
    this.isDarkMode = isDarkMode
    this.isCustomStyle = useCustomStyle
    logger.info(`样式管理器初始化: ${useCustomStyle ? '自定义样式' : (isDarkMode ? '暗色主题' : '亮色主题')}`)
  }

  /**
   * 获取当前的样式配置
   * @returns {StyleConfig} 当前样式配置对象
   */
  public getStyle(): StyleConfig {
    if (this.isCustomStyle) {
      return StyleManager.CUSTOM_STYLE
    }
    return this.isDarkMode ? StyleManager.DARK_STYLE : StyleManager.DEFAULT_STYLE
  }

  /**
   * 更新样式设置
   * @param {boolean} isDarkMode - 是否使用暗色模式
   * @param {boolean} useCustomStyle - 是否使用自定义样式
   */
  public updateStyle(isDarkMode: boolean, useCustomStyle: boolean): void {
    this.isDarkMode = isDarkMode
    this.isCustomStyle = useCustomStyle
    logger.info(`样式已更新: ${useCustomStyle ? '自定义样式' : (isDarkMode ? '暗色主题' : '亮色主题')}`)
  }

  /**
   * 获取当前的主题标识
   * @returns {string} 主题标识字符串
   */
  public getThemeIdentifier(): string {
    return this.isCustomStyle ? 'custom' : (this.isDarkMode ? 'dark' : 'light')
  }

  /**
   * 获取公共CSS样式模板
   * @returns {string} CSS样式字符串
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

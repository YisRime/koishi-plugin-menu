import { Context, Logger } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import { CommandData, CategoryData } from './command-extractor'
import { StyleManager } from './style-manager'

const logger = new Logger('menu:image-renderer')

export interface RenderConfig {
  title?: string
  description?: string
}

/**
 * 图片渲染类，负责将命令数据渲染为HTML和图像
 */
export class ImageRenderer {
  private ctx: Context
  private styleManager: StyleManager

  constructor(ctx: Context, styleManager: StyleManager) {
    this.ctx = ctx
    this.styleManager = styleManager
    logger.info('图像渲染器初始化完成')
  }

  /**
   * 渲染HTML为图片
   * @param {string} html - HTML内容
   * @returns {Promise<Buffer>} 图片数据
   */
  public async renderToImage(html: string): Promise<Buffer> {
    const page = await this.ctx.puppeteer.page()

    try {
      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                margin: 0;
                padding: 0;
                font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
                background: transparent;
                color: rgba(0, 0, 0, 0.87);
                font-size: 14px;
                line-height: 1.4;
                -webkit-font-smoothing: antialiased;
              }
            </style>
          </head>
          <body>${html}</body>
        </html>
      `)

      // 获取内容尺寸并调整视窗
      const dimensions = await page.evaluate(() => ({
        width: Math.max(document.body.scrollWidth, document.documentElement.clientWidth),
        height: document.body.scrollHeight
      }))

      await page.setViewport({
        width: dimensions.width,
        height: dimensions.height,
        deviceScaleFactor: 2
      })

      // 等待图片加载
      await page.evaluate(() => {
        const imgPromises = Array.from(document.querySelectorAll('img')).map(
          img => img.complete ? Promise.resolve() : new Promise(resolve => {
            img.addEventListener('load', resolve)
            img.addEventListener('error', resolve)
          })
        )
        return Promise.all(imgPromises)
      })

      // 截图
      return await page.screenshot({
        type: 'png',
        fullPage: true,
        omitBackground: true
      })
    } catch (error) {
      logger.error('图片渲染出错:', error)
      throw new Error(`图片渲染出错: ${error.message || '未知错误'}`)
    } finally {
      await page.close().catch(() => {})
    }
  }

  /**
   * 生成命令列表的HTML
   * @param {CategoryData[]} categories - 分类数据
   * @param {RenderConfig} config - 渲染配置
   * @returns {string} HTML字符串
   */
  public generateCommandListHTML(categories: CategoryData[], config: RenderConfig = {}): string {
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      logger.warn('无效的分类数据')
      categories = [{
        name: '命令列表',
        commands: []
      }]
    }

    const title = config.title || "命令帮助"
    const description = config.description || ""

    const content = `
      ${this.renderHeader(title, description)}
      ${categories.map(category => this.renderCategory(category)).join("")}
    `

    return this.wrapInContainer(content)
  }

  /**
   * 生成单个命令的HTML
   * @param {CommandData} commandData - 命令数据
   * @param {RenderConfig} config - 渲染配置
   * @returns {string} HTML字符串
   */
  public generateCommandHTML(commandData: CommandData, config: RenderConfig = {}): string {
    if (!commandData) {
      logger.warn('无效的命令数据')
      return this.wrapInContainer('<div>无法显示命令数据</div>')
    }

    const title = config.title || `命令: ${commandData.displayName || commandData.name || ''}`

    const content = `
      ${this.renderHeader(title, '')}
      <div class="category material-card">
        ${this.renderCommand(commandData)}
      </div>
    `

    return this.wrapInContainer(content)
  }

  /**
   * 将内容包装在容器中
   * @param {string} content - HTML内容
   * @returns {string} 包装后的HTML
   */
  private wrapInContainer(content: string): string {
    return `
      <div class="ocr-container">
        ${content}
      </div>
      <style>${this.styleManager.getStyleSheet()}</style>
    `
  }

  /**
   * 渲染标题部分
   * @param {string} title - 标题
   * @param {string} description - 描述
   * @returns {string} HTML字符串
   */
  private renderHeader(title: string, description: string): string {
    const style = this.styleManager.getStyle()
    return `
      <div class="ocr-header material-card">
        <h1 style="color: ${style.titleColor}; text-align: center; margin-bottom: 8px;">${title}</h1>
        ${description ? `<p style="text-align: center; margin-top: 0;">${description}</p>` : ""}
      </div>
    `
  }

  /**
   * 渲染分类
   * @param {CategoryData} category - 分类数据
   * @returns {string} HTML字符串
   */
  private renderCategory(category: CategoryData): string {
    const style = this.styleManager.getStyle()
    const name = category.name || '未命名分类'
    const commands = Array.isArray(category.commands) ? category.commands : []

    return `
      <div class="category material-card">
        <h2 style="color: ${style.headerColor}; margin-bottom: 12px;">${name}</h2>
        <div class="commands">
          ${commands.map(command => this.renderCommand(command)).join("")}
        </div>
      </div>
    `
  }

  /**
   * 渲染单个命令
   * @param {CommandData} command - 命令数据
   * @returns {string} HTML字符串
   */
  private renderCommand(command: CommandData): string {
    const style = this.styleManager.getStyle()
    const displayName = command.displayName ? String(command.displayName).replace(/\./g, " ") : ''
    const description = command.description || ''
    const usage = command.usage || ''

    return `
      <div class="command-item">
        <div class="command-header">
          <span class="command-name" style="color: ${style.commandColor};">
            ${displayName}
          </span>
        </div>
        ${description ? `<div class="command-description" style="color: ${style.descriptionColor};">${description}</div>` : ""}
        ${usage ? `<div class="command-usage"><pre>${usage}</pre></div>` : ""}
        ${this.renderOptions(command.options)}
        ${this.renderExamples(command.examples)}
      </div>
    `
  }

  /**
   * 渲染选项
   * @param {Array} options - 选项数组
   * @returns {string} HTML字符串
   */
  private renderOptions(options: any[]): string {
    if (!options?.length) return ""

    const style = this.styleManager.getStyle()
    return `
      <div class="command-options" style="color: ${style.optionColor};">
        <div class="options-title">可用选项：</div>
        <ul>
          ${options.map(option => `
            <li><code>${option.syntax || ''}</code> ${option.description || ''}</li>
          `).join("")}
        </ul>
      </div>
    `
  }

  /**
   * 渲染示例
   * @param {Array} examples - 示例数组
   * @returns {string} HTML字符串
   */
  private renderExamples(examples: string[]): string {
    if (!examples?.length) return ""

    return `
      <div class="command-examples">
        <div class="examples-title">示例：</div>
        <pre>${examples.map(example => example || '').join("\n")}</pre>
      </div>
    `
  }

  /**
   * 渲染命令列表为图片
   * @param {CategoryData[]} categories - 分类数据
   * @param {RenderConfig} config - 渲染配置
   * @returns {Promise<Buffer>} 图片数据
   */
  public async renderCommandList(categories: CategoryData[], config: RenderConfig = {}): Promise<Buffer> {
    const html = this.generateCommandListHTML(categories, config)
    return await this.renderToImage(html)
  }

  /**
   * 渲染单个命令为图片
   * @param {CommandData} commandData - 命令数据
   * @param {RenderConfig} config - 渲染配置
   * @returns {Promise<Buffer>} 图片数据
   */
  public async renderCommandHTML(commandData: CommandData, config: RenderConfig = {}): Promise<Buffer> {
    const html = this.generateCommandHTML(commandData, config)
    return await this.renderToImage(html)
  }

  /**
   * 更新样式管理器
   * @param {StyleManager} styleManager - 新的样式管理器
   */
  public updateStyleManager(styleManager: StyleManager): void {
    this.styleManager = styleManager
    logger.info('已更新样式管理器')
  }
}
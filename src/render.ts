import { Context, Logger } from 'koishi'
import {} from 'koishi-plugin-puppeteer'

const logger = new Logger('menu:renderer')

/**
 * 公共样式模板
 * @param {Object} style - 样式对象
 * @returns {string} - 生成的样式字符串
 */
const styleTemplate = (style: any) => `
  .ocr-container { max-width: 800px; margin: 0 auto; background-color: ${style.backgroundColor || '#f5f5f5'}; padding: 20px; font-family: ${style.fontFamily || 'sans-serif'}; }
  .material-card { border-radius: 10px; overflow: hidden; background-color: ${style.cardBackground || '#fff'}; box-shadow: ${style.cardShadow || '0 2px 4px -1px rgba(0,0,0,0.2), 0 4px 5px 0 rgba(0,0,0,0.14), 0 1px 10px 0 rgba(0,0,0,0.12)'}; margin: 4px; padding: 12px; }
  .ocr-header { margin-bottom: 16px; padding: 16px; }
  .category { margin-bottom: 16px; padding: 16px; }
  .command-item { padding: 12px 0; }
  .command-header { margin-bottom: 6px; }
  .command-name { font-weight: 500; font-size: 16px; }
  .command-description { margin: 4px 0; font-size: 14px; }
  .command-usage, pre { margin-top: 8px; background: ${style.codeBackground || 'rgba(128,128,128,0.1)'}; border-radius: 4px; padding: 8px; }
  pre { margin: 0; white-space: pre-wrap; font-size: 13px; }
  .command-options, .command-examples { margin-top: 8px; }
  .options-title, .examples-title { font-weight: 500; margin-bottom: 4px; }
  code { background: ${style.codeBackground || 'rgba(128,128,128,0.1)'}; padding: 2px 4px; border-radius: 3px; font-family: monospace; }
  ul { margin-top: 4px; padding-left: 20px; }
  li { margin-bottom: 4px; }
  .command-item:not(:last-child) { border-bottom: 1px solid ${style.borderColor || 'rgba(128,128,128,0.15)'}; }
`

/**
 * 渲染标题部分
 * @param {string} title - 标题文本
 * @param {string} description - 描述文本
 * @param {Object} style - 样式对象
 * @returns {string} - 渲染的HTML字符串
 */
function renderHeader(title: string, description: string, style: any) {
  return `
    <div class="ocr-header material-card">
      <h1 style="color: ${style.titleColor}; text-align: center; margin-bottom: 8px;">${title || "命令帮助"}</h1>
      ${description ? `<p style="text-align: center; margin-top: 0;">${String(description)}</p>` : ""}
    </div>
  `
}

/**
 * 渲染选项部分
 * @param {Array} options - 选项数组
 * @param {Object} style - 样式对象
 * @returns {string} - 渲染的HTML字符串
 */
function renderOptions(options: any[], style: any) {
  if (!options?.length) return ""

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
 * 渲染示例部分
 * @param {Array} examples - 示例数组
 * @returns {string} - 渲染的HTML字符串
 */
function renderExamples(examples: string[]) {
  if (!examples?.length) return ""

  return `
    <div class="command-examples">
      <div class="examples-title">示例：</div>
      <pre>${examples.map(example => example || '').join("\n")}</pre>
    </div>
  `
}

/**
 * 渲染单个命令
 * @param {Object} command - 命令对象
 * @param {Object} style - 样式对象
 * @returns {string} - 渲染的HTML字符串
 */
function renderCommand(command: any, style: any) {
  if (!command) return ''

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
      ${renderOptions(command.options, style)}
      ${renderExamples(command.examples)}
    </div>
  `
}

/**
 * 渲染分类
 * @param {Object} category - 分类对象
 * @param {Object} style - 样式对象
 * @returns {string} - 渲染的HTML字符串
 */
function renderCategory(category: any, style: any) {
  if (!category) return ''

  const name = category.name || '未命名分类'
  const commands = Array.isArray(category.commands) ? category.commands : []

  return `
    <div class="category material-card">
      <h2 style="color: ${style.headerColor}; margin-bottom: 12px;">${name}</h2>
      <div class="commands">
        ${commands.map((command: any) => renderCommand(command, style)).join("")}
      </div>
    </div>
  `
}

/**
 * 生成完整HTML模板
 * @param {string} content - HTML内容
 * @param {Object} style - 样式对象
 * @returns {string} - 完整HTML字符串
 */
function generateHTML(content: string, style: any) {
  return `
    <div class="ocr-container">
      ${content}
    </div>
    <style>${styleTemplate(style)}</style>
  `
}

/**
 * 生成命令列表HTML
 * @param {Array} categories - 分类数组
 * @param {Object} config - 配置对象
 * @returns {string} - 渲染的HTML字符串
 */
export function generateCommandListHTML(categories: any[], config: any) {
  if (!categories || !Array.isArray(categories)) {
    logger.error('无效的分类数据:', typeof categories)
    categories = []
  }

  const title = config.title || "命令帮助"
  const description = config.description || ""
  const style = config.style || {}

  const content = `
    ${renderHeader(title, description, style)}
    ${categories.map(category => renderCategory(category, style)).join("")}
  `

  return generateHTML(content, style)
}

/**
 * 生成单个命令帮助HTML
 * @param {Object} commandData - 命令数据
 * @param {Object} config - 配置对象
 * @returns {string} - 渲染的HTML字符串
 */
export function generateCommandHelpHTML(commandData: any, config: any) {
  if (!commandData) {
    logger.error('无效的命令数据')
    return generateHTML('<div>无法显示命令数据</div>', config.style || {})
  }

  const title = config.title || `命令: ${commandData.name || ''}`
  const style = config.style || {}

  const content = `
    ${renderHeader(title, '', style)}
    <div class="category material-card">
      ${renderCommand(commandData, style)}
    </div>
  `

  return generateHTML(content, style)
}

/**
 * 使用Puppeteer将HTML转换为图片
 * @param {Context} ctx - Koishi上下文
 * @param {string} html - HTML字符串
 * @returns {Promise<Buffer>} - 图片缓冲区
 */
export async function htmlToImage(ctx: Context, html: string): Promise<Buffer> {
  let page = null

  try {
    page = await ctx.puppeteer.page()
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { margin: 0; padding: 0; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; background: transparent; color: rgba(0, 0, 0, 0.87); font-size: 14px; line-height: 1.4; -webkit-font-smoothing: antialiased; }
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
    if (page) await page.close().catch(() => {})
  }
}

/**
 * 渲染命令列表为图片
 * @param {Context} ctx - Koishi上下文
 * @param {Array} categories - 分类数组
 * @param {Object} config - 配置对象
 * @returns {Promise<Buffer>} - 图片缓冲区
 */
export async function renderCommandList(ctx: Context, categories: any[], config: any): Promise<Buffer> {
  const html = generateCommandListHTML(categories, config)
  return await htmlToImage(ctx, html)
}

/**
 * 渲染单个命令帮助为图片
 * @param {Context} ctx - Koishi上下文
 * @param {Object} commandData - 命令数据
 * @param {Object} config - 配置对象
 * @returns {Promise<Buffer>} - 图片缓冲区
 */
export async function renderCommandHelp(ctx: Context, commandData: any, config: any): Promise<Buffer> {
  const html = generateCommandHelpHTML(commandData, config)
  return await htmlToImage(ctx, html)
}

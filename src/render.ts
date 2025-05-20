import { Context, Logger } from 'koishi'
import {} from 'koishi-plugin-puppeteer'

const logger = new Logger('ocr:renderer')

// HTML渲染
function renderHeader(title: string, description: string, style: any) {
  return `
    <div class="ocr-header material-card">
      <h1 style="color: ${style.titleColor}; text-align: center; margin-bottom: 8px;">${title || "命令帮助"}</h1>
      ${description ? `<p style="text-align: center; margin-top: 0;">${String(description)}</p>` : ""}
    </div>
  `
}

function renderOptions(options: any[], style: any) {
  if (!options || options.length === 0) return ""

  return `
    <div class="command-options" style="color: ${style.optionColor};">
      <div class="options-title">可用选项：</div>
      <ul>
        ${options.map(option => `
          <li><code>${String(option.syntax || '')}</code> ${String(option.description || '')}</li>
        `).join("")}
      </ul>
    </div>
  `
}

function renderExamples(examples: string[]) {
  if (!examples || examples.length === 0) return ""

  return `
    <div class="command-examples">
      <div class="examples-title">示例：</div>
      <pre>${examples.map(example => String(example || '')).join("\n")}</pre>
    </div>
  `
}

function renderCommand(command: any, style: any) {
  if (!command) return ''

  const displayName = command.displayName ? String(command.displayName).replace(/\./g, " ") : ''
  const description = command.description ? String(command.description) : ''
  const usage = command.usage ? String(command.usage) : ''

  return `
    <div class="command-item">
      <div class="command-header">
        <span class="command-name" style="color: ${style.commandColor};">
          ${displayName}
        </span>
      </div>
      ${description ? `<div class="command-description" style="color: ${style.descriptionColor};">${description}</div>` : ""}
      ${usage ? `<div class="command-usage"><pre>${usage}</pre></div>` : ""}
      ${renderOptions(command.options || [], style)}
      ${renderExamples(command.examples || [])}
    </div>
  `
}

function renderCategory(category: any, style: any) {
  if (!category) return ''

  const name = category.name ? String(category.name) : '未命名分类'
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

// 生成命令列表HTML
export function generateCommandListHTML(categories: any[], config: any) {
  if (!categories || !Array.isArray(categories)) {
    logger.error('无效的分类数据:', typeof categories)
    categories = []
  }

  const title = config.title ? String(config.title) : "命令帮助"
  const description = config.description ? String(config.description) : ""
  const style = config.style || {}

  return `
    <div class="ocr-container" style="background-color: ${style.backgroundColor || '#f5f5f5'}; padding: 20px; font-family: ${style.fontFamily || 'sans-serif'};">
      ${renderHeader(title, description, style)}
      ${categories.map(category => renderCategory(category, style)).join("")}
    </div>
    <style>
      .ocr-container { max-width: 800px; margin: 0 auto; }
      .ocr-header { margin-bottom: 16px; padding: 16px; }
      .category { margin-bottom: 16px; padding: 16px; }
      .command-item { padding: 12px 0; border-bottom: 1px solid rgba(128,128,128,0.15); }
      .command-item:last-child { border-bottom: none; }
      .command-header { margin-bottom: 6px; }
      .command-name { font-weight: 500; font-size: 16px; }
      .command-description { margin: 4px 0; font-size: 14px; }
      .command-usage { margin-top: 8px; background: rgba(128,128,128,0.1); border-radius: 4px; padding: 8px; }
      .command-options { margin-top: 8px; }
      .command-examples { margin-top: 8px; }
      .options-title, .examples-title { font-weight: 500; margin-bottom: 4px; }
      pre { margin: 0; white-space: pre-wrap; background: rgba(128,128,128,0.1); border-radius: 4px; padding: 8px; font-size: 13px; }
      code { background: rgba(128,128,128,0.1); padding: 2px 4px; border-radius: 3px; font-family: monospace; }
      ul { margin-top: 4px; padding-left: 20px; }
      li { margin-bottom: 4px; }
      .material-card { border-radius: 10px; overflow: hidden; background-color: #fff; box-shadow: 0 2px 4px -1px rgba(0,0,0,0.2), 0 4px 5px 0 rgba(0,0,0,0.14), 0 1px 10px 0 rgba(0,0,0,0.12); margin: 4px; padding: 12px; }
    </style>
  `
}

// 生成命令帮助HTML
export function generateCommandHelpHTML(commandData: any, config: any) {
  if (!commandData) {
    logger.error('无效的命令数据')
    return `<div>无法显示命令数据</div>`
  }

  const title = config.title ? String(config.title) : `命令: ${String(commandData.name || '')}`
  const style = config.style || {}

  return `
    <div class="ocr-container" style="background-color: ${style.backgroundColor || '#f5f5f5'}; padding: 20px; font-family: ${style.fontFamily || 'sans-serif'};">
      <div class="ocr-header material-card">
        <h1 style="color: ${style.titleColor || '#333'}; text-align: center; margin-bottom: 8px;">${title}</h1>
      </div>
      <div class="category material-card">
        ${renderCommand(commandData, style)}
      </div>
    </div>
    <style>
      .ocr-container { max-width: 800px; margin: 0 auto; }
      .ocr-header { margin-bottom: 16px; padding: 16px; }
      .category { margin-bottom: 16px; padding: 16px; }
      .command-item { padding: 12px 0; }
      .command-header { margin-bottom: 6px; }
      .command-name { font-weight: 500; font-size: 16px; }
      .command-description { margin: 4px 0; font-size: 14px; }
      .command-usage { margin-top: 8px; background: rgba(128,128,128,0.1); border-radius: 4px; padding: 8px; }
      .command-options { margin-top: 8px; }
      .command-examples { margin-top: 8px; }
      .options-title, .examples-title { font-weight: 500; margin-bottom: 4px; }
      pre { margin: 0; white-space: pre-wrap; background: rgba(128,128,128,0.1); border-radius: 4px; padding: 8px; font-size: 13px; }
      code { background: rgba(128,128,128,0.1); padding: 2px 4px; border-radius: 3px; font-family: monospace; }
      ul { margin-top: 4px; padding-left: 20px; }
      li { margin-bottom: 4px; }
      .material-card { border-radius: 10px; overflow: hidden; background-color: #fff; box-shadow: 0 2px 4px -1px rgba(0,0,0,0.2), 0 4px 5px 0 rgba(0,0,0,0.14), 0 1px 10px 0 rgba(0,0,0,0.12); margin: 4px; padding: 12px; }
    </style>
  `
}

// 使用Puppeteer将HTML转换为图片
export async function htmlToImage(ctx: Context, html: string): Promise<Buffer> {
  let page = null

  try {
    page = await ctx.puppeteer.page()
    await page.setViewport({ width: 720, height: 1080, deviceScaleFactor: 2 })
    await page.setDefaultNavigationTimeout(30000)
    await page.setDefaultTimeout(30000)

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { margin: 0; padding: 0; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; background: transparent; color: rgba(0, 0, 0, 0.87); font-size: 14px; line-height: 1.4; -webkit-font-smoothing: antialiased; }
            table { width: 100%; table-layout: auto; border-collapse: separate; border-spacing: 0; overflow: hidden; }
            h1, h2, h3 { margin: 0; letter-spacing: 0.5px; font-weight: 500; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `, { waitUntil: 'networkidle0' })

    // 获取内容尺寸
    const dimensions = await page.evaluate(() => {
      const contentWidth = Math.max(
        document.body.scrollWidth,
        document.body.offsetWidth,
        document.documentElement.clientWidth,
        document.documentElement.scrollWidth,
        document.documentElement.offsetWidth
      )
      const contentHeight = document.body.scrollHeight
      return { width: contentWidth, height: contentHeight }
    })

    // 调整视窗大小以适应内容
    await page.setViewport({
      width: dimensions.width,
      height: dimensions.height,
      deviceScaleFactor: 2
    })

    // 等待图片加载完成
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
    if (page) {
      await page.close().catch(() => {})
    }
  }
}

// 渲染命令列表
export async function renderCommandList(ctx: Context, categories: any[], config: any): Promise<Buffer> {
  const html = generateCommandListHTML(categories, config)
  return await htmlToImage(ctx, html)
}

// 渲染命令帮助
export async function renderCommandHelp(ctx: Context, commandData: any, config: any): Promise<Buffer> {
  const html = generateCommandHelpHTML(commandData, config)
  return await htmlToImage(ctx, html)
}
import { Context } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import { CommandData, CategoryData, CommandGroup } from './command'
import { Style } from './style'
import { logger } from './index'

export interface RenderConfig {
  title?: string
  description?: string
  showGroups?: boolean
}

/**
 * 图片渲染类
 */
export class Render {
  private ctx: Context
  private style: Style

  // 图标映射
  private readonly CMD_ICONS = {
    default: 'code', help: 'help_outline', admin: 'admin_panel_settings',
    user: 'person', info: 'info', settings: 'settings',
    search: 'search', list: 'list', create: 'add_circle',
    delete: 'delete', edit: 'edit', menu: 'menu_book',
    plugin: 'extension', refresh: 'refresh', data: 'database',
    image: 'image', music: 'music_note', video: 'video_library',
    game: 'sports_esports', chat: 'chat', send: 'send',
    download: 'download', upload: 'upload', time: 'schedule'
  }

  private readonly GROUP_ICONS = {
    default: 'widgets', system: 'settings', game: 'sports_esports',
    utility: 'build', admin: 'admin_panel_settings', user: 'person',
    media: 'perm_media', music: 'music_note', search: 'search',
    fun: 'mood', social: 'forum', other: 'more_horiz'
  }

  private readonly UI_ICONS = {
    categoryHeader: 'menu_book', options: 'tune',
    examples: 'code', subcommands: 'account_tree',
    badge: 'label', tag: 'local_offer'
  }

  /**
   * 创建渲染器
   */
  constructor(ctx: Context, style: Style) {
    this.ctx = ctx
    this.style = style
  }

  /**
   * 渲染HTML为图片
   */
  public async toImage(html: string): Promise<Buffer> {
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
                margin: 0; padding: 0;
                font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
                background: transparent; color: rgba(0, 0, 0, 0.87);
                font-size: 14px; line-height: 1.4;
                -webkit-font-smoothing: antialiased;
              }
              * { box-sizing: border-box; }
            </style>
          </head>
          <body>${html}</body>
        </html>
      `)

      // 获取内容尺寸并设置视口
      const size = await page.evaluate(() => ({
        width: Math.min(480, document.body.scrollWidth),
        height: document.body.scrollHeight
      }))

      await page.setViewport({
        width: size.width,
        height: size.height,
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

      return await page.screenshot({
        type: 'png',
        fullPage: true,
        omitBackground: true
      })
    } catch (err) {
      logger.error('图片渲染出错:', err)
      throw new Error(`图片渲染出错: ${err.message || '未知错误'}`)
    } finally {
      await page.close().catch(() => {})
    }
  }

  /**
   * 生成命令列表HTML
   */
  public genListHTML(categories: CategoryData[], config: RenderConfig = {}): string {
    if (!categories?.length) {
      logger.warn('无效的分类数据')
      categories = [{ name: '命令列表', commands: [] }]
    }

    const showGroups = config.showGroups !== false

    // 内容区域
    const contentHTML = showGroups && categories[0]?.groups?.length
      ? this.renderGroups(categories[0].groups)
      : `<div class="material-card commands-card">
          <div class="category-header">
            <i class="material-icons">${this.UI_ICONS.categoryHeader}</i>
            ${config.title || "命令列表"}
          </div>
          <div class="commands-container">
            ${this.renderCmdGrid(categories[0]?.commands || [])}
          </div>
        </div>`

    return this.wrap(contentHTML)
  }

  /**
   * 渲染分组
   */
  private renderGroups(groups: CommandGroup[]): string {
    if (!groups?.length) return ''

    return groups.map(group => `
      <div class="command-group">
        <div class="group-header">
          <i class="material-icons">${this.GROUP_ICONS[group.icon] || this.CMD_ICONS[group.icon] || this.GROUP_ICONS.default}</i>
          ${group.name}
        </div>
        <div class="group-content">
          ${group.commands.map(cmd => this.renderCmdCard(cmd)).join('')}
        </div>
      </div>
    `).join('')
  }

  /**
   * 生成命令HTML
   */
  public genCmdHTML(cmd: CommandData, config: RenderConfig = {}): string {
    if (!cmd) {
      return this.wrap('<div>无法显示命令数据</div>')
    }

    const content = `<div class="material-card commands-card">
      <div class="category-header">
        <i class="material-icons">${this.getCmdIcon(cmd.name)}</i>
        ${config.title || `命令: ${cmd.displayName || cmd.name || ''}`}
      </div>
      <div class="commands-container">
        ${this.renderCmdDetail(cmd)}
      </div>
    </div>`

    return this.wrap(content)
  }

  /**
   * 包装内容
   */
  private wrap(content: string): string {
    return `
      <div class="ocr-container">
        ${content}
      </div>
      <style>${this.style.getStyleSheet()}</style>
    `
  }

  /**
   * 渲染命令网格
   */
  private renderCmdGrid(commands: CommandData[]): string {
    const parents = commands.filter(cmd => cmd.subCommands?.length > 0)
    const regular = commands.filter(cmd => !cmd.subCommands?.length)

    return `
      ${regular.length > 0 ? `
        <div class="command-row">
          ${regular.map(cmd => this.renderCmdCard(cmd)).join("")}
        </div>
      ` : ''}

      ${parents.map(cmd => this.renderParentCmd(cmd)).join("")}
    `
  }

  /**
   * 获取命令图标
   */
  private getCmdIcon(cmdName: string): string {
    if (!cmdName) return this.CMD_ICONS.default

    const name = cmdName.toLowerCase()

    // 检查命令名匹配
    for (const [key, icon] of Object.entries(this.CMD_ICONS)) {
      if (key === 'default') continue
      if (name === key || name.includes(key)) return icon
    }

    // 根据前缀分类
    const part = name.split('.')[0]
    switch (part) {
      case 'help': case 'h': return this.CMD_ICONS.help
      case 'admin': case 'manage': case 'op': return this.CMD_ICONS.admin
      case 'user': case 'profile': return this.CMD_ICONS.user
      case 'set': case 'config': case 'settings': return this.CMD_ICONS.settings
      case 'info': case 'about': case 'status': return this.CMD_ICONS.info
      case 'list': case 'ls': case 'show': return this.CMD_ICONS.list
      case 'menu': return this.CMD_ICONS.menu
      case 'plugin': case 'ext': case 'extension': return this.CMD_ICONS.plugin
      case 'search': case 'find': case 'query': return this.CMD_ICONS.search
      default: return this.CMD_ICONS.default
    }
  }

  /**
   * 渲染命令卡片
   */
  private renderCmdCard(cmd: CommandData): string {
    const name = cmd.displayName ? String(cmd.displayName).replace(/\./g, " ") : cmd.name
    const desc = this.getDesc(cmd.description)
    const icon = this.getCmdIcon(cmd.name)

    return `
      <div class="command-item">
        <div class="command-header">
          <span class="command-name">
            <i class="material-icons">${icon}</i>
            ${name}
          </span>
        </div>
        ${desc ? `<div class="command-description">${desc}</div>` : ""}
        ${cmd.options?.length ? `<div class="command-tag">
          <i class="material-icons">${this.UI_ICONS.options}</i>
          ${cmd.options.length} 个选项
        </div>` : ""}
      </div>
    `
  }

  /**
   * 渲染父命令
   */
  private renderParentCmd(cmd: CommandData): string {
    const name = cmd.displayName ? String(cmd.displayName).replace(/\./g, " ") : cmd.name
    const desc = this.getDesc(cmd.description)
    const hasSubs = cmd.subCommands?.length > 0
    const icon = this.getCmdIcon(cmd.name)

    return `
      <div class="command-item">
        <div class="command-header">
          <span class="command-name">
            <i class="material-icons">${icon}</i>
            ${name}
            ${hasSubs ? `<span class="command-badge">
              <i class="material-icons">${this.UI_ICONS.badge}</i>
              ${cmd.subCommands.length} 个子命令
            </span>` : ''}
          </span>
        </div>
        ${desc ? `<div class="command-description">${desc}</div>` : ""}
        ${cmd.options?.length ? `
          <div style="margin-top: 8px;">
            ${cmd.options.map(opt => `<span class="command-tag">
              <i class="material-icons">${this.UI_ICONS.tag}</i>
              ${opt.name}
            </span>`).join(' ')}
          </div>
        ` : ""}

        ${hasSubs ? `
          <div class="subcommands">
            <div class="subcommands-title">
              <i class="material-icons">${this.UI_ICONS.subcommands}</i>
              子命令：
            </div>
            <div class="subcommand-list">
              ${cmd.subCommands.map(sub => `
                <div class="subcommand-item">
                  <div class="subcommand-name">
                    <i class="material-icons">${this.getCmdIcon(sub.name)}</i>
                    ${sub.displayName.replace(/.*\./, '')}
                  </div>
                  ${this.getDesc(sub.description) ?
                    `<div class="subcommand-desc">${this.getDesc(sub.description)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `
  }

  /**
   * 渲染命令详情
   */
  private renderCmdDetail(cmd: CommandData): string {
    const name = cmd.displayName ? String(cmd.displayName).replace(/\./g, " ") : cmd.name
    const desc = this.getDesc(cmd.description)
    const icon = this.getCmdIcon(cmd.name)

    return `
      <div class="commands-container">
        <div class="command-name" style="font-size: 16px; margin-bottom: 8px;">
          <i class="material-icons" style="font-size: 18px;">${icon}</i>
          ${name}
        </div>
        ${desc ? `<div class="command-description" style="font-size: 13px; margin-bottom: 10px;">${desc}</div>` : ""}

        ${cmd.usage ? `
          <div class="command-usage">
            <pre>${Array.isArray(cmd.usage) ? this.getDesc(cmd.usage) : cmd.usage}</pre>
          </div>
        ` : ""}

        ${this.renderOpts(cmd.options)}
        ${this.renderExamples(cmd.examples)}

        ${cmd.subCommands?.length ? `
          <div class="subcommands">
            <div class="subcommands-title">
              <i class="material-icons">${this.UI_ICONS.subcommands}</i>
              子命令：
            </div>
            <div class="subcommand-list">
              ${cmd.subCommands.map(sub => this.renderCmdCard(sub)).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `
  }

  /**
   * 渲染选项
   */
  private renderOpts(options: any[]): string {
    if (!options?.length) return ""

    return `
      <div class="command-options">
        <div class="options-title">
          <i class="material-icons">${this.UI_ICONS.options}</i>
          可用选项：
        </div>
        <div class="options-grid">
          ${options.map(opt => `
            <div class="option-item">
              <code>${opt.syntax || ''}</code>
              ${opt.description ?
                `<div style="margin-top: 4px; color: ${this.style.getStyle().descriptionColor};">
                  ${this.getDesc(opt.description)}
                </div>` : ''}
            </div>
          `).join("")}
        </div>
      </div>
    `
  }

  /**
   * 渲染示例
   */
  private renderExamples(examples: string[]): string {
    if (!examples?.length) return ""

    const text = Array.isArray(examples) ? examples.join("\n") : examples
    if (!text) return ""

    return `
      <div class="command-examples">
        <div class="examples-title">
          <i class="material-icons">${this.UI_ICONS.examples}</i>
          示例：
        </div>
        <pre>${text}</pre>
      </div>
    `
  }

  /**
   * 提取描述文本
   */
  private getDesc(desc: any): string {
    if (!desc) return ''
    if (typeof desc === 'string') return desc
    if (Array.isArray(desc)) return desc.map(item => this.getDesc(item)).join(' ')
    if (desc.type === 'text' && desc.attrs?.content) return desc.attrs.content
    if (desc.children?.length) return desc.children.map(child => this.getDesc(child)).join(' ')
    return ''
  }

  /**
   * 渲染命令列表为图片
   */
  public async renderList(categories: CategoryData[], config: RenderConfig = {}): Promise<Buffer> {
    const cfg = {
      title: "命令列表",
      showGroups: true,
      ...config
    }
    return await this.toImage(this.genListHTML(categories, cfg))
  }

  /**
   * 渲染命令为图片
   */
  public async renderCmd(cmd: CommandData, config: RenderConfig = {}): Promise<Buffer> {
    return await this.toImage(this.genCmdHTML(cmd, config))
  }

  /**
   * 更新样式
   */
  public updateStyle(style: Style): void {
    this.style = style
  }
}
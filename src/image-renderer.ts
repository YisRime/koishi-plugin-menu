import { Context, Logger } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import { CommandData, CategoryData, CommandGroup } from './command-extractor'
import { StyleManager } from './style-manager'

const logger = new Logger('menu:image-renderer')

export interface RenderConfig {
  title?: string
  description?: string
  pageTitle?: string  // 新增：页面顶部标题
  showGroups?: boolean // 新增：是否显示分组
}

/**
 * 图片渲染类，负责将命令数据渲染为HTML和图像
 */
export class ImageRenderer {
  private ctx: Context
  private styleManager: StyleManager

  // 命令类型图标映射
  private readonly COMMAND_ICONS = {
    default: 'code',              // 默认图标
    help: 'help_outline',         // 帮助命令
    admin: 'admin_panel_settings', // 管理命令
    user: 'person',               // 用户相关
    info: 'info',                 // 信息相关
    settings: 'settings',         // 设置相关
    search: 'search',             // 搜索相关
    list: 'list',                 // 列表相关
    create: 'add_circle',         // 创建相关
    delete: 'delete',             // 删除相关
    edit: 'edit',                 // 编辑相关
    menu: 'menu_book',            // 菜单相关
    plugin: 'extension',          // 插件相关
    refresh: 'refresh',           // 刷新/更新相关
    data: 'database',             // 数据相关
    image: 'image',               // 图像相关
    music: 'music_note',          // 音乐相关
    video: 'video_library',       // 视频相关
    game: 'sports_esports',       // 游戏相关
    chat: 'chat',                 // 聊天相关
    send: 'send',                 // 发送相关
    download: 'download',         // 下载相关
    upload: 'upload',             // 上传相关
    time: 'schedule',             // 时间/计划相关
  }

  // 分组图标映射
  private readonly GROUP_ICONS = {
    default: 'widgets',           // 默认分组图标
    system: 'settings',           // 系统分组
    game: 'sports_esports',       // 游戏分组
    utility: 'build',             // 实用工具分组
    admin: 'admin_panel_settings', // 管理分组
    user: 'person',               // 用户分组
    media: 'perm_media',          // 媒体分组
    music: 'music_note',          // 音乐分组
    search: 'search',             // 搜索分组
    fun: 'mood',                  // 娱乐分组
    social: 'forum',              // 社交分组
    other: 'more_horiz'           // 其他分组
  }

  // 其他UI元素图标
  private readonly UI_ICONS = {
    categoryHeader: 'menu_book',
    options: 'tune',
    examples: 'code',
    subcommands: 'account_tree',
    badge: 'label',
    tag: 'local_offer',
    pageTitle: 'help_center', // 新增：页面标题图标
  }

  /**
   * 创建图像渲染器
   * @param ctx Koishi上下文
   * @param styleManager 样式管理器
   */
  constructor(ctx: Context, styleManager: StyleManager) {
    this.ctx = ctx
    this.styleManager = styleManager
    logger.info('图像渲染器初始化完成')
  }

  /**
   * 渲染HTML为图片
   * @param html HTML内容
   * @returns 图片数据Buffer
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
              * {
                box-sizing: border-box;
              }
            </style>
          </head>
          <body>${html}</body>
        </html>
      `)

      // 获取内容尺寸并调整视窗
      const dimensions = await page.evaluate(() => ({
        width: Math.min(480, document.body.scrollWidth),
        height: document.body.scrollHeight
      }))

      await page.setViewport({
        width: dimensions.width,
        height: dimensions.height,
        deviceScaleFactor: 2 // 提高图像清晰度
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
   * @param categories 分类数据
   * @param config 渲染配置
   * @returns HTML字符串
   */
  public generateCommandListHTML(categories: CategoryData[], config: RenderConfig = {}): string {
    if (!categories?.length) {
      logger.warn('无效的分类数据')
      categories = [{ name: '命令列表', commands: [] }]
    }

    // 是否显示分组，默认为true
    const showGroups = config.showGroups !== false

    // 顶部页面标题
    const pageTitleHTML = config.pageTitle ? `
      <div class="page-title">
        <i class="material-icons">${this.UI_ICONS.pageTitle}</i>
        ${config.pageTitle}
      </div>
    ` : ''

    let contentHTML = ''

    if (showGroups && categories[0]?.groups?.length) {
      // 渲染分组布局
      contentHTML = this.renderGroupedCommands(categories[0].groups)
    } else {
      // 传统布局 - 单个卡片
      contentHTML = `<div class="material-card commands-card">
        <div class="category-header">
          <i class="material-icons">${this.UI_ICONS.categoryHeader}</i>
          ${config.title || "命令列表"}
        </div>
        <div class="commands-container">
          ${this.renderCommandsGrid(categories[0]?.commands || [])}
        </div>
      </div>`
    }

    return this.wrapInContainer(pageTitleHTML + contentHTML)
  }

  /**
   * 渲染分组命令
   * @param groups 命令分组
   * @returns HTML字符串
   */
  private renderGroupedCommands(groups: CommandGroup[]): string {
    if (!groups?.length) return ''

    return groups.map(group => `
      <div class="command-group">
        <div class="group-header">
          <i class="material-icons">${this.getGroupIcon(group.icon)}</i>
          ${group.name}
        </div>
        <div class="group-content">
          ${group.commands.map(cmd => this.renderCommandCard(cmd)).join('')}
        </div>
      </div>
    `).join('')
  }

  /**
   * 获取分组图标
   * @param iconName 图标名称
   * @returns 图标名
   */
  private getGroupIcon(iconName: string): string {
    if (!iconName) return this.GROUP_ICONS.default

    // 尝试在分组图标映射中查找
    if (iconName in this.GROUP_ICONS) {
      return this.GROUP_ICONS[iconName]
    }

    // 尝试在命令图标映射中查找
    if (iconName in this.COMMAND_ICONS) {
      return this.COMMAND_ICONS[iconName]
    }

    // 返回默认图标
    return this.GROUP_ICONS.default
  }

  /**
   * 生成单个命令的HTML
   * @param commandData 命令数据
   * @param config 渲染配置
   * @returns HTML字符串
   */
  public generateCommandHTML(commandData: CommandData, config: RenderConfig = {}): string {
    if (!commandData) {
      logger.warn('无效的命令数据')
      return this.wrapInContainer('<div>无法显示命令数据</div>')
    }

    const content = `<div class="material-card commands-card">
      <div class="category-header">
        <i class="material-icons">${this.getCommandIcon(commandData.name)}</i>
        ${config.title || `命令: ${commandData.displayName || commandData.name || ''}`}
      </div>
      <div class="commands-container">
        ${this.renderCommandDetailed(commandData)}
      </div>
    </div>`

    return this.wrapInContainer(content)
  }

  /**
   * 将内容包装在容器中
   * @param content HTML内容
   * @returns 包装后的HTML
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
   * 渲染命令网格
   * @param commands 命令数据数组
   * @returns HTML字符串
   */
  private renderCommandsGrid(commands: CommandData[]): string {
    // 将命令分类为常规命令和父命令
    const parentCommands = commands.filter(cmd => cmd.subCommands?.length > 0);
    const regularCommands = commands.filter(cmd => !cmd.subCommands?.length);

    return `
      ${regularCommands.length > 0 ? `
        <div class="command-row">
          ${regularCommands.map(cmd => this.renderCommandCard(cmd)).join("")}
        </div>
      ` : ''}

      ${parentCommands.map(cmd => this.renderParentCommand(cmd)).join("")}
    `
  }

  /**
   * 获取命令图标名称
   * @param commandName 命令名称
   * @returns 图标名称
   */
  private getCommandIcon(commandName: string): string {
    if (!commandName) return this.COMMAND_ICONS.default

    // 尝试根据命令名称匹配对应图标
    const nameLower = commandName.toLowerCase()

    // 检查命令名称中是否包含关键词
    for (const [key, icon] of Object.entries(this.COMMAND_ICONS)) {
      if (key === 'default') continue
      if (nameLower === key || nameLower.includes(key)) {
        return icon
      }
    }

    // 根据命令的首部分类
    const parts = nameLower.split('.')
    const mainCommand = parts[0]

    switch (mainCommand) {
      case 'help':
      case 'h':
        return this.COMMAND_ICONS.help
      case 'admin':
      case 'manage':
      case 'op':
        return this.COMMAND_ICONS.admin
      case 'user':
      case 'profile':
        return this.COMMAND_ICONS.user
      case 'set':
      case 'config':
      case 'settings':
        return this.COMMAND_ICONS.settings
      case 'info':
      case 'about':
      case 'status':
        return this.COMMAND_ICONS.info
      case 'list':
      case 'ls':
      case 'show':
        return this.COMMAND_ICONS.list
      case 'menu':
        return this.COMMAND_ICONS.menu
      case 'plugin':
      case 'ext':
      case 'extension':
        return this.COMMAND_ICONS.plugin
      case 'search':
      case 'find':
      case 'query':
        return this.COMMAND_ICONS.search
      // 添加更多命令匹配
      default:
        return this.COMMAND_ICONS.default
    }
  }

  /**
   * 渲染简洁的命令卡片
   * @param command 命令数据
   * @returns HTML字符串
   */
  private renderCommandCard(command: CommandData): string {
    const displayName = command.displayName ? String(command.displayName).replace(/\./g, " ") : command.name
    const description = this.getCommandDescription(command.description)
    const icon = this.getCommandIcon(command.name)

    return `
      <div class="command-item">
        <div class="command-header">
          <span class="command-name">
            <i class="material-icons">${icon}</i>
            ${displayName}
          </span>
        </div>
        ${description ? `<div class="command-description">${description}</div>` : ""}
        ${command.options?.length ? `<div class="command-tag">
          <i class="material-icons">${this.UI_ICONS.options}</i>
          ${command.options.length} 个选项
        </div>` : ""}
      </div>
    `
  }

  /**
   * 渲染父命令及其子命令
   * @param command 父命令数据
   * @returns HTML字符串
   */
  private renderParentCommand(command: CommandData): string {
    const displayName = command.displayName ? String(command.displayName).replace(/\./g, " ") : command.name
    const description = this.getCommandDescription(command.description)
    const hasSubCommands = command.subCommands?.length > 0
    const icon = this.getCommandIcon(command.name)

    return `
      <div class="command-item">
        <div class="command-header">
          <span class="command-name">
            <i class="material-icons">${icon}</i>
            ${displayName}
            ${hasSubCommands ? `<span class="command-badge">
              <i class="material-icons">${this.UI_ICONS.badge}</i>
              ${command.subCommands.length} 个子命令
            </span>` : ''}
          </span>
        </div>
        ${description ? `<div class="command-description">${description}</div>` : ""}
        ${command.options?.length ? `
          <div style="margin-top: 8px;">
            ${command.options.map(opt => `<span class="command-tag">
              <i class="material-icons">${this.UI_ICONS.tag}</i>
              ${opt.name}
            </span>`).join(' ')}
          </div>
        ` : ""}

        ${hasSubCommands ? `
          <div class="subcommands">
            <div class="subcommands-title">
              <i class="material-icons">${this.UI_ICONS.subcommands}</i>
              子命令：
            </div>
            <div class="subcommand-list">
              ${command.subCommands.map(sub => `
                <div class="subcommand-item">
                  <div class="subcommand-name">
                    <i class="material-icons">${this.getCommandIcon(sub.name)}</i>
                    ${sub.displayName.replace(/.*\./, '')}
                  </div>
                  ${this.getCommandDescription(sub.description) ?
                    `<div class="subcommand-desc">${this.getCommandDescription(sub.description)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `
  }

  /**
   * 渲染详细的命令信息
   * @param command 命令数据
   * @returns HTML字符串
   */
  private renderCommandDetailed(command: CommandData): string {
    const displayName = command.displayName ? String(command.displayName).replace(/\./g, " ") : command.name
    const description = this.getCommandDescription(command.description)
    const hasSubCommands = command.subCommands?.length > 0
    const icon = this.getCommandIcon(command.name)

    return `
      <div class="commands-container">
        <div class="command-name" style="font-size: 16px; margin-bottom: 8px;">
          <i class="material-icons" style="font-size: 18px;">${icon}</i>
          ${displayName}
        </div>
        ${description ? `<div class="command-description" style="font-size: 13px; margin-bottom: 10px;">${description}</div>` : ""}

        ${command.usage ? `
          <div class="command-usage">
            <pre>${Array.isArray(command.usage) ? this.getCommandDescription(command.usage) : command.usage}</pre>
          </div>
        ` : ""}

        ${this.renderOptions(command.options)}
        ${this.renderExamples(command.examples)}

        ${hasSubCommands ? `
          <div class="subcommands">
            <div class="subcommands-title">
              <i class="material-icons">${this.UI_ICONS.subcommands}</i>
              子命令：
            </div>
            <div class="subcommand-list">
              ${command.subCommands.map(sub => this.renderCommandCard(sub)).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `
  }

  /**
   * 渲染选项
   * @param options 选项数组
   * @returns HTML字符串
   */
  private renderOptions(options: any[]): string {
    if (!options?.length) return ""

    return `
      <div class="command-options">
        <div class="options-title">
          <i class="material-icons">${this.UI_ICONS.options}</i>
          可用选项：
        </div>
        <div class="options-grid">
          ${options.map(option => `
            <div class="option-item">
              <code>${option.syntax || ''}</code>
              ${option.description ?
                `<div style="margin-top: 4px; color: ${this.styleManager.getStyle().descriptionColor};">
                  ${this.getCommandDescription(option.description)}
                </div>` : ''}
            </div>
          `).join("")}
        </div>
      </div>
    `
  }

  /**
   * 渲染示例
   * @param examples 示例数组
   * @returns HTML字符串
   */
  private renderExamples(examples: string[]): string {
    if (!examples?.length) return ""

    const examplesText = Array.isArray(examples) ? examples.join("\n") : examples;
    if (!examplesText) return "";

    return `
      <div class="command-examples">
        <div class="examples-title">
          <i class="material-icons">${this.UI_ICONS.examples}</i>
          示例：
        </div>
        <pre>${examplesText}</pre>
      </div>
    `
  }

  /**
   * 从复杂的描述结构中提取文本
   * @param description 描述对象或字符串
   * @returns 描述文本
   */
  private getCommandDescription(description: any): string {
    if (!description) return '';

    if (typeof description === 'string') return description;

    if (Array.isArray(description)) {
      return description.map(item => this.getCommandDescription(item)).join(' ');
    }

    if (description.type === 'text' && description.attrs?.content) {
      return description.attrs.content;
    }

    if (description.children?.length) {
      return description.children.map(child => this.getCommandDescription(child)).join(' ');
    }

    return '';
  }

  /**
   * 渲染命令列表为图片
   * @param categories 分类数据
   * @param config 渲染配置
   * @returns 图片数据
   */
  public async renderCommandList(categories: CategoryData[], config: RenderConfig = {}): Promise<Buffer> {
    // 添加默认页面标题
    const finalConfig = {
      pageTitle: "帮助菜单",
      title: "命令列表",
      showGroups: true,
      ...config
    }
    return await this.renderToImage(this.generateCommandListHTML(categories, finalConfig))
  }

  /**
   * 渲染单个命令为图片
   * @param commandData 命令数据
   * @param config 渲染配置
   * @returns 图片数据
   */
  public async renderCommandHTML(commandData: CommandData, config: RenderConfig = {}): Promise<Buffer> {
    return await this.renderToImage(this.generateCommandHTML(commandData, config))
  }

  /**
   * 更新样式管理器
   * @param styleManager 新的样式管理器
   */
  public updateStyleManager(styleManager: StyleManager): void {
    this.styleManager = styleManager
    logger.info('已更新样式管理器')
  }
}
/**
 * 布局配置接口
 * @interface Layout
 */
export interface Layout {
  /** 网格行数 */
  rows: number
  /** 网格列数 */
  cols: number
  /** 布局项目列表 */
  items: LayoutItem[]
}

/**
 * 布局项目接口
 * @interface LayoutItem
 */
export interface LayoutItem {
  /** 起始行位置 */
  row: number
  /** 起始列位置 */
  col: number
  /** 跨越的行数 */
  rowSpan: number
  /** 跨越的列数 */
  colSpan: number
  /** 命令名称 */
  commandName: string
  /** 项目类型 */
  itemType: 'desc' | 'usage' | 'examples' | 'options' | 'subs'
}

/**
 * 主题渲染器
 * @class Render
 */
export class Render {
  /**
   * 构建完整的 HTML 页面
   * @param {any} config - 配置对象，包含样式和页面设置
   * @param {Layout} layout - 布局配置
   * @param {any[]} commands - 命令数据数组
   * @returns {string} 完整的 HTML 字符串
   */
  buildHtml(config: any, layout: Layout, commands: any[]): string {
    const css = this.buildCSS(config)
    const body = this.buildBody(config, layout, commands)
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${body}</body></html>`
  }

  /**
   * 构建 CSS 样式字符串
   * @private
   * @param {any} config - 配置对象，包含主题色彩、字体等样式设置
   * @returns {string} CSS 样式字符串
   */
  private buildCSS(config: any): string {
    return `
${config.fontUrl ? `@import url('${config.fontUrl}');` : ''}

:root {
  --primary: ${config.primary};
  --secondary: ${config.secondary};
  --bg: ${config.bgColor};
  --surface: rgba(255, 255, 255, 0.96);
  --text: ${config.textColor};
  --text-light: rgba(100, 116, 139, 0.6);
  --border: rgba(139, 92, 246, 0.12);
  --radius: ${config.radius}px;
  --spacing: ${config.padding}px;
  --gap: ${Math.max(config.padding * 0.75, 10)}px;
  --font: system-ui, -apple-system, 'Segoe UI', sans-serif;
  --fs: ${config.fontSize}px;
  --title-scale: ${config.titleSize};
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font: 400 var(--fs)/1.6 var(--font);
  color: var(--text);
  background: ${config.bgImage
    ? `var(--bg) url('${config.bgImage}') center/cover`
    : `linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(56, 189, 248, 0.06) 50%, var(--bg) 100%)`};
  padding: calc(var(--spacing) * 2);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

body::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background:
    radial-gradient(circle at 25% 25%, rgba(139, 92, 246, 0.06) 0%, transparent 50%),
    radial-gradient(circle at 75% 75%, rgba(56, 189, 248, 0.05) 0%, transparent 50%);
  z-index: -1;
  pointer-events: none;
}

.container {
  width: 100%;
  max-width: 480px;
  background: rgba(255, 255, 255, 0.98);
  border-radius: calc(var(--radius) * 1.5);
  overflow: hidden;
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.06),
    0 8px 20px rgba(139, 92, 246, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(139, 92, 246, 0.12);
  position: relative;
}

.header {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.9) 0%, rgba(56, 189, 248, 0.85) 100%);
  color: white;
  padding: calc(var(--spacing) * 1.5);
  text-align: center;
  font-weight: 600;
  font-size: calc(var(--fs) * var(--title-scale));
  position: relative;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);
}

.header::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 2px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 1px;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(var(--grid-cols, 1), 1fr);
  gap: var(--gap);
  padding: var(--gap);
  background: linear-gradient(135deg, rgba(248, 250, 252, 0.8) 0%, rgba(255, 255, 255, 0.95) 100%);
  position: relative;
}

.grid-item {
  background: rgba(255, 255, 255, 0.96);
  border-radius: var(--radius);
  padding: var(--spacing);
  border: 1px solid rgba(139, 92, 246, 0.08);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.03),
    0 2px 6px rgba(139, 92, 246, 0.05);
  position: relative;
  z-index: 1;
  overflow: hidden;
  transition: all 0.2s ease;
}

.grid-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 8px;
  height: 100%;
  background: linear-gradient(180deg, rgba(139, 92, 246, 0.7) 0%, rgba(56, 189, 248, 0.7) 100%);
  opacity: 0.6;
}

.grid-item-title {
  font-weight: 600;
  font-size: calc(var(--fs) * 1.15);
  color: var(--text);
  margin-bottom: calc(var(--spacing) * 0.5);
  background: linear-gradient(90deg, rgba(139, 92, 246, 0.9), rgba(56, 189, 248, 0.8));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.grid-item-content {
  color: var(--text-light);
  white-space: pre-wrap;
  line-height: 1.6;
}

.grid-item.option {
  border: 2px dashed rgba(139, 92, 246, 0.15);
  background: linear-gradient(145deg, rgba(139, 92, 246, 0.04) 0%, rgba(255, 255, 255, 0.98) 100%);
}

.grid-item.option::before {
  background: linear-gradient(180deg, rgba(139, 92, 246, 0.4) 0%, rgba(56, 189, 248, 0.3) 100%);
}

.grid-item.subCommand {
  background: linear-gradient(145deg, rgba(56, 189, 248, 0.06) 0%, rgba(255, 255, 255, 0.96) 100%);
  border-color: rgba(56, 189, 248, 0.12);
}

.grid-item.subCommand::before {
  background: rgba(56, 189, 248, 0.6);
}

.footer {
  background: linear-gradient(135deg, rgba(248, 250, 252, 0.8) 0%, rgba(255, 255, 255, 0.96) 100%);
  color: var(--text-light);
  padding: calc(var(--spacing) * 0.8);
  text-align: center;
  font-size: calc(var(--fs) * 0.85);
  border-top: 1px solid rgba(139, 92, 246, 0.08);
  position: relative;
}

.footer::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 80px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent);
  opacity: 0.4;
}

@media (max-width: 480px) {
  body {
    padding: var(--spacing);
  }
  .container {
    border-radius: var(--radius);
    max-width: 100%;
  }
  .grid-container { grid-template-columns: 1fr !important; }
}
`
  }

  /**
   * 构建页面主体内容
   * @private
   * @param {any} config - 配置对象
   * @param {Layout} layout - 布局配置
   * @param {any[]} commands - 命令数据数组
   * @returns {string} HTML 主体内容字符串
   */
  private buildBody(config: any, layout: Layout, commands: any[]): string {
    const grid = layout.items.map(layoutItem => {
      const { title, content, cssClass } = this.buildItemContent(layoutItem, commands)
      const titleHtml = title ? `<div class="grid-item-title">${this.safeText(title)}</div>` : ''
      const contentHtml = `<div class="grid-item-content">${this.safeText(content)}</div>`
      return `<div class="grid-item ${cssClass}" style="grid-column:${layoutItem.col}/span ${layoutItem.colSpan};grid-row:${layoutItem.row}/span ${layoutItem.rowSpan}">${titleHtml}${contentHtml}</div>`
    }).join('')
    return `<div class="container" style="--grid-cols:${layout.cols}">
      ${config.header?.trim() ? `<div class="header">${config.header.trim()}</div>` : ''}
      <div class="grid-container">${grid}</div>
      ${config.footer?.trim() ? `<div class="footer">${config.footer.trim()}</div>` : ''}
    </div>`
  }

  /**
   * 构建单个布局项目的内容
   * @private
   * @param {LayoutItem} layoutItem - 布局项目配置
   * @param {any[]} commands - 命令数据数组
   * @returns {{title: string; content: string; cssClass: string}} 包含标题、内容和CSS类名的对象
   */
  private buildItemContent(layoutItem: LayoutItem, commands: any[]): { title: string; content: string; cssClass: string } {
    const { commandName, itemType } = layoutItem
    const cmd = commands.find(c => c.name === commandName) ||
               commands.flatMap(c => c.subs || []).find(s => s.name === commandName)
    if (!cmd) return { title: commandName, content: '命令未找到', cssClass: 'error' }
    const contentMap = {
      desc: () => ({ title: cmd.name, content: cmd.desc || '无描述', cssClass: 'description' }),
      usage: () => ({ title: '使用方法', content: cmd.usage || '无使用说明', cssClass: 'usage' }),
      examples: () => ({
        title: `使用示例 (${cmd.examples?.length || 0})`,
        content: cmd.examples?.length ? cmd.examples.join('\n\n') : '无示例',
        cssClass: 'examples'
      }),
      options: () => ({
        title: `选项参数 (${cmd.options?.length || 0})`,
        content: cmd.options?.length ? cmd.options.map(o => {
          const syntax = o.syntax || o.name
          return o.desc ? `${syntax}\n  ${o.desc}` : syntax
        }).join('\n\n') : '无选项',
        cssClass: 'option'
      }),
      subs: () => ({
        title: `子命令 (${cmd.subs?.length || 0})`,
        content: cmd.subs?.length ? cmd.subs.map(s => `${s.name} - ${s.desc || '无描述'}`).join('\n') : '无子命令',
        cssClass: 'subCommand'
      })
    }
    return contentMap[itemType]?.() || contentMap.desc()
  }

  /**
   * 转义 HTML 特殊字符，防止 XSS 攻击
   * @private
   * @param {string} str - 需要转义的字符串
   * @returns {string} 转义后的安全字符串
   */
  private safeText(str: string): string {
    return String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m])
  }
}

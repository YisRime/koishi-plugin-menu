import { Command } from './extract'

/**
 * 渲染配置接口
 */
interface Config {
  fontUrl?: string
  bgImage?: string
  primary: string
  secondary: string
  bgColor: string
  textColor: string
  radius: number
  padding: number
  fontSize: number
  titleSize: number
  header?: string
  footer?: string
  customCss?: string
}

/**
 * 主题渲染器，生成 HTML 菜单页面
 */
export class Render {
  /**
   * 构建完整的 HTML 页面
   * @param config 渲染配置
   * @param commands 命令列表
   * @param cmdName 指定命令名称
   * @returns 完整的 HTML 字符串
   */
  build(config: Config, commands: Command[], cmdName?: string): string {
    const css = this.style(config)
    const customCss = config.customCss?.trim() || ''
    const body = this.content(config, commands, cmdName)
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}${customCss ? '\n/* 自定义样式 */\n' + customCss : ''}</style></head><body>${body}</body></html>`
  }

  /**
   * 生成 CSS 样式
   * @param config 渲染配置
   * @returns CSS 字符串
   */
  private style(config: Config): string {
    const { fontUrl, bgImage, primary, secondary, bgColor, textColor, radius, padding, fontSize, titleSize } = config
    const bgStyle = bgImage
      ? `var(--bg) url('${bgImage}') center/cover`
      : `linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(56, 189, 248, 0.06) 50%, var(--bg) 100%)`
    return `${fontUrl ? `@import url('${fontUrl}');` : ''}
:root {
  --primary: ${primary}; --secondary: ${secondary}; --bg: ${bgColor}; --text: ${textColor};
  --text-light: rgba(100, 116, 139, 0.6); --border: rgba(139, 92, 246, 0.12);
  --radius: ${radius}px; --spacing: ${padding}px; --gap: ${Math.max(padding * 0.75, 10)}px;
  --font: system-ui, -apple-system, 'Segoe UI', sans-serif; --fs: ${fontSize}px; --title-scale: ${titleSize};
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font: 400 var(--fs)/1.6 var(--font); color: var(--text); background: ${bgStyle};
  padding: calc(var(--spacing) * 2); min-height: 100vh; display: flex; align-items: center; justify-content: center;
}
.container { width: 100%; max-width: 640px; background: rgba(255, 255, 255, 0.98); border-radius: calc(var(--radius) * 1.5); overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.06), 0 8px 20px rgba(139, 92, 246, 0.08); border: 1px solid var(--border); }
.header { background: linear-gradient(135deg, rgba(139, 92, 246, 0.9) 0%, rgba(56, 189, 248, 0.85) 100%); color: white; padding: calc(var(--spacing) * 1.5); text-align: center; font-weight: 600; font-size: calc(var(--fs) * var(--title-scale)); }
.content { padding: var(--gap); background: linear-gradient(135deg, rgba(248, 250, 252, 0.8) 0%, rgba(255, 255, 255, 0.95) 100%); }
.group-section { margin-bottom: calc(var(--gap) * 1.5); }
.group-section:last-child { margin-bottom: 0; }
.group-title { font-weight: 600; font-size: calc(var(--fs) * 1.2); margin-bottom: var(--gap); padding-bottom: calc(var(--gap) * 0.5); border-bottom: 2px solid rgba(139, 92, 246, 0.15); background: linear-gradient(90deg, rgba(139, 92, 246, 0.9), rgba(56, 189, 248, 0.8)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.commands-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--gap); }
.command-card { background: rgba(255, 255, 255, 0.96); border-radius: var(--radius); padding: var(--spacing); border: 1px solid rgba(139, 92, 246, 0.08); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03); position: relative; overflow: hidden; transition: all 0.2s ease; }
.command-card::before { content: ''; position: absolute; top: 0; left: 0; width: 6px; height: 100%; background: linear-gradient(180deg, rgba(139, 92, 246, 0.7) 0%, rgba(56, 189, 248, 0.7) 100%); opacity: 0.6; }
.command-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06); }
.command-name { font-weight: 600; font-size: calc(var(--fs) * 1.1); margin-bottom: calc(var(--spacing) * 0.5); background: linear-gradient(90deg, rgba(139, 92, 246, 0.9), rgba(56, 189, 248, 0.8)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.command-desc { color: var(--text-light); line-height: 1.5; margin-bottom: calc(var(--spacing) * 0.75); }
.command-details { display: grid; gap: calc(var(--spacing) * 0.75); }
.detail-section { background: rgba(248, 250, 252, 0.6); border-radius: calc(var(--radius) * 0.75); padding: calc(var(--spacing) * 0.75); border: 1px solid rgba(139, 92, 246, 0.06); }
.detail-title { font-weight: 600; font-size: calc(var(--fs) * 0.95); margin-bottom: calc(var(--spacing) * 0.5); }
.detail-content { color: var(--text-light); font-size: calc(var(--fs) * 0.9); line-height: 1.5; white-space: pre-wrap; }
.footer { background: linear-gradient(135deg, rgba(248, 250, 252, 0.8) 0%, rgba(255, 255, 255, 0.96) 100%); color: var(--text-light); padding: calc(var(--spacing) * 0.8); text-align: center; font-size: calc(var(--fs) * 0.85); border-top: 1px solid rgba(139, 92, 246, 0.08); }
@media (max-width: 480px) { body { padding: var(--spacing); } .container { border-radius: var(--radius); max-width: 100%; } .commands-grid { grid-template-columns: 1fr; } }`
  }

  /**
   * 生成页面主体内容
   * @param config 渲染配置
   * @param commands 命令列表
   * @param cmdName 指定命令名称
   * @returns HTML 主体字符串
   */
  private content(config: Config, commands: Command[], cmdName?: string): string {
    const body = cmdName ? this.detail(commands, cmdName) : this.list(commands)
    const header = config.header?.trim() ? `<div class="header">${config.header.trim()}</div>` : ''
    const footer = config.footer?.trim() ? `<div class="footer">${config.footer.trim()}</div>` : ''
    return `<div class="container">${header}<div class="content">${body}</div>${footer}</div>`
  }

  /**
   * 构建命令列表视图
   * @param commands 命令列表
   * @returns 命令列表 HTML
   */
  private list(commands: Command[]): string {
    const groups = commands.reduce((acc, cmd) => {
      const group = cmd.group || ''
      if (!acc.has(group)) acc.set(group, [])
      acc.get(group).push(cmd)
      return acc
    }, new Map<string, Command[]>())
    return Array.from(groups.entries()).map(([name, cmds]) => {
      const cards = cmds.map(cmd =>
        `<div class="command-card">
          <div class="command-name">${cmd.name}</div>
          <div class="command-desc">${cmd.desc || '无描述'}</div>
        </div>`
      ).join('')
      return `<div class="group-section">
        <div class="group-title">${name} (${cmds.length})</div>
        <div class="commands-grid">${cards}</div>
      </div>`
    }).join('')
  }

  /**
   * 构建命令详情视图
   * @param commands 命令列表
   * @param cmdName 命令名称
   * @returns 命令详情 HTML
   */
  private detail(commands: Command[], cmdName: string): string {
    const cmd = commands.find(c => c.name === cmdName) ||
                commands.flatMap(c => c.subs || []).find(s => s.name === cmdName)
    const parts = [
      cmd.usage?.trim() && this.section('使用方法', cmd.usage),
      cmd.options?.length && this.section(`选项参数 (${cmd.options.length})`,
        cmd.options.map(o => o.desc ? `${o.syntax || o.name}\n  ${o.desc}` : o.syntax || o.name).join('\n\n')),
      cmd.examples?.trim() && this.section('使用示例', cmd.examples),
      cmd.subs?.length && this.section(`子命令 (${cmd.subs.length})`,
        cmd.subs.map(s => `${s.name} - ${s.desc || '无描述'}`).join('\n'))
    ].filter(Boolean).join('')
    return `<div class="command-card">
      <div class="command-name">${cmd.name}</div>
      <div class="command-desc">${cmd.desc || '无描述'}</div>
      <div class="command-details">${parts}</div>
    </div>`
  }

  /**
   * 构建详情区块
   * @param title 区块标题
   * @param content 区块内容
   * @returns 区块 HTML
   */
  private section(title: string, content: string): string {
    return `<div class="detail-section">
      <div class="detail-title">${title}</div>
      <div class="detail-content">${content}</div>
    </div>`
  }
}
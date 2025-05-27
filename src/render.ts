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
  glassBlur?: number
}

/**
 * 主题渲染器，生成 HTML 菜单页面
 */
export class Render {
  /**
   * 构建完整的 HTML 页面
   * @param config 渲染配置
   * @param commands 指令列表
   * @param cmdName 指定指令名称
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
    const { fontUrl, bgImage, primary, secondary, bgColor, textColor, radius, padding, fontSize, titleSize, glassBlur } = config
    const bgStyle = bgImage
      ? `var(--bg) url('${bgImage}') center/cover`
      : `linear-gradient(135deg, ${primary}08 0%, ${secondary}06 50%, var(--bg) 100%)`
    const enableGlass = glassBlur > 0
    const glassEffect = enableGlass
      ? `backdrop-filter: blur(${glassBlur}px); -webkit-backdrop-filter: blur(${glassBlur}px);`
      : ''
    return `${fontUrl ? `@import url('${fontUrl}');` : ''}
:root {
  --primary: ${primary}; --secondary: ${secondary}; --bg: ${bgColor}; --text: ${textColor};
  --text-muted: ${textColor}99; --border: ${primary}20; --shadow: ${primary}10;
  --card-bg: ${bgColor}${enableGlass ? '80' : 'e6'}; --content-bg: ${bgColor}${enableGlass ? '60' : '80'};
  --detail-bg: ${bgColor}${enableGlass ? '70' : 'b3'}; --white-overlay: ${bgColor}${enableGlass ? 'a0' : 'f2'};
  --radius: ${radius}px; --spacing: ${padding}px; --gap: ${Math.max(padding * 0.6, 8)}px;
  --fs: ${fontSize}px; --title-scale: ${titleSize};
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font: var(--fs)/1.5 system-ui, sans-serif; color: var(--text); background: ${bgStyle}; padding: var(--spacing); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
.container { width: fit-content; max-width: 90vw; background: var(--white-overlay); ${glassEffect} border-radius: calc(var(--radius) * 1.2); overflow: hidden; box-shadow: 0 8px 32px var(--shadow); border: 1px solid var(--border); }
.header { background: linear-gradient(135deg, var(--primary), var(--secondary)); color: var(--bg); padding: calc(var(--spacing) * 1.2); text-align: center; font-weight: 600; font-size: calc(var(--fs) * var(--title-scale)); }
.content { padding: var(--gap); background: linear-gradient(135deg, var(--content-bg), var(--white-overlay)); ${glassEffect} width: fit-content; max-width: inherit; }
.group-section { margin-bottom: calc(var(--gap) * 1.5); }
.group-section:last-child { margin-bottom: 0; }
.group-title { font-weight: 600; font-size: calc(var(--fs) * 1.15); margin-bottom: var(--gap); padding-bottom: calc(var(--gap) * 0.4); border-bottom: 2px solid var(--border); background: linear-gradient(90deg, var(--primary), var(--secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.commands-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--gap); width: 100%; max-width: 1200px; }
.command-card { background: var(--card-bg); ${glassEffect} border-radius: var(--radius); padding: var(--spacing); border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow); position: relative; overflow: hidden; min-height: 100px; display: flex; flex-direction: column; }
.command-card.detail-view { width: 100%; max-width: 800px; min-height: auto; margin: 0 auto; }
.command-card::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(180deg, var(--primary), var(--secondary)); }
.command-name { font-weight: 600; font-size: calc(var(--fs) * 1.05); margin-bottom: calc(var(--spacing) * 0.4); background: linear-gradient(90deg, var(--primary), var(--secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.command-desc { color: var(--text-muted); line-height: 1.4; flex: 1; }
.command-card:not(.detail-view) .command-desc { overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.command-details { display: grid; gap: calc(var(--spacing) * 0.6); margin-top: calc(var(--spacing) * 0.6); }
.detail-section { background: var(--detail-bg); ${glassEffect} border-radius: calc(var(--radius) * 0.6); padding: calc(var(--spacing) * 0.6); border: 1px solid var(--border); }
.detail-title { font-weight: 600; font-size: calc(var(--fs) * 0.9); margin-bottom: calc(var(--spacing) * 0.4); color: var(--primary); }
.detail-content { color: var(--text-muted); font-size: calc(var(--fs) * 0.85); line-height: 1.4; white-space: pre-wrap; }
.footer { background: var(--card-bg); ${glassEffect} color: var(--text-muted); padding: calc(var(--spacing) * 0.6); text-align: center; font-size: calc(var(--fs) * 0.8); border-top: 1px solid var(--border); }
@media (max-width: 768px) { .commands-grid { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); } }
@media (max-width: 480px) { body { padding: calc(var(--spacing) * 0.5); } .container { border-radius: var(--radius); max-width: 95vw; } .commands-grid { grid-template-columns: 1fr; } .content { width: auto; } }`
  }

  /**
   * 生成页面主体内容
   * @param config 渲染配置
   * @param commands 指令列表
   * @param cmdName 指定指令名称
   * @returns HTML 主体字符串
   */
  private content(config: Config, commands: Command[], cmdName?: string): string {
    const body = cmdName ? this.detail(commands, cmdName) : this.list(commands)
    const header = config.header?.trim() ? `<div class="header">${config.header.trim()}</div>` : ''
    const footer = config.footer?.trim() ? `<div class="footer">${config.footer.trim()}</div>` : ''
    return `<div class="container">${header}<div class="content">${body}</div>${footer}</div>`
  }

  /**
   * 构建指令列表视图
   * @param commands 指令列表
   * @returns 指令列表 HTML
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
   * 构建指令详情视图
   * @param commands 指令列表
   * @param cmdName 指令名称
   * @returns 指令详情 HTML
   */
  private detail(commands: Command[], cmdName: string): string {
    const cmd = commands.find(c => c.name === cmdName) ||
                commands.flatMap(c => c.subs || []).find(s => s.name === cmdName)
    const parts = [
      cmd.usage?.trim() && this.section('使用方法', cmd.usage),
      cmd.options?.length && this.section(`选项参数 (${cmd.options.length})`,
        cmd.options.map(o => o.desc ? `${o.syntax || o.name}\n  ${o.desc}` : o.syntax || o.name).join('\n')),
      cmd.examples?.trim() && this.section('使用示例', cmd.examples),
      cmd.subs?.length && this.section(`子指令 (${cmd.subs.length})`,
        cmd.subs.map(s => `${s.name} - ${s.desc || '无描述'}`).join('\n'))
    ].filter(Boolean).join('')
    return `<div class="command-card detail-view">
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
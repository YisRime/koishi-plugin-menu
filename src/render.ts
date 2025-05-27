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
  glassBlur: number
}

/**
 * 主题渲染器
 *
 * 负责生成HTML菜单页面，支持响应式设计、毛玻璃效果、自定义主题等功能
 */
export class Render {
  /**
   * 构建完整的HTML页面
   */
  build(config: Config, commands: Command[], cmdName?: string): string {
    const css = this.buildCSS(config)
    const customCss = config.customCss?.trim()
    const body = this.buildContent(config, commands, cmdName)

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}${customCss ? '\n/* 自定义样式 */\n' + customCss : ''}</style></head><body>${body}</body></html>`
  }

  private buildCSS(config: Config): string {
    const { fontUrl, bgImage, primary, secondary, bgColor, textColor, radius, padding, fontSize, titleSize, glassBlur } = config

    const bgStyle = bgImage
      ? `var(--bg) url('${bgImage}') center/cover`
      : `linear-gradient(135deg, ${primary}08 0%, ${secondary}06 50%, var(--bg) 100%)`

    const enableGlass = glassBlur > 0
    const glassEffect = enableGlass ? `backdrop-filter: blur(${glassBlur}px); -webkit-backdrop-filter: blur(${glassBlur}px);` : ''

    const alpha = enableGlass ? 0.7 : 0.9
    const lightAlpha = enableGlass ? 0.6 : 0.8
    const heavyAlpha = enableGlass ? 0.9 : 0.95

    return `${fontUrl ? `@import url('${fontUrl}');` : ''}
:root {
  --primary: ${primary}; --secondary: ${secondary}; --bg: ${bgColor}; --text: ${textColor};
  --text-muted: ${textColor}99; --border: ${primary}20; --shadow: ${primary}10;
  --glass-alpha: ${alpha.toFixed(1)}; --light-alpha: ${lightAlpha.toFixed(1)}; --heavy-alpha: ${heavyAlpha.toFixed(1)};
  --radius: ${radius}px; --spacing: ${padding}px; --gap: ${Math.max(padding * 0.6, 8)}px;
  --fs: ${fontSize}px; --title-scale: ${titleSize};
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font: var(--fs)/1.5 system-ui, sans-serif; color: var(--text); background: ${bgStyle}; padding: var(--spacing); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
.container { width: fit-content; max-width: 90vw; background: color-mix(in srgb, var(--bg) var(--light-alpha), transparent); ${glassEffect} border-radius: calc(var(--radius) * 1.2); overflow: hidden; box-shadow: 0 8px 32px var(--shadow); border: 1px solid var(--border); }
.header { background: linear-gradient(135deg, var(--primary), var(--secondary)); color: var(--bg); padding: calc(var(--spacing) * 1.2); text-align: center; font-weight: 600; font-size: calc(var(--fs) * var(--title-scale)); }
.content { padding: var(--gap); background: color-mix(in srgb, var(--bg) var(--glass-alpha), transparent); ${glassEffect} }
.group-section:not(:last-child) { margin-bottom: calc(var(--gap) * 1.5); }
.group-title { font-weight: 600; font-size: calc(var(--fs) * 1.15); margin-bottom: var(--gap); padding-bottom: calc(var(--gap) * 0.4); border-bottom: 2px solid var(--border); background: linear-gradient(90deg, var(--primary), var(--secondary)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.commands-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--gap); max-width: 1200px; }
.command-card { background: color-mix(in srgb, var(--bg) var(--light-alpha), transparent); border-radius: var(--radius); border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow); position: relative; min-height: 100px; overflow: hidden; }
.command-card.detail-view { max-width: 800px; margin: 0 auto; }
.command-card::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(180deg, var(--primary), var(--secondary)); z-index: 1; }
.command-card-content { padding: var(--spacing); background: color-mix(in srgb, var(--bg) var(--heavy-alpha), transparent); ${glassEffect} position: relative; z-index: 2; height: 100%; display: flex; flex-direction: column; margin-left: 4px; }
.command-name { font-weight: 600; font-size: calc(var(--fs) * 1.05); margin-bottom: calc(var(--spacing) * 0.4); background: linear-gradient(90deg, var(--primary), var(--secondary)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.command-desc { color: var(--text-muted); line-height: 1.4; flex: 1; }
.command-card:not(.detail-view) .command-desc { overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.command-details { display: grid; gap: calc(var(--spacing) * 0.6); margin-top: calc(var(--spacing) * 0.6); }
.detail-section { background: color-mix(in srgb, var(--bg) var(--glass-alpha), transparent); ${glassEffect} border-radius: calc(var(--radius) * 0.6); padding: calc(var(--spacing) * 0.6); border: 1px solid var(--border); }
.detail-title { font-weight: 600; font-size: calc(var(--fs) * 0.9); margin-bottom: calc(var(--spacing) * 0.4); color: var(--primary); }
.detail-content { color: var(--text-muted); font-size: calc(var(--fs) * 0.85); line-height: 1.4; white-space: pre-wrap; }
.footer { background: color-mix(in srgb, var(--bg) var(--light-alpha), transparent); ${glassEffect} color: var(--text-muted); padding: calc(var(--spacing) * 0.6); text-align: center; font-size: calc(var(--fs) * 0.8); border-top: 1px solid var(--border); }
@media (max-width: 768px) { .commands-grid { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); } }
@media (max-width: 480px) { body { padding: calc(var(--spacing) * 0.5); } .container { border-radius: var(--radius); max-width: 95vw; } .commands-grid { grid-template-columns: 1fr; } }`
  }

  private buildContent(config: Config, commands: Command[], cmdName?: string): string {
    const body = cmdName ? this.buildDetail(commands, cmdName) : this.buildList(commands)
    const header = config.header?.trim() ? `<div class="header">${config.header.trim()}</div>` : ''
    const footer = config.footer?.trim() ? `<div class="footer">${config.footer.trim()}</div>` : ''
    return `<div class="container">${header}<div class="content">${body}</div>${footer}</div>`
  }

  /**
   * 构建指令列表视图
   */
  private buildList(commands: Command[]): string {
    const groups = commands.reduce((acc, cmd) => {
      const group = cmd.group || ''
      if (!acc.has(group)) acc.set(group, [])
      acc.get(group).push(cmd)
      return acc
    }, new Map<string, Command[]>())

    return Array.from(groups.entries()).map(([name, cmds]) => {
      const cards = cmds.map(cmd =>
        `<div class="command-card">
          <div class="command-card-content">
            <div class="command-name">${cmd.name}</div>
            <div class="command-desc">${cmd.desc || '无描述'}</div>
          </div>
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
   */
  private buildDetail(commands: Command[], cmdName: string): string {
    const cmd = this.findCommandByNameOrAlias(commands, cmdName)
    if (!cmd) return this.buildErrorCard('未找到指令')

    const aliasInfo = this.buildAliasInfo(cmd)
    const sections = [
      aliasInfo && this.buildSection('别名', aliasInfo),
      cmd.usage?.trim() && this.buildSection('使用方法', cmd.usage),
      cmd.options?.length && this.buildSection(`选项参数 (${cmd.options.length})`,
        cmd.options.map(o => o.desc ? `${o.syntax || o.name}\n  ${o.desc}` : o.syntax || o.name).join('\n')),
      cmd.examples?.trim() && this.buildSection('使用示例', cmd.examples),
      cmd.subs?.length && this.buildSection(`子指令 (${cmd.subs.length})`,
        cmd.subs.map(s => `${s.name} - ${s.desc || '无描述'}`).join('\n'))
    ].filter(Boolean).join('')

    return `<div class="command-card detail-view">
      <div class="command-card-content">
        <div class="command-name">${cmd.name}</div>
        <div class="command-desc">${cmd.desc || '无描述'}</div>
        <div class="command-details">${sections}</div>
      </div>
    </div>`
  }

  /**
   * 通过名称或别名查找指令
   */
  private findCommandByNameOrAlias(commands: Command[], nameOrAlias: string): Command | null {
    return commands.find(c => c.name === nameOrAlias || c.aliases.some(alias => alias.name === nameOrAlias && alias.enabled)) ||
           commands.flatMap(c => c.subs || []).find(s => s.name === nameOrAlias || s.aliases.some(alias => alias.name === nameOrAlias && alias.enabled)) ||
           null
  }

  /**
   * 构建别名信息
   */
  private buildAliasInfo(cmd: Command): string {
    const enabledAliases = cmd.aliases.filter(alias => alias.enabled)
    const disabledAliases = cmd.aliases.filter(alias => !alias.enabled)

    if (enabledAliases.length <= 1 && disabledAliases.length === 0) return ''

    const parts: string[] = []

    if (enabledAliases.length > 1) {
      const otherEnabledAliases = enabledAliases.filter(alias => !alias.isDefault).map(alias => alias.name)
      if (otherEnabledAliases.length > 0) {
        parts.push(`可用: ${otherEnabledAliases.join(', ')}`)
      }
    }

    if (disabledAliases.length > 0) {
      parts.push(`已禁用: ${disabledAliases.map(alias => alias.name).join(', ')}`)
    }

    return parts.join('\n')
  }

  private buildSection(title: string, content: string): string {
    return `<div class="detail-section">
      <div class="detail-title">${title}</div>
      <div class="detail-content">${content}</div>`
  }

  private buildErrorCard(message: string): string {
    return `<div class="command-card detail-view">
      <div class="command-card-content">
        <div class="command-name">${message}</div>
      </div>
    </div>`
  }
}

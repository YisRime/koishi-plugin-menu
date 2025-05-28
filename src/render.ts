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
 * @description 负责生成HTML内容和CSS样式
 */
export class Render {
  /**
   * 构建完整的HTML页面
   * @param config 渲染配置
   * @param commands 指令列表
   * @param cmdName 可选的指令名称
   * @returns 完整的HTML字符串
   */
  build(config: Config, commands: Command[], cmdName?: string): string {
    const css = this.buildCSS(config)
    const body = this.buildContent(config, commands, cmdName)
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}${config.customCss ? '\n' + config.customCss : ''}</style></head><body>${body}</body></html>`
  }

  /**
   * 生成CSS样式
   * @param config 渲染配置
   * @returns CSS样式字符串
   */
  private buildCSS(config: Config): string {
    const { fontUrl, bgImage, primary, secondary, bgColor, textColor, radius, padding, fontSize, titleSize, glassBlur } = config
    const bodyBg = bgImage ? `url('${bgImage}') center/cover fixed, linear-gradient(135deg, ${primary}1a, ${secondary}0d)` : `linear-gradient(135deg, ${primary}26 0%, ${secondary}1a 50%, ${bgColor} 100%)`
    const containerBg = bgImage ? 'transparent' : (glassBlur > 0 ? `${bgColor}d9` : `${bgColor}f2`)
    const glassEffect = glassBlur > 0 ? `backdrop-filter: blur(${glassBlur}px); -webkit-backdrop-filter: blur(${glassBlur}px);` : ''

    return `${fontUrl ? `@import url('${fontUrl}');` : ''}
:root {
  --primary: ${primary}; --secondary: ${secondary}; --bg: ${bgColor}; --text: ${textColor};
  --radius: ${radius}px; --padding: ${padding}px; --font-size: ${fontSize}px; --title-size: ${fontSize * titleSize}px;
}
* { box-sizing: border-box; }
body {
  font: var(--font-size)/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--text); background: ${bodyBg}; padding: var(--padding);
  display: flex; align-items: flex-start; justify-content: center;
}
.container {
  background: ${containerBg}; ${bgImage && glassBlur > 0 ? glassEffect : ''}
  border-radius: calc(var(--radius) * 1.5); padding: calc(var(--padding) * 1.2);
  ${bgImage ? '' : `box-shadow: 0 20px 40px ${primary}26; border: 1px solid ${primary}33;`}
  display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: calc(var(--padding) * 0.8); width: 100%;
}
.header, .group-title {
  grid-column: 1 / -1; text-align: center; font-weight: 700;
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  color: white; border-radius: var(--radius);
}
.header { font-size: var(--title-size); padding: calc(var(--padding) * 1.5); }
.group-title { font-size: calc(var(--font-size) * 1.25); padding: calc(var(--padding) * 0.8) calc(var(--padding) * 1.2); margin-top: calc(var(--padding) * 0.6); }
.group-title:first-child { margin-top: 0; }
.command-card, .detail-card {
  background: ${glassBlur > 0 ? `${bgColor}cc` : `${bgColor}f2`}; ${glassEffect}
  border-radius: var(--radius); border: 1px solid ${primary}33;
  position: relative; overflow: hidden;
}
.command-card.main-command { grid-column: 1 / -1; }
.command-card::before, .detail-card::before {
  content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%;
  background: linear-gradient(180deg, var(--primary), var(--secondary));
}
.detail-card::before { width: 3px; }
.command-card-content, .detail-card-content {
  padding: calc(var(--padding) * 1.1); margin-left: 4px;
  background: ${glassBlur > 0 ? `${bgColor}b3` : `${bgColor}f2`}; ${glassEffect}
}
.detail-card-content { margin-left: 3px; padding: var(--padding); }
.command-name, .detail-title {
  font-weight: 700; margin-bottom: calc(var(--padding) * 0.5);
  background: linear-gradient(90deg, var(--primary), var(--secondary));
  -webkit-background-clip: text; color: transparent;
}
.command-name { font-size: calc(var(--font-size) * 1.1); }
.detail-title { font-size: calc(var(--font-size) * 1.05); }
.command-desc, .detail-content {
  color: ${textColor}cc; line-height: 1.5;
}
.command-desc { font-size: calc(var(--font-size) * 0.9); }
.detail-content { font-size: calc(var(--font-size) * 0.88); white-space: pre-wrap; }
.command-card:not(.main-command) .command-desc {
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.footer {
  grid-column: 1 / -1; text-align: center; font-size: calc(var(--font-size) * 0.85);
  background: ${glassBlur > 0 ? `${bgColor}cc` : `${bgColor}f2`}; ${glassEffect}
  color: ${textColor}b3; padding: calc(var(--padding) * 0.8);
  border: 1px solid ${primary}1a; border-radius: var(--radius);
}
@media (max-width: 768px) { .container { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); } }
@media (max-width: 480px) {
  body { padding: calc(var(--padding) * 0.6); }
  .container { grid-template-columns: 1fr; padding: calc(var(--padding) * 0.8); }
  .header, .footer, .group-title { white-space: normal; }
}`

  }

  /**
   * 构建页面内容
   * @param config 渲染配置
   * @param commands 指令列表
   * @param cmdName 可选的指令名称
   * @returns HTML内容字符串
   */
  private buildContent(config: Config, commands: Command[], cmdName?: string): string {
    const body = cmdName ? this.buildDetail(commands, cmdName) : this.buildList(commands)
    const header = config.header ? `<div class="header">${config.header}</div>` : ''
    const footer = config.footer ? `<div class="footer">${config.footer}</div>` : ''
    return `<div class="container">${header}${body}${footer}</div>`
  }

  /**
   * 构建指令列表视图
   * @param commands 指令列表
   * @returns HTML字符串
   */
  private buildList(commands: Command[]): string {
    const groups = new Map<string, Command[]>()
    commands.forEach(cmd => {
      const group = cmd.group || ''
      if (!groups.has(group)) groups.set(group, [])
      groups.get(group)!.push(cmd)
    })
    const elements: string[] = []
    groups.forEach((cmds, name) => {
      elements.push(`<div class="group-title">${name} (${cmds.length})</div>`)
      cmds.forEach(cmd => {
        elements.push(`<div class="command-card"><div class="command-card-content"><div class="command-name">${cmd.name.name}</div><div class="command-desc">${cmd.desc || '无描述'}</div></div></div>`)
      })
    })
    return elements.join('')
  }

  /**
   * 构建指令详情视图
   * @param commands 指令列表
   * @param cmdName 指令名称
   * @returns HTML字符串
   */
  private buildDetail(commands: Command[], cmdName: string): string {
    const cmd = this.findCommand(commands, cmdName)
    if (!cmd) return '<div class="command-card main-command"><div class="command-card-content"><div class="command-name">未找到指令</div></div></div>'
    const elements: string[] = []
    elements.push(`<div class="command-card main-command"><div class="command-card-content"><div class="command-name">${cmd.name.name}</div><div class="command-desc">${cmd.desc || '无描述'}</div></div></div>`)
    // 名称状态卡片
    if (!cmd.name.enabled || cmd.name.isDefault) {
      const parts = []
      if (!cmd.name.enabled) parts.push('状态: 已禁用')
      if (cmd.name.isDefault) parts.push('类型: 默认名称')
      if (parts.length) elements.push(this.buildDetailCard('名称信息', parts.join('\n')))
    }
    // 其他详情卡片
    if (cmd.usage) elements.push(this.buildDetailCard('使用方法', cmd.usage))
    if (cmd.options?.length) {
      const content = cmd.options.map(o => o.desc ? `${o.syntax || o.name}\n  ${o.desc}` : o.syntax || o.name).join('\n')
      elements.push(this.buildDetailCard(`选项参数 (${cmd.options.length})`, content))
    }
    if (cmd.examples) elements.push(this.buildDetailCard('使用示例', cmd.examples))
    if (cmd.subs?.length) {
      const content = cmd.subs.map(s => `${s.name.name} - ${s.desc || '无描述'}`).join('\n')
      elements.push(this.buildDetailCard(`子指令 (${cmd.subs.length})`, content))
    }
    return elements.join('')
  }

  /**
   * 查找指令
   * @param commands 指令列表
   * @param nameOrAlias 指令名称或别名
   * @returns 找到的指令或null
   */
  private findCommand(commands: Command[], nameOrAlias: string): Command | null {
    for (const cmd of commands) {
      if (cmd.name.name === nameOrAlias && cmd.name.enabled) return cmd
      if (cmd.subs) {
        const sub = cmd.subs.find(s => s.name.name === nameOrAlias && s.name.enabled)
        if (sub) return sub
      }
    }
    return null
  }

  /**
   * 构建详情卡片
   * @param title 卡片标题
   * @param content 卡片内容
   * @returns HTML字符串
   */
  private buildDetailCard(title: string, content: string): string {
    return `<div class="detail-card"><div class="detail-card-content"><div class="detail-title">${title}</div><div class="detail-content">${content}</div></div></div>`
  }
}
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
    const bodyBg = bgImage
      ? `url('${bgImage}') center/cover fixed, linear-gradient(135deg, ${primary.replace(/[\d.]+\)$/, '0.1)')}, ${secondary.replace(/[\d.]+\)$/, '0.05)')})`
      : `linear-gradient(135deg, ${primary.replace(/[\d.]+\)$/, '0.15)')} 0%, ${secondary.replace(/[\d.]+\)$/, '0.1)')} 50%, ${bgColor} 100%)`
    const containerBg = bgImage ? 'transparent' : (glassBlur > 0 ? bgColor.replace(/[\d.]+\)$/, '0.85)') : bgColor.replace(/[\d.]+\)$/, '0.95)'))
    const cardBg = glassBlur > 0 ? bgColor.replace(/[\d.]+\)$/, '0.8)') : bgColor.replace(/[\d.]+\)$/, '0.95)')
    const contentBg = glassBlur > 0 ? bgColor.replace(/[\d.]+\)$/, '0.7)') : bgColor.replace(/[\d.]+\)$/, '0.95)')
    const glassEffect = glassBlur > 0 ? `backdrop-filter:blur(${glassBlur}px);-webkit-backdrop-filter:blur(${glassBlur}px);` : ''
    return `${fontUrl ? `@import url('${fontUrl}');` : ''}
:root{--primary:${primary};--secondary:${secondary};--bg:${bgColor};--text:${textColor};--radius:${radius}px;--padding:${padding}px;--font-size:${fontSize}px;--title-size:${fontSize * titleSize}px}
*{box-sizing:border-box}
body{font:var(--font-size)/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--text);background:${bodyBg};padding:var(--padding);display:flex;align-items:flex-start;justify-content:center;min-height:100vh}
.container{background:${containerBg};${bgImage && glassBlur > 0 ? glassEffect : ''}border-radius:calc(var(--radius)*1.5);padding:calc(var(--padding)*1.2);${bgImage ? '' : `box-shadow:0 20px 40px ${primary.replace(/[\d.]+\)$/, '0.15)')},0 8px 32px ${primary.replace(/[\d.]+\)$/, '0.1)')};border:1px solid ${primary.replace(/[\d.]+\)$/, '0.2)')};`}display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:calc(var(--padding)*0.8);width:100%;max-width:925px}
.container.detail-view{display:flex;flex-direction:column;max-width:800px;width:auto;min-width:400px}
.header,.group-title{grid-column:1/-1;text-align:center;font-weight:700;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;border-radius:var(--radius);position:relative;overflow:hidden}
.detail-view .header{grid-column:unset}
.header::before,.group-title::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(135deg,transparent 0%,${primary.replace(/[\d.]+\)$/, '0.1)')} 50%,transparent 100%);pointer-events:none}
.header{font-size:var(--title-size);padding:calc(var(--padding)*1.5)}
.group-title{font-size:calc(var(--font-size)*1.25);padding:calc(var(--padding)*0.8) calc(var(--padding)*1.2);margin-top:calc(var(--padding)*0.6)}
.group-title:first-child{margin-top:0}
.command-card,.detail-card{background:${cardBg};${glassEffect}border-radius:var(--radius);border:1px solid ${primary.replace(/[\d.]+\)$/, '0.2)')};position:relative;overflow:hidden;transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.command-card:hover,.detail-card:hover{transform:translateY(-2px);box-shadow:0 12px 24px ${primary.replace(/[\d.]+\)$/, '0.15)')},0 4px 16px ${primary.replace(/[\d.]+\)$/, '0.1)')};border-color:${primary.replace(/[\d.]+\)$/, '0.3)')}}
.command-card.main-command{grid-column:1/-1}
.detail-view .command-card.main-command{grid-column:unset;margin-bottom:calc(var(--padding)*0.8)}
.detail-view .detail-card{margin-bottom:calc(var(--padding)*0.8);width:100%;min-width:300px;max-width:100%}
.detail-view .detail-card:last-child{margin-bottom:0}
.command-card::before,.detail-card::before{content:'';position:absolute;top:0;left:0;width:4px;height:100%;background:linear-gradient(180deg,var(--primary),var(--secondary))}
.detail-card::before{width:3px}
.command-card-content,.detail-card-content{padding:calc(var(--padding)*1.1);margin-left:4px;background:${contentBg};${glassEffect}}
.detail-card-content{margin-left:3px;padding:var(--padding)}
.command-name,.detail-title{font-weight:700;margin-bottom:calc(var(--padding)*0.5);background:linear-gradient(90deg,var(--primary),var(--secondary));-webkit-background-clip:text;background-clip:text;color:transparent;display:inline-block}
.command-name{font-size:calc(var(--font-size)*1.1)}
.detail-title{font-size:calc(var(--font-size)*1.05)}
.command-desc,.detail-content{color:${textColor.replace(/[\d.]+\)$/, '0.8)')};line-height:1.5}
.command-desc{font-size:calc(var(--font-size)*0.9)}
.detail-content{font-size:calc(var(--font-size)*0.88);white-space:pre-wrap}
.command-card:not(.main-command) .command-desc{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.footer{grid-column:1/-1;text-align:center;font-size:calc(var(--font-size)*0.85);background:${cardBg};${glassEffect}color:${textColor.replace(/[\d.]+\)$/, '0.7)')};padding:calc(var(--padding)*0.8);border:1px solid ${primary.replace(/[\d.]+\)$/, '0.1)')};border-radius:var(--radius)}
.detail-view .footer{grid-column:unset;margin-top:calc(var(--padding)*0.8)}
@media(min-width:1200px){.container:not(.detail-view){grid-template-columns:repeat(auto-fit,minmax(211px,1fr));max-width:1056px}}
@media(max-width:1199px)and(min-width:900px){.container:not(.detail-view){grid-template-columns:repeat(auto-fit,minmax(198px,1fr))}}
@media(max-width:899px)and(min-width:600px){.container:not(.detail-view){grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:calc(var(--padding)*0.6)}}
@media(max-width:599px){body{padding:calc(var(--padding)*0.6)}.container:not(.detail-view){grid-template-columns:1fr;padding:calc(var(--padding)*0.8);gap:calc(var(--padding)*0.5)}.container.detail-view{min-width:unset;padding:calc(var(--padding)*0.8)}.header{font-size:calc(var(--title-size)*0.9)}.group-title{font-size:calc(var(--font-size)*1.1)}.command-card-content,.detail-card-content{padding:calc(var(--padding)*0.9)}.detail-view .detail-card{min-width:unset}}`
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
    const containerClass = cmdName ? 'container detail-view' : 'container'
    return `<div class="${containerClass}">${header}${body}${footer}</div>`
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
        const primaryName = cmd.name.find(n => n.isDefault)?.name || cmd.name[0]?.name || ''
        elements.push(`<div class="command-card"><div class="command-card-content"><div class="command-name">${primaryName}</div><div class="command-desc">${cmd.desc || '无描述'}</div></div></div>`)
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
    const cmd = commands.find(c => c.name.some(n => n.name === cmdName && n.enabled)) || commands[0]
    if (!cmd) return `<div class="command-card main-command"><div class="command-card-content"><div class="command-name">指令未找到</div><div class="command-desc">未找到指令 "${cmdName}"</div></div></div>`
    const elements: string[] = []
    const primaryName = cmd.name.find(n => n.isDefault)?.name || cmd.name[0]?.name || ''
    elements.push(`<div class="command-card main-command"><div class="command-card-content"><div class="command-name">${primaryName}</div><div class="command-desc">${cmd.desc || '无描述'}</div></div></div>`)
    // 别名卡片
    const aliases = cmd.name.filter(n => !n.isDefault && n.enabled).map(n => n.name)
    if (aliases.length > 0) {
      const aliasesText = aliases.join(', ')
      elements.push(this.buildDetailCard('指令别名', aliasesText))
    }
    // 其他详情卡片
    if (cmd.usage) elements.push(this.buildDetailCard('使用方法', cmd.usage))
    if (cmd.options?.length) {
      const content = cmd.options.map(o => o.desc ? `${o.syntax || o.name}\n  ${o.desc}` : o.syntax || o.name).join('\n')
      elements.push(this.buildDetailCard(`选项参数 (${cmd.options.length})`, content))
    }
    if (cmd.examples) elements.push(this.buildDetailCard('使用示例', cmd.examples))
    if (cmd.subs?.length) {
      const content = cmd.subs.map(s => `${s.name.find(n => n.isDefault)?.name || s.name[0]?.name || ''} - ${s.desc || '无描述'}`).join('\n')
      elements.push(this.buildDetailCard(`子指令 (${cmd.subs.length})`, content))
    }
    return elements.join('')
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
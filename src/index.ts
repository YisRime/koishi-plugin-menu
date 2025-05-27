import { Context, Schema, Logger, h, Computed } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import { Extract } from './extract'
import { FileStore } from './utils'
import { Render } from './render'

declare module 'koishi' {
  namespace Command {
    interface Config {
      /** 在菜单中隐藏指令 */
      hidden?: Computed<boolean>
      /** 指令分组名称 */
      group?: Computed<string>
    }
  }
  namespace Argv {
    interface OptionConfig {
      /** 在菜单中隐藏选项 */
      hidden?: Computed<boolean>
    }
  }
}

export const name = 'menu'
export const inject = ['puppeteer']
export const logger = new Logger('menu')

export const usage = `
<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">📌 插件说明</h2>
  <p>📖 <strong>使用文档</strong>：请点击左上角的 <strong>插件主页</strong> 查看插件使用文档</p>
  <p>🔍 <strong>更多插件</strong>：可访问 <a href="https://github.com/YisRime" style="color:#4a6ee0;text-decoration:none;">苡淞的 GitHub</a> 查看本人的所有插件</p>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #e0574a;">❤️ 支持与反馈</h2>
  <p>🌟 喜欢这个插件？请在 <a href="https://github.com/YisRime" style="color:#e0574a;text-decoration:none;">GitHub</a> 上给我一个 Star！</p>
  <p>🐛 遇到问题？请通过 <strong>Issues</strong> 提交反馈，或加入 QQ 群 <a href="https://qm.qq.com/q/PdLMx9Jowq" style="color:#e0574a;text-decoration:none;"><strong>855571375</strong></a> 进行交流</p>
</div>
`

/**
 * 插件配置接口
 */
export interface Config {
  /** 指令数据源类型 */
  source: 'file' | 'inline'
  /** 是否启用缓存 */
  enableCache: boolean
  /** 内边距大小，单位为像素 */
  padding: number
  /** 圆角大小，单位为像素 */
  radius: number
  /** 背景图片文件名或完整 URL 地址 */
  bgimg?: string
  /** 自定义字体的 URL 链接 */
  fontlink?: string
  /** 基础字体大小，单位为像素 */
  fontSize: number
  /** 标题字体大小倍数 */
  titleSize: number
  /** 页头 HTML 内容 */
  header?: string
  /** 页脚 HTML 内容 */
  footer: string
  /** 主色调 */
  primary: string
  /** 副色调 */
  secondary: string
  /** 背景色 */
  bgColor: string
  /** 文本色 */
  textColor: string
  /** 自定义CSS */
  customCss?: string
  /** 毛玻璃模糊强度，0表示关闭 */
  glassBlur: number
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    source: Schema.union([
      Schema.const('file').description('本地配置'),
      Schema.const('inline').description('内存读取'),
    ]).description('指令数据源').default('inline'),
    enableCache: Schema.boolean().description('启用图片缓存').default(true),
  }).description('数据源配置'),
  Schema.object({
    padding: Schema.number().description('边距(px)').min(0).default(16),
    radius: Schema.number().description('圆角(px)').min(0).default(12),
    glassBlur: Schema.number().description('毛玻璃强度(px)').min(0).default(0),
    fontSize: Schema.number().description('字体(px)').min(1).default(24),
    titleSize: Schema.number().description('标题倍数').min(1).default(2)
  }).description('样式配置'),
  Schema.object({
    fontlink: Schema.string().description('字体链接'),
    bgimg: Schema.string().description('背景图片'),
    header: Schema.string().role('textarea').description('页头HTML'),
    footer: Schema.string().role('textarea').description('页脚HTML'),
    customCss: Schema.string().role('textarea').description('自定义CSS'),
  }).description('页面配置'),
  Schema.object({
    primary: Schema.string().description('主色调').role('color').default('#8b5cf6'),
    secondary: Schema.string().description('副色调').role('color').default('#38bdf8'),
    bgColor: Schema.string().description('背景色').role('color').default('#fefefe'),
    textColor: Schema.string().description('文本色').role('color').default('#64748b'),
  }).description('颜色配置')
])

/**
 * 插件主函数
 * @param ctx Koishi 应用上下文对象
 * @param config 插件配置对象
 */
export function apply(ctx: Context, config: Config) {
  const files = new FileStore(ctx.baseDir)
  const render = new Render()
  const extract = new Extract(ctx)

  // 扩展指令配置架构
  ctx.schema.extend('command', Schema.object({
    hidden: Schema.computed(Schema.boolean()).description('在菜单中隐藏指令').default(false),
    group: Schema.computed(Schema.string()).description('指令分组名称').default('其它'),
  }), 900)
  ctx.schema.extend('command-option', Schema.object({
    hidden: Schema.computed(Schema.boolean()).description('在菜单中隐藏选项').default(false),
  }), 900)

  /**
   * 渲染 HTML 内容为 PNG 图像
   * @param html 要渲染的完整 HTML 字符串
   * @returns 渲染后的 PNG 图像二进制数据
   */
  const toImage = async (html: string): Promise<Buffer> => {
    const page = await ctx.puppeteer.page()
    try {
      await page.setContent(html)
      const element = await page.$('.container')
      return await element.screenshot({ type: 'png', omitBackground: true })
    } finally {
      await page.close()
    }
  }

  // 指令执行前检查并处理无 action 指令
  ctx.before('command/execute', (argv) => {
    const { command, session } = argv
    if (command['_actions'].length || !session.app.$commander.get('menu')) return
    return session.execute({ name: 'menu', args: [command.name] })
  })

  // 注册指令
  ctx.command('menu [cmd:string]', '显示指令菜单')
    .userFields(['authority'])
    .option('hidden', '-H  显示所有指令和选项')
    .option('clear', '-c  清理缓存并重新生成')
    .action(async ({ session, options }, cmd) => {
      try {
        if (options.clear) await files.clearCache(cmd)
        const locale = extract.locale(session)
        const commands = await getCommands(cmd, session, locale, options.hidden)
        if (!commands?.length) return `找不到指令 ${cmd}`
        const renderConfig = { ...config, fontUrl: config.fontlink ? files.resolve(config.fontlink) : undefined, bgImage: config.bgimg ? files.resolve(config.bgimg) : undefined }
        const cacheKey = files.generateCacheKey(commands, renderConfig, cmd)
        // 尝试使用缓存
        if (config.enableCache && !options.clear) {
          const cached = await files.getCache(cacheKey)
          if (cached) return h.image(cached, 'image/png')
        }
        const html = render.build(renderConfig, commands, cmd)
        const buffer = await toImage(html)
        if (config.enableCache) await files.saveCache(cacheKey, buffer)
        return h.image(buffer, 'image/png')
      } catch (error) {
        logger.error('渲染失败:', error)
        return '渲染菜单失败'
      }
    })

  /**
   * 获取指令数据
   * @param cmdName 指令名称
   * @param session 会话对象
   * @param locale 语言代码
   * @param showHidden 是否显示隐藏项
   * @returns 指令列表
   */
  async function getCommands(cmdName: string, session: any, locale: string, showHidden = false) {
    if (config.source === 'inline') {
      const commands = cmdName
        ? await extract.related(session, cmdName, locale)
        : await extract.all(session, locale)
      return extract.filter(commands, session, showHidden || !!cmdName)
    }
    let allCommands = await files.load<any[]>('commands', locale)
    if (!allCommands) {
      allCommands = await extract.all(session, locale)
      await files.save('commands', allCommands, locale)
    }
    if (!cmdName) return extract.filter(allCommands, session, showHidden)
    let found = allCommands.find(c => c.name === cmdName) ||
                allCommands.flatMap(c => c.subs || []).find(s => s.name === cmdName)
    if (!found) {
      found = await extract.single(session, cmdName, locale)
      if (found) {
        allCommands.push(found)
        await files.save('commands', allCommands, locale)
      }
    }
    return found ? extract.filter([found], session, showHidden || true) : []
  }
}
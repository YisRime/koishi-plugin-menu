import { Context, Schema, Logger, h, Computed } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import { Extract, createLayout } from './extract'
import { FileStore, DataStore } from './utils'
import { Render } from './render'

declare module 'koishi' {
  namespace Command {
    interface Config {
      hidden?: Computed<boolean>
    }
  }
  namespace Argv {
    interface OptionConfig {
      hidden?: Computed<boolean>
    }
  }
}

export const name = 'menu'
export const inject = ['puppeteer']
export const logger = new Logger('menu')

/**
 * 插件配置接口
 */
export interface Config {
  /** 命令数据源类型 - file: 本地文件缓存, inline: 内存实时读取 */
  cmdSrc: 'file' | 'inline'
  /** 布局数据源类型 - file: 本地文件缓存, inline: 内存实时生成 */
  layoutSrc: 'file' | 'inline'
  /** 内边距大小，单位为像素，范围 8-32px */
  padding: number
  /** 圆角大小，单位为像素，范围 0-24px */
  radius: number
  /** 背景图片文件名或完整 URL 地址 */
  background?: string
  /** 自定义字体的 URL 链接 */
  fontUrl?: string
  /** 基础字体大小，单位为像素，范围 10-20px */
  fontSize: number
  /** 标题字体大小倍数，相对于基础字体大小，范围 1-3 */
  titleSize: number
  /** 页头 HTML 内容，支持自定义样式 */
  header?: string
  /** 页脚 HTML 内容，支持自定义样式 */
  footer: string
  /** 主色调，用于按钮、链接等主要元素 */
  primary: string
  /** 副色调，用于次要元素和装饰 */
  secondary: string
  /** 背景色，整个页面的背景颜色 */
  bgColor: string
  /** 文本色，主要文本内容的颜色 */
  textColor: string
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    cmdSrc: Schema.union([
      Schema.const('file').description('本地配置'),
      Schema.const('inline').description('内存读取'),
    ]).default('file').description('命令数据源'),
    layoutSrc: Schema.union([
      Schema.const('file').description('本地配置'),
      Schema.const('inline').description('内存读取'),
    ]).default('file').description('布局数据源'),
  }).description('数据源配置'),
  Schema.object({
    padding: Schema.number().description('边距(px)').min(8).max(32).default(16),
    radius: Schema.number().description('圆角(px)').min(0).max(24).default(12),
  }).description('布局配置'),
  Schema.object({
    background: Schema.string().description('背景图片(文件名或URL)'),
    fontUrl: Schema.string().description('字体链接(URL)'),
    fontSize: Schema.number().description('字体大小(px)').min(10).max(20).default(14),
    titleSize: Schema.number().description('标题字体倍数').min(1).max(3).step(0.1).default(1.4),
  }).description('界面配置'),
  Schema.object({
    header: Schema.string().role('textarea').description('页头 HTML 内容'),
    footer: Schema.string().role('textarea').description('页脚 HTML 内容'),
  }).description('页面内容'),
  Schema.object({
    primary: Schema.string().description('主色调').role('color').default('#8b5cf6'),
    secondary: Schema.string().description('副色调').role('color').default('#38bdf8'),
    bgColor: Schema.string().description('背景色').role('color').default('#fefefe'),
    textColor: Schema.string().description('文本色').role('color').default('#64748b'),
  }).description('颜色配置')
])

/**
 * 插件主函数
 * @param ctx - Koishi 应用上下文对象，提供框架核心功能
 * @param config - 插件配置对象，包含用户自定义的所有配置项
 */
export function apply(ctx: Context, config: Config) {
  const files = new FileStore(ctx.baseDir)
  const render = new Render()
  const extract = new Extract(ctx)
  const data = new DataStore(files, extract)

  // 扩展命令配置架构
  ctx.schema.extend('command', Schema.object({
    hidden: Schema.computed(Schema.boolean()).description('在帮助中隐藏指令').default(false),
  }), 900)
  ctx.schema.extend('command-option', Schema.object({
    hidden: Schema.computed(Schema.boolean()).description('在帮助中隐藏选项').default(false),
  }), 900)

  /**
   * 渲染 HTML 内容为 PNG 图像
   * @param html - 要渲染的完整 HTML 字符串
   * @returns Promise<Buffer> 渲染后的 PNG 图像二进制数据
   * @throws {Error} 当页面渲染或截图失败时抛出错误
   */
  const toImage = async (html: string): Promise<Buffer> => {
    const page = await ctx.puppeteer.page()
    await page.setContent(html)
    const element = await page.$('.container')
    return await element.screenshot({ type: 'png', omitBackground: true })
  }

  // 命令执行前检查并处理无 action 命令
  ctx.before('command/execute', (argv) => {
    const { command, session } = argv
    if (command['_actions'].length || !session.app.$commander.get('menu')) return
    return session.execute({ name: 'menu', args: [command.name] })
  })

  // 注册命令
  ctx.command('menu [cmd:string]', '显示指令帮助')
    .userFields(['authority'])
    .action(async ({ session }, cmd) => {
      try {
        const locale = extract.getLocale(session)
        // 获取命令数据
        let commands = config.cmdSrc === 'inline'
          ? (cmd ? await extract.getRelated(session, cmd, locale) : await extract.getAll(session, locale))
          : await data.getCommands(cmd, session, locale)
        // 应用过滤
        if (config.cmdSrc === 'inline') {
          commands = await extract.filterCommands(commands, session)
          commands = commands.map(command => extract.filterCommandOptions(command, session))
        }
        // 获取布局并渲染
        const layout = config.layoutSrc === 'inline'
          ? await createLayout(cmd, commands)
          : await data.getLayout(cmd, commands)
        if (!layout) return cmd ? `找不到命令 ${cmd}` : '无可用命令'
        const html = render.buildHtml(config, layout, commands)
        const buffer = await toImage(html)
        return h.image(buffer, 'image/png')
      } catch (error) {
        logger.error('渲染失败:', error)
        return '渲染菜单失败'
      }
    })
}
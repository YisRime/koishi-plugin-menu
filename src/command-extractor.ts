import { Context, Logger } from 'koishi'

const logger = new Logger('menu:command-extractor')

export interface CommandOption {
  name: string
  description: string
  syntax: string
}

export interface CommandData {
  name: string
  displayName: string
  description: string
  usage: string
  options: CommandOption[]
  examples: string[]
  subCommands?: CommandData[]
}

export interface CategoryData {
  name: string
  commands: CommandData[]
}

/**
 * 命令提取类，负责从Koishi中提取命令信息
 */
export class CommandExtractor {
  private ctx: Context

  constructor(ctx: Context) {
    this.ctx = ctx
    logger.info('命令提取器初始化完成')
  }

  /**
   * 创建命令渲染会话
   * @param {string} locale 语言代码
   * @returns {any} 会话对象
   */
  private createSession(locale: string): any {
    const session: any = {
      app: this.ctx.app,
      user: { authority: 4 }, // 使用高权限以查看所有命令
      text: (path, params) => this.ctx.i18n.render([locale], Array.isArray(path) ? path : [path], params),
      isDirect: true,
      locales: [locale], // 使用正确的 locales 属性
    }
    session.resolve = (val) => typeof val === 'function' ? val(session) : val
    return session
  }

  /**
   * 提取所有命令分类数据
   * @param {string} locale 语言代码
   * @returns {Promise<CategoryData[]>} 分类数据数组
   */
  public async extractCategories(locale: string): Promise<CategoryData[]> {
    const session = this.createSession(locale)
    const commander = this.ctx.$commander
    logger.info(`开始提取命令列表(语言: ${locale})，共有 ${commander._commandList.length} 个命令`)

    // 只获取顶级命令（没有父命令的命令）
    const rootCommands = commander._commandList.filter((cmd: any) => !cmd.parent)
    logger.info(`找到 ${rootCommands.length} 个顶级命令`)

    const rootCategory: CategoryData = {
      name: "命令列表",
      commands: []
    }

    // 并行处理所有命令
    const commandPromises = rootCommands.map(cmd => this.extractCommandInfo(cmd, session))
    const commandsData = await Promise.all(commandPromises)
    rootCategory.commands = commandsData.filter(Boolean)

    // 按名称排序
    rootCategory.commands.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
    logger.info(`共提取 ${rootCategory.commands.length} 个可见命令`)

    return [rootCategory]
  }

  /**
   * 提取单个命令信息
   * @param {any} command - 命令对象
   * @param {any} session - 会话对象
   * @returns {Promise<CommandData|null>} 命令数据
   */
  public async extractCommandInfo(command: any, session?: any): Promise<CommandData|null> {
    if (!command?.name) {
      logger.debug('跳过无效命令')
      return null
    }

    logger.debug(`提取命令信息: ${command.name}`)

    try {
      // 处理选项
      const options: CommandOption[] = []
      Object.values(command._options || {}).forEach((option: any) => {
        const processOption = (opt: any, name: string) => {
          if (!opt) return

          const description = session.text(opt.descPath ?? [`commands.${command.name}.options.${name}`, ""], opt.params || {})
          if (description || opt.syntax) {
            options.push({
              name,
              description: description || "",
              syntax: opt.syntax || ""
            })
          }
        }

        if (!option || typeof option !== 'object') return

        if (!('value' in option)) {
          processOption(option, option.name)
        }

        if (option.variants) {
          for (const value in option.variants) {
            processOption(option.variants[value], `${option.name}.${value}`)
          }
        }
      })

      // 获取命令描述
      const description = session.text([`commands.${command.name}.description`, ""], command.params || {})

      // 获取用法
      let usage = ""
      if (command._usage) {
        usage = typeof command._usage === "string" ? command._usage : await command._usage(session)
      } else {
        usage = session.text([`commands.${command.name}.usage`, ""], command.params || {}) || ""
      }

      // 获取示例
      const examples: string[] = []
      if (Array.isArray(command._examples) && command._examples.length) {
        examples.push(...command._examples)
      } else {
        const text = session.text([`commands.${command.name}.examples`, ""], command.params || {})
        if (text && typeof text === "string") {
          examples.push(...text.split("\n").filter(line => line.trim() !== ""))
        }
      }

      // 处理子命令
      const subCommands: CommandData[] = []
      if (Array.isArray(command.children) && command.children.length > 0) {
        // 并行处理子命令
        const subCommandPromises = command.children.map(subCmd => this.extractCommandInfo(subCmd, session))
        const subCommandsData = await Promise.all(subCommandPromises)
        subCommands.push(...subCommandsData.filter(Boolean))
      }

      // 构建命令数据对象
      return {
        name: command.name,
        displayName: command.displayName || command.name,
        description: description || "",
        usage,
        options,
        examples,
        subCommands: subCommands.length > 0 ? subCommands : undefined
      }
    } catch (error) {
      logger.error(`提取命令 ${command?.name || '未知命令'} 信息时出错:`, error)
      return null
    }
  }

  /**
   * 获取特定命令的数据
   * @param {string} commandName - 命令名称
   * @param {string} locale - 语言代码
   * @returns {Promise<CommandData|null>} 命令数据
   */
  public async getCommandData(commandName: string, locale: string): Promise<CommandData|null> {
    if (!commandName) return null

    const command = this.getCommandObject(commandName)
    if (!command) {
      logger.warn(`命令不存在: ${commandName}`)
      return null
    }

    const session = this.createSession(locale)
    return await this.extractCommandInfo(command, session)
  }

  /**
   * 获取命令对象
   * @param {string} commandName - 命令名称
   * @returns {any|null} 命令对象
   */
  public getCommandObject(commandName: string): any {
    try {
      if (!commandName) return null

      // 处理子命令格式 (如 "info.user")
      if (commandName.includes('.')) {
        const parts = commandName.split('.')
        let currentCmd = this.ctx.$commander.get(parts[0])
        if (!currentCmd) return null

        // 处理嵌套的子命令
        for (let i = 1; i < parts.length; i++) {
          const targetName = parts.slice(0, i+1).join('.')
          currentCmd = this.findChildCommand(currentCmd, targetName)
          if (!currentCmd) return null
        }
        return currentCmd
      } else {
        return this.ctx.$commander.get(commandName)
      }
    } catch (error) {
      logger.debug(`查找命令出错: ${commandName}`, error)
      return null
    }
  }

  /**
   * 查找子命令
   * @param {any} parentCommand - 父命令
   * @param {string} fullName - 完整命令名称
   * @returns {any|null} 命令对象
   */
  private findChildCommand(parentCommand: any, fullName: string): any {
    if (!parentCommand?.children) return null

    // 直接查找子命令
    for (const child of parentCommand.children) {
      if (child.name === fullName) return child
    }

    return null
  }

  /**
   * 收集所有命令名称
   * @returns {string[]} 命令名称数组
   */
  public collectAllCommands(): string[] {
    // 使用Set避免重复
    const processedCommands = new Set<string>()

    // 收集命令和子命令
    const collectAllCommandNames = (command: any) => {
      if (!command?.name) return

      processedCommands.add(command.name)

      // 处理子命令
      if (Array.isArray(command.children)) {
        command.children.forEach(child => collectAllCommandNames(child))
      }
    }

    // 处理所有顶级命令
    this.ctx.$commander._commandList.forEach(cmd => collectAllCommandNames(cmd))

    // 转换为数组并返回
    const result = Array.from(processedCommands)
    logger.info(`收集到 ${result.length} 个命令和子命令`)
    return result
  }
}

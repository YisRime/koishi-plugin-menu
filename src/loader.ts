import { Logger } from 'koishi'

const logger = new Logger('ocr:loader')

// 检查命令在当前会话是否可见
async function getCommandVisibility(command: any, session: any) {
  if (!command.match(session) || !Object.keys(command._aliases).length) {
    return false
  }
  return await session.app.permissions.test(`command:${command.name}`, session)
}

// 检查选项在当前会话是否可见
function getOptionVisibility(option: any, session: any) {
  if (session.user && option.authority > session.user.authority) {
    return false
  }
  return !session.resolve(option.hidden)
}

// 处理单个命令及其子命令
export async function extractCommandInfo(command: any, session: any) {
  logger.info(`处理命令: ${command.name}`)

  try {
    if (!await getCommandVisibility(command, session)) {
      logger.info(`命令 ${command.name} 不可见，跳过`)
      return null
    }

    // 处理选项
    const options = []
    Object.values(command._options).forEach((option: any) => {
      if (!getOptionVisibility(option, session)) return

      function addOption(opt: any, name: string) {
        let description: string
        try {
          const descResult = session.text(
            opt.descPath ?? [`commands.${command.name}.options.${name}`, ''],
            opt.params || {}
          )
          // 确保描述是字符串
          description = typeof descResult === 'string' ? descResult :
                        descResult ? String(descResult) : ''
        } catch (e) {
          logger.warn(`获取选项 ${name} 描述失败:`, e)
          description = ''
        }

        // 确保语法是字符串
        const syntax = opt.syntax ? String(opt.syntax) : ''

        if (description || syntax) {
          options.push({
            name,
            description,
            syntax
          })
        }
      }

      if (!('value' in option)) {
        addOption(option, option.name)
      }

      for (const value in option.variants) {
        addOption(option.variants[value], `${option.name}.${value}`)
      }
    })

    // 获取命令描述
    let description: string
    try {
      const descResult = session.text(
        [`commands.${command.name}.description`, ''],
        command.params || {}
      )
      description = typeof descResult === 'string' ? descResult :
                   descResult ? String(descResult) : ''
    } catch (e) {
      logger.warn(`获取命令 ${command.name} 描述失败:`, e)
      description = ''
    }

    // 获取用法
    let usage = ''
    try {
      if (command._usage) {
        const usageResult = typeof command._usage === 'string'
          ? command._usage
          : await command._usage(session)
        usage = typeof usageResult === 'string' ? usageResult :
               usageResult ? String(usageResult) : ''
      } else {
        const usageResult = session.text(
          [`commands.${command.name}.usage`, ''],
          command.params || {}
        )
        usage = typeof usageResult === 'string' ? usageResult :
               usageResult ? String(usageResult) : ''
      }
    } catch (e) {
      logger.warn(`获取命令 ${command.name} 用法失败:`, e)
      usage = ''
    }

    // 获取示例
    const examples = []
    try {
      if (command._examples.length) {
        for (const example of command._examples) {
          examples.push(typeof example === 'string' ? example : String(example || ''))
        }
      } else {
        const text = session.text(
          [`commands.${command.name}.examples`, ''],
          command.params || {}
        )
        if (text) {
          if (typeof text === 'string') {
            examples.push(...text.split('\n'))
          } else {
            examples.push(String(text))
          }
        }
      }
    } catch (e) {
      logger.warn(`获取命令 ${command.name} 示例失败:`, e)
    }

    // 处理子命令
    const subCommands = []
    for (const subCmd of command.children) {
      const subCommandItem = await extractCommandInfo(subCmd, session)
      if (subCommandItem) {
        subCommands.push(subCommandItem)
      }
    }

    logger.info(`命令 ${command.name} 处理完成，添加到列表`)

    return {
      name: command.name,
      displayName: command.displayName,
      description: description || '',
      usage,
      options,
      examples,
      subCommands: subCommands.length > 0 ? subCommands : undefined
    }
  } catch (error) {
    logger.error(`处理命令 ${command.name} 时出错:`, error)
    return null
  }
}

// 加载所有命令信息
export async function loadCommands(ctx: any, session: any) {
  const categories = []
  const commander = ctx.$commander

  logger.info(`开始加载命令列表，共有 ${commander._commandList.length} 个命令`)

  // 获取顶级命令
  const rootCommands = commander._commandList.filter(
    (cmd: any) => cmd.parent === null
  )

  logger.info(`找到 ${rootCommands.length} 个顶级命令`)

  const rootCategory = {
    name: '命令列表',
    commands: []
  }

  // 处理每个顶级命令
  for (const command of rootCommands) {
    const commandItem = await extractCommandInfo(command, session)
    if (commandItem) {
      rootCategory.commands.push(commandItem)
    }
  }

  logger.info(`共处理 ${rootCategory.commands.length} 个可见命令`)

  // 排序命令
  rootCategory.commands.sort(
    (a, b) => a.displayName > b.displayName ? 1 : -1
  )

  categories.push(rootCategory)
  return categories
}

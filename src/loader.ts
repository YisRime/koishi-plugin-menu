import { Logger } from 'koishi'

const logger = new Logger('menu:loader')

/**
 * 提取单个命令及其子命令的信息
 * @param {Object} command - 命令对象
 * @param {Object} session - 渲染会话对象
 * @returns {Promise<Object|null>} - 提取的命令信息
 */
export async function extractCommandInfo(command: any, session: any) {
  logger.info(`处理命令: ${command.name}`)
  try {


    // 处理选项
    const options = []
    Object.values(command._options).forEach((option: any) => {

      function addOption(opt: any, name: string) {
        const description = session.text(opt.descPath ?? [`commands.${command.name}.options.${name}`, ""], opt.params || {});
        if (description || opt.syntax) {
          options.push({
            name,
            description: description || "",
            syntax: opt.syntax
          });
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
    const description = session.text([`commands.${command.name}.description`, ""], command.params || {});

    // 获取用法
    let usage = ""
    if (command._usage) {
      usage = typeof command._usage === "string" ? command._usage : await command._usage(session);
    } else {
      usage = session.text([`commands.${command.name}.usage`, ""], command.params || {}) || "";
    }

    // 获取示例
    const examples = []
    if (command._examples.length) {
      examples.push(...command._examples);
    } else {
      const text = session.text([`commands.${command.name}.examples`, ""], command.params || {});
      if (text && typeof text === "string") {
        examples.push(...text.split("\n"));
      }
    }

    // 处理子命令
    const subCommands = []
    for (const subCmd of command.children) {
      const subCommandItem = await extractCommandInfo(subCmd, session);
      if (subCommandItem) {
        subCommands.push(subCommandItem);
      }
    }

    logger.info(`命令 ${command.name} 处理完成，添加到列表`);
    return {
      name: command.name,
      displayName: command.displayName,
      description: description || "",
      usage,
      options,
      examples,
      subCommands: subCommands.length > 0 ? subCommands : undefined
    }
  } catch (error) {
    logger.error(`处理命令 ${command?.name || '未知命令'} 时出错:`, error)
    return null
  }
}

/**
 * 加载所有命令信息
 * @param {Object} ctx - Koishi上下文
 * @param {Object} session - 渲染会话对象
 * @returns {Promise<Array>} - 分类数组
 */
export async function loadCommands(ctx: any, session: any) {
  const categories = [];
  const commander = ctx.$commander;
  logger.info(`开始加载命令列表，共有 ${commander._commandList.length} 个命令`);
  const rootCommands = commander._commandList.filter((cmd: any) => cmd.parent === null);
  logger.info(`找到 ${rootCommands.length} 个顶级命令`);

  const rootCategory = {
    name: "命令列表",
    commands: []
  };

  for (const command of rootCommands) {
    const commandItem = await extractCommandInfo(command, session);
    if (commandItem) {
      rootCategory.commands.push(commandItem);
    }
  }

  logger.info(`共处理 ${rootCategory.commands.length} 个可见命令`);
  rootCategory.commands.sort((a, b) => a.displayName > b.displayName ? 1 : -1);
  categories.push(rootCategory);

  return categories;
}

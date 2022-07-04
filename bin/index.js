const program = require("commander");
const fs = require("fs");
var path = require('path')
var statsvn = require('./lib')
var chalk = require('chalk')

function commaSeparatedList(value, split = ",") {
  return value.split(split).filter(item => item);
}

program
  .version(require('../package.json').version)
  .option("--cwd <path>", "工作目录")
  .option(
    "--svn-project-paths <items>",
    "多项目svn的完整路径，用逗号隔开",
    commaSeparatedList
  )
  .option(
    "--sub-svn-paths <items>",
    "单项目多SVN路径，使用相对路径，用逗号隔开",
    commaSeparatedList
  )
  .option(
    "--ingore-paths <items>",
    "忽略的路径，满足minimatch规范，用逗号隔开",
    commaSeparatedList
  )
  .option("--out-dir <path>", "输出目录")
  .option(
    "--config <path>",
    "配置文件的路径，没有配置，默认路径是在${cwd}/vve-i18n-cli.config.js"
  )
  .option("--no-config", "是否取配置文件")
  .parse(process.argv);

program.cwd = 'G:\\SvnWorkspaces\\20220629-inc-inc-emb-trunk-yr'

const config = {
  // 工作目录
  cwd: ".",
  // 配置文件的路径，没有配置，默认路径是在${cwd}/vve-i18n-cli.config.js
  config: undefined,
  // 是否取配置文件
  noConfig: false,
  outDir: 'outdir',
  // svn项目，如果传数组，则优先级比cwd和subSvnPaths更高，则不统计当前svn目录${cwd}/${rootDir}
  svnProjectPaths: [],
  // 仅统计项目下subSvnPaths指定的svn目录
  subSvnPaths: [],
  // 忽略的路径
  ingorePaths: [
    'eweb/**',
    '**/dist/**',
    '**/node_module/**'
  ],
  // svn log -r 参数（优先于svnStartDayTime和svnEndDayTime使用）
  svnRevisionARG: '',
  // svn log -r {}:{} 开始时间
  svnStartDayTime: undefined, // moment().format("YYYY-MM-DD 00:00:00"), // 默认当天开始时间
  // svn log -r {}:{} 结束时间
  svnEndDayTime: undefined // moment().format("YYYY-MM-DD 23:59:59"), // 默认当天结束时间
}

Object.assign(config, program);

const CONFIG_JS_FILENAME = "vve-statesvn-cli.config.js";

let absoluteCwd = path.resolve(config.cwd);

// 优先判断是否需要读取文件
if (!config.noConfig) {
  let configFilePath = path.join(absoluteCwd, CONFIG_JS_FILENAME);
  if (config.config) {
    configFilePath = path.resolve(config.config);
  }
  if (fs.existsSync(configFilePath)) {
    const conf = loadConfig(configFilePath);
    if (conf) {
      Object.assign(config, conf.options, program);
    }
  }
}

function log (...arg) {
  console.log(...arg)
}

function printLogSingleProject (ret, { projectInfo = false } = {}) {
  const config = ret.config

  log(chalk.green("---start-----------------------"))

  if (projectInfo) {
    if (config.alias) {
      log(`路径：${chalk.blue(config.alias + "（" + config.cwd + "）")}`)
    } else {
      log(`路径：${chalk.blue(config.cwd)}`)
    }
  }
  log(`新增代码总行数: ${chalk.blue('%d')}`, ret.total);
  log(chalk.green("---end-----------------------"))
}

function printLog (ret) {
  if (Array.isArray(ret.arr)) {
    for (let i = 0; i < ret.arr.length; i++) {
      printLogSingleProject(ret.arr[i], { projectInfo: true })
    }
  } else {
    printLogSingleProject(ret, { projectInfo: true })
  }
}

async function run () {
  const ret = await statsvn.run(config)
  printLog(ret)
}

run ()

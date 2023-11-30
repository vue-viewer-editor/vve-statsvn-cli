#!/usr/bin/env node

"use strict";
const program = require("commander");
var fs = require('fs-extra');
var path = require('path')
const { loadConfig } = require("./configuration");
var statsvn = require('./lib')
var chalk = require('chalk')
var format = require('format')
const ObjectsToCsv = require('objects-to-csv');

function commaSeparatedList(value, split = ",") {
  return value.split(split).filter(item => item);
}

program
  .version(require('../package.json').version)
  .option("--cwd <path>", "工作目录")
  .option(
    "--svn-url <path>",
    "如果配置，则svn log 和 svn diff 则取的svn路径是以此路径为准"
  )
  .option(
    "--svn-username <name>",
    "svn用户名，为空表示如果不需要认证或者使用系统认证缓存信息"
  )
  .option(
    "--svn-password <password>",
    "svn密码，为空表示如果不需要认证或者使用系统认证缓存信息"
  )
  .option(
    "--no-auth-cache",
    "是否缓存认证信息，如果为true，当前机器将不缓存当前用户信息"
  )
  .option(
    "--sub-path <path>",
    "在配置svnUrl生效，配置subPath，则在cwd目录创建subPath目录，在此目录下，存放statsvnTmp等缓存文件"
  )
  .option(
    "--auto-sub-path",
    "在配置svnUrl生效，是否根据svnUrl自动在cwd目录下创建目录，创建目录名根据url生成，存放statsvnTmp等文件，如果为true，则subPath失效"
  )
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
  .option(
    "--author <name>",
    "作者"
  )
  .option(
    "--svn-revision-arg <name>",
    "svn log -r 参数（优先于svnStartDayTime和svnEndDayTime使用）"
  )
  .option(
    "--svn-start-day-time <name>",
    "svn log -r {}:{} 开始时间"
  )
  .option(
    "--svn-end-day-time <name>",
    "svn log -r {}:{} 结束时间"
  )
  .option(
    "--max-line-threshold <number>",
    "最大行数阈值，如果一个文件超过最大行数，则不处理他的新增行数信息 0代表不限制"
  )
  .option(
    "--del-tmp-after-run-single",
    "统计完一个svn项目的删除临时目录"
  )
  .option("--debug", "是否开启debug")
  .option("--out-dir <path>", "输出目录")
  .option("--out-csv", "是否输出csv")
  .option(
    "--config <path>",
    "配置文件的路径，没有配置，默认路径是在${cwd}/vve-statsvn-cli.config.js"
  )
  .option("--no-config", "是否取配置文件")
  .parse(process.argv);

const config = {
  // 工作目录
  cwd: ".",
  // 配置文件的路径，没有配置，默认路径是在${cwd}/vve-statsvn-cli.config.js
  config: undefined,
  // 是否取配置文件
  noConfig: false,
  // 输出的目录
  outDir: '',
  // 是否输出csv文件
  outCsv: false,
  // 是否开启debug
  debug: false,
  // 如果配置，则svn log 和 svn diff 则取的svn路径是以此路径为准
  svnUrl: '',
  // svn用户名，为空表示如果不需要认证或者使用系统认证缓存信息
  svnUsername: '',
   // svn密码，为空表示如果不需要认证或者使用系统认证缓存信息
  svnPassword: '',
  // 是否缓存认证信息，如果为true，当前机器将不缓存当前用户信息
  noAuthCache: false,
  // 在配置svnUrl生效，配置subPath，则在cwd目录创建subPath目录，在此目录下，存放statsvnTmp等缓存文件
  subPath: '',
  // 在配置svnUrl生效，是否根据svnUrl自动在cwd目录下创建目录，创建目录名根据url生成，存放statsvnTmp等文件，如果为true，则subPath失效
  autoSubPath: false, 
  // svn项目，如果传数组，则优先级比cwd和subSvnPaths更高，则不统计当前svn目录${cwd}/${rootDir}
  svnProjectPaths: [],
  // 仅统计项目下subSvnPaths指定的svn目录
  subSvnPaths: [],
  // 忽略的路径
  ingorePaths: [
    'npm-shrinkwrap.json',
    '**/dist/**',
    'dist/**',
    '**/node_module/**',
    'node_module/**',
    '*.gz',
    '**/*.gz',
    '**/*.jpg', '**/*.jpeg', '**/*.png', '**/*.svg', '**/*.eot', '**/*.ttf', '**/*.woff', '**/*.woff2', '**/*.gif',
    '*.jpg', '*.jpeg', '*.png', '*.svg', '*.eot', '*.ttf', '*.woff', '*.woff2', '*.gif',
  ],
  // author 作者
  author: '',
  // svn log -r 参数（优先于svnStartDayTime和svnEndDayTime使用）
  svnRevisionARG: '',
  // svn log -r {}:{} 开始时间
  svnStartDayTime: undefined, // moment().format("YYYY-MM-DD 00:00:00"), // 默认当天开始时间
  // svn log -r {}:{} 结束时间
  svnEndDayTime: undefined, // moment().format("YYYY-MM-DD 23:59:59"), // 默认当天结束时间
  // 最大行数阈值，如果一个文件超过最大行数，则不处理他的新增行数信息 0代表不限制
  maxLineThreshold: 0,
  // 统计完一个svn项目的删除临时目录
  delTmpAfterRunSingle: false,
}

Object.assign(config, program);

config.maxLineThreshold = Number(config.maxLineThreshold) // 转成数字

const CONFIG_JS_FILENAME = "vve-statsvn-cli.config.js";

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

// 输出日志的内容
let logStr = ''
var logArr = []
function log (...arg) {
  const reg = new RegExp(String.fromCharCode(27) + '\\[\\d\+m', 'g')
  logStr += format(...arg).replace(reg, "") + '\n'
  console.log(...arg)
}

function printLogSingleProject (ret, { projectInfo = false } = {}) {
  const config = ret.config
  const workspacePath = ret.workspacePath

  var logInfo = {}

  log(chalk.green("---start------------------------"))

  if (projectInfo) {
    if (config.alias) {
      log(`本地路径：${chalk.blue(config.alias + "（" + workspacePath + "）")}`)
      logInfo.path = config.alias + "（" + workspacePath + "）"
    } else {
      log(`本地路径：${chalk.blue(workspacePath)}`)
      logInfo.path = workspacePath
    }
  }
  log(`SVN路径：${chalk.blue(ret.svnInfo.url || '')}`)
  logInfo.svnUrl = ret.svnInfo.url
 
  log(`新增代码总行数: ${chalk.blue('%d')}`, ret.total);
  logInfo.newCodeTotalLines = ret.total

  log(chalk.green("---end------------------------"))

  logArr.push(logInfo)
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

  const checkRet = await statsvn.svnCheck()
  console.log(checkRet.message)
  if (!checkRet.success) {
    return
  }

  const ret = await statsvn.run(config)
  printLog(ret)

  let outPath = path.resolve(config.cwd)
  if(config.outDir) {
    outPath = path.resolve(outPath, config.outDir)
  }

  if (!fs.existsSync(outPath)) {
    fs.mkdirsSync(outPath)
  }

  if (config.outDir) {
    fs.writeFileSync(path.resolve(outPath, "statsvn-output.txt"), logStr)

    if (config.outCsv) {
      const csv = new ObjectsToCsv(logArr);
      await csv.toDisk(path.resolve(outPath, "statsvn-output.csv"), { bom: true }); // bom为true 解决中文乱码问题
    }

    if (config.debug) {
      fs.writeFileSync(path.resolve(outPath, "./statsvn-debug-return-log.json"), JSON.stringify(ret, null, 2))
    }
  }
}

run ()

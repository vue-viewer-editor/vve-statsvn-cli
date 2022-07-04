#!/usr/bin/env node

"use strict";
const program = require("commander");
const fs = require("fs");
var path = require('path')
const { loadConfig } = require("./configuration");
var statsvn = require('./lib')
var chalk = require('chalk')
var format = require('format')

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
  // 是否开启debug
  debug: false,
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
    '**/*.jpg', '**/*.jpeg', '**/*.png', '**/*.svg', '**/*.eot', '**/*.ttf', '**/*.woff', '**/*.woff2', '**/*.gif',
    '*.jpg', '*.jpeg', '*.png', '*.svg', '*.eot', '*.ttf', '*.woff', '*.woff2', '*.gif',
  ],
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

function log (...arg) {
  logStr += format(...arg).replace(/\[\d+m/g, "") + '\n'
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

  if (config.outDir) {
    fs.writeFileSync(path.resolve(config.outDir, "statsvn-output.txt"), logStr)
  }

  if (config.debug) {
    fs.writeFileSync(path.resolve(config.cwd, "./statsvn-debug-return-log.json"), JSON.stringify(ret, null, 2))
  }
}

run ()

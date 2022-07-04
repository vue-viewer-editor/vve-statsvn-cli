const program = require("commander");
const fs = require("fs");
var path = require('path')
var statsvn = require('./lib')

function commaSeparatedList(value, split = ",") {
  return value.split(split).filter(item => item);
}

program
  .version(require('../package.json').version)
  .option("--cwd <path>", "工作目录")
  .option("--root-dir <path>", "国际文本所在的根目录")
  .option(
    "--module-index-rules <items>",
    "模块入口列表",
    commaSeparatedList
  )
  .option("--out-dir <path>", "生成的国际化资源包的输出目录")
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
  // 根目录，svn所在的根目录
  rootDir: ".",
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
  ]
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

// 制定配置文件后，cwd在配置文件中定义，则cwd就需要重新获取
if (!program.cwd) {
  absoluteCwd = path.resolve(config.cwd);
}

const absoluteRootDir = path.resolve(absoluteCwd, config.rootDir);

async function run () {
  const ret = await statsvn.run(config)
  console.log(ret.total)
  console.log(ret.paths.map(item => item.path + ' ' + item.lineTotal).join('\n'))
}

run ()

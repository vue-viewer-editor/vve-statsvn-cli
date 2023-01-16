# vve-statsvn-cli

[![npm](https://img.shields.io/npm/v/vve-statsvn)](https://www.npmjs.com/package/vve-statsvn)
[![NPM downloads](http://img.shields.io/npm/dm/vve-statsvn.svg?style=flat-square)](http://www.npmtrends.com/vve-statsvn)

统计svn项目新增代码行数

## 特性
- 支持集成进由npm管理的项目
- 支持根据时间范围统计
- 支持指定代码提交者
- 支持多个svn项目统计
- 支持单项目多个SVN路径统计

## 安装

先确保系统已安装svn，可以在终端上输入以下命令确认是否安装成功
```
svn help
```

使用npm安装：

```
$ npm install vve-statsvn-cli
```

## 使用

在package.json添加

```json
"scripts": {
  "statsvn": "vve-statsvn-cli"
}
```

然后 `npm run statsvn`

## 参数

### 命令行指定参数

```javascript

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

```

### 配置文件指定参数

默认配置文件在${cwd}/vve-statsvn-cli.config.js，样例内容如下所示

```javascript
module.exports = {
  outDir: '.'
}
```

### 默认值

```javascript
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
```


### 开发

- node >= 10

```
npm i // 安装依赖
npm test // 测试
npm run release // 发布
git push --follow-tags origin master && npm publish // npm 发布
```

## 捐赠

如果你觉得它有用，你可以给我买一杯奶茶。

<img width="650" src="https://raw.githubusercontent.com/vue-viewer-editor/vve-statsvn-cli/master/qrcode-donation.png" alt="donation">

## 关于生成的缓存文件

执行`npm run statsvn` 后，会在项目目录下生成一些缓存文件，请将以下内容添加至svn忽略文件中。如果svn和git混用，可将以下内容一并加入`.gitignore`文件中。

```
statsvn-debug-return-log.json
statsvn-output.txt
statsvn-output.csv
statsvnTmp/
```

### 统计原理介绍

纯新增代码，如：
```
+void foo() {
+    ... ...
+}
```

纯删除代码，如：
```
-void foo() {
-    ... ...
-}
```

修改的代码，如：
```
-void foo(void);
+void foo(int);
```

我们所要统计的所谓有效代码更多是指纯新增的代码和修改的代码，纯删除的代码可忽略不计。这样一来实际有效代码行数 = 纯新增代码行数 + 修改代码行数；而修改的代码在`svn diff`结果中体现为一减一加，实际修改行数是等于其+的行数的。也就是说有效代码行数就是`svn diff`结果中所有前缀为+的行的行数。再配合`svn log`查询出历史提交的每一次的版本的文件，叠加每个版本每个文件经过`svn diff`计算出的有效代码行数即为最终的新增代码函数。

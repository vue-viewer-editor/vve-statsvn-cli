// 核心
// https://www.iteye.com/blog/ully-1270957
// svn log -r {2023-01-01}:{2023-12-31} --xml -v > %home%\\svnlog2023\\svn.log

var Client = require('svn-spawn')
var convert = require('xml-js');
var fs = require('fs-extra');
var Util = require('./utils')
var minimatch = require("minimatch")
var path = require('path')
var moment = require('moment');
var md5 = require('md5');
var chalk = require('chalk')

var fsExistsSync = Util.fsExistsSync
var generateFolderPathFromUrl = Util.generateFolderPathFromUrl
var joinUrlPath = Util.joinUrlPath

/**
 * 检测是否正确安装svn
 */
async function svnCheck () {
  const client = new Client()

  const ret = { success: true, message: '', version: '' }

  return new Promise((resolve) => {
    client.session('silent', true).cmd(['--version', '--quiet'], function (err, data) {
      if (err) {
        ret.success = false
        ret.message = '您还没有安装SVN. 您可以在终端上执行`svn help`确认是否安装成功.'
      } else {
        ret.version = data.trim()
        ret.message = 'SVN版本: ' + data.trim()
      }
      resolve(ret)
    })
  })
}

/**
 * 单个svn项目
 * @param {*} options = {
 *    ingorePaths: [],
 *    svnRevisionARG: '{2022-05-20 00:00:00}:{2022-05-20 23:59:59}', // 具体通过看svn log -h查看-r的参数格式
 *    svnStartDayTime: '', 2022-05-20 00:00:00 // 只有在svnRevisionARG为空的情况下使用
 *    svnEndDayTime: '', // 2022-05-20 23:59:59 // 只有在svnRevisionARG为空的情况下使用
 * }
 * @returns 
 */
async function runSingle (options) {

  const config = Object.assign({
    ingorePaths: [],
    author: '',
    svnRevisionARG: '',
    svnStartDayTime: moment().format("YYYY-MM-DD 00:00:00"), // 默认当天
    svnEndDayTime: moment().format("YYYY-MM-DD 23:59:59"),
    maxLineThreshold: 0, // 最大行数阈值，如果一个文件超过最大行数，则不处理他的新增行数信息 0代表不限制
    delTmpAfterRunSingle: false, // 执行完单个删除临时文件
    svnUrl: '', // 如果配置，则svn log 和 svn diff 则取的svn路径是以此路径为准
    subPath: '', // 在配置svnUrl生效，配置subPath，则在cwd目录创建subPath下，存放statsvnTmp等缓存文件
    autoSubPath: false, // 在配置svnUrl生效，是否根据svnUrl自动在cwd目录下创建目录，存放statsvnTmp等文件，如果为true，则subPath失效
    svnUsername: '', // svn用户名，为空表示如果不需要认证或者使用系统认证缓存信息
    svnPassword: '', // svn密码，为空表示如果不需要认证或者使用系统认证缓存信息
    noAuthCache: false, // 是否缓存认证信息，如果为true，当前机器将不缓存当前用户信息
  }, options)

  if (!config.svnRevisionARG) {
    config.svnRevisionARG = `{${config.svnStartDayTime}}:{${config.svnEndDayTime}}`
  }

  var client = new Client({
    cwd: path.resolve(config.cwd), // 项目路径
    username: config.svnUsername || undefined,  // optional if authentication not required or is already saved
    password: config.svnPassword || undefined,  // optional if authentication not required or is already saved
    noAuthCache: config.noAuCache, // optional, if true, username does not become the logged in user on the machine
  });

  var ret = {
    config,
    total: 0,
    paths: [], // { path: '', lineTotal: 0 }
    failPaths: [], // { path: '' }
    ingorePaths: [], // { path: '', err: '' }
    overMaxLineThresholdPaths: [], // { path: '' }
    svnInfo: {}, // { url: '' }
    workspacePath: '',
  }
  
  let tmpDir = path.resolve(config.cwd)

  // 在配置svnUrl生效，配置subPath，则在cwd目录创建subPath下，存放statsvnTmp等缓存文件
  // 如果autoSubPath未true，则subPath失效
  if (config.svnUrl) {
    if (config.autoSubPath) {
      tmpDir = path.resolve(config.cwd, generateFolderPathFromUrl(config.svnUrl))
    } else if (config.subPath) {
      tmpDir = path.resolve(config.cwd, config.subPath)
    }
  }

  // 设置工作输出目录
  ret.workspacePath = tmpDir

  // 创建缓存目录
  const statsvnTmpDir = path.resolve(tmpDir, 'statsvnTmp')

  if (!fsExistsSync(statsvnTmpDir)) {
    fs.mkdirsSync(statsvnTmpDir)
  }

  // 唯一标识，缓存的时候进行区分
  let uniqTag = generateFolderPathFromUrl(config.svnUrl)
  if (uniqTag) {
    uniqTag = `-${uniqTag}`
  }
  if (config.svnUsername || config.svnPassword) {
    uniqTag += `-${md5(config.svnUsername + '@@##@@' + config.svnPassword)}`
  }

  // 获取项目信息，废弃
  function clientGetInfo (client) {
    const tmpFilePath = path.resolve(statsvnTmpDir, `svn-info${uniqTag}.json`)

    // 发起获取信息的请求
    function realGeInfo (resolve) {
      // 如果 svnUrl 有值，则已此svnUrl远程地址的信息，否则取cwd所在的的svn仓库信息
      const params = [ config.svnUrl ]
      console.log(`svn ${['info', '--xml'].concat(params).join(' ')}`)
      client.getInfo(params, function (err, data) {
        const result = {
          err,
          data
        }

        if (err) {
          console.log(chalk.red("---error start------------------"))
          console.log(chalk.red(`错误信息: ${err.message}`))
          if (config.cwd) {
            console.log(chalk.red(`CWD: ${config.cwd}`))
          }
          if (config.svnUrl) {
            console.log(chalk.red(`SVN: ${config.svnUrl}`))
          }
          console.log(chalk.red(`建议：svn获取项目信息失败，请检查svn路径、用户、密码等信息是否正确，网络是否通畅`))
          console.log(chalk.red("---error end--------------------"))
        }

        fs.mkdirsSync(path.dirname(tmpFilePath))
        fs.writeFileSync(tmpFilePath, JSON.stringify(result, null, 2))
        resolve(result)
      })
    }

    return new Promise((resolve) => {
      if (!fsExistsSync(tmpFilePath)) {
        realGeInfo(resolve)
      } else {
        const result = JSON.parse(fs.readFileSync(tmpFilePath).toString())
        if (!result.err) {
          resolve(result)
        } else {
          // 如果报错，还是重新发起请求
          realGeInfo(resolve)
        }
      }
    })
  }

  // cmd方法
  function clientCmd (client, arr) {
    const tmpFilePath = path.resolve(statsvnTmpDir, 'cache', `${arr.join('#').replace(/:/g, "")}`)
    const tmpFilePath2 = path.resolve(statsvnTmpDir, 'origin', `${arr.join('#').replace(/:/g, "")}`)

    function realCmd (resolve) {
      console.log(`svn ${arr.join(' ')}`)
      client.session('silent', true).cmd(arr, function (err, data) {
        const result = {
          err,
          data
        }
        if (err) {
          result.errMsg = err && err.message && err.message.split('\n')[0]
          console.log(chalk.red(result.errMsg))
        }
        fs.mkdirsSync(path.dirname(tmpFilePath))
        fs.writeFileSync(tmpFilePath, JSON.stringify(result))
        if (!err) {
          fs.mkdirsSync(path.dirname(tmpFilePath2))
          fs.writeFileSync(tmpFilePath2, data)
        }
        resolve(result)
      })
    }

    return new Promise((resolve) => {
      if (!fsExistsSync(tmpFilePath)) {
        realCmd(resolve)
      } else {
        const result = JSON.parse(fs.readFileSync(tmpFilePath).toString())
        if (result.err) {
          realCmd(resolve)
        } else {
          resolve(result)
        }
      }
    })
  }

  async function clientGetInfo2 (client) {
    var infoResult = await clientCmd(client, ['info', '--xml', config.svnUrl])
    if (!infoResult.err) {
      const xmlResult = convert.xml2js(infoResult.data, {
        compact: true,
        spaces: 4
      })
      infoResult.data = {
        ...xmlResult,
        url: xmlResult.info.entry.url._text, // 兼容clientGetInfo写法返回
        'relative-url': xmlResult.info.entry['relative-url']._text, // 兼容clientGetInfo写法返回
      }
    }
    return infoResult
  }

  var infoResult = await clientGetInfo2(client)
  if (!infoResult.err) {
    const svnUrl = infoResult.data.url
    const relativeUrl = infoResult.data['relative-url']

    ret.svnInfo = infoResult.data

    // 如果 svnUrl 有值，则已此svnUrl远程地址的信息，否则取cwd所在的的svn仓库信息
    let logResult = await clientCmd(client, ['log', config.svnUrl, '-r', config.svnRevisionARG, '--xml', '-v'])

    if (!logResult.err) {
      const xmlResult = convert.xml2js(logResult.data, {
        compact: true,
        spaces: 4
      })

      fs.writeFileSync(path.resolve(statsvnTmpDir, `./svn-log-${config.svnRevisionARG.replace(/:/g, "")}${uniqTag}.json`), JSON.stringify(xmlResult, null, 2))

      if (!xmlResult.log.logentry) {
        xmlResult.log.logentry = []
      } else if (!Array.isArray(xmlResult.log.logentry)) {
        xmlResult.log.logentry = [xmlResult.log.logentry]
      }

      for (let item of xmlResult.log.logentry) {
        if (!Array.isArray(item.paths.path)) {
          item.paths.path = [item.paths.path]
        }

        const version = item._attributes.revision

        const author = item.author && item.author._text

        // 有配置作者，则过滤作者
        if (config.author && config.author !== author) {
          continue;
        }

        for (fileItem of item.paths.path) {
          let filePath = ''

          // 如果匹配不上，代表不是这个分支，故不处理，todo 怎样直接在svn导出直接过滤
          if (new RegExp(relativeUrl).test(fileItem._text)) {
            filePath = fileItem._text.replace(new RegExp(relativeUrl), "")
          } else {
            const relativeUrl2 = relativeUrl.replace('^', '')
            if (fileItem._text.startsWith(relativeUrl2)) {
              filePath = fileItem._text.replace(relativeUrl2, "")
            }
          }

          if (filePath) {
            filePath = filePath.slice(1) // 去除第一个/

             // 忽略的不处理，删除的不处理，特定后缀不处理
            if (config.ingorePaths.reduce((val, item) => !minimatch(filePath, item) && val, true) 
            && fileItem._attributes.action !== 'D' && (fileItem._attributes.kind === 'file' || fileItem._attributes.kind === '')) {

              const tmpFilePath = path.resolve(statsvnTmpDir, `diff/${version}/${filePath}`)

              // diff比较
              // 如果 svnUrl 有值，则已此svnUrl远程地址的信息，否则取cwd所在的的svn仓库信息
              let diffResult = await clientCmd(client, ['diff', '-c', version, joinUrlPath(svnUrl, filePath)])

              if (diffResult.err) {
                ret.failPaths.push({ path: filePath, err: diffResult.err })
              } else {
                // grep "^+" ./tmplate|grep -v "^+++"|sed 's/^.//'|sed '/^$/d'|wc -l
                // 以^+开头，但不已+++，且不已空行开头，不已注释开头（这里实际允许注释//开头）
                const arr = diffResult.data.split('\n')
                var validArr = arr.filter(item => {
                  return item.startsWith('+') && !item.startsWith("+++") && !!item.trim()
                })

                if (config.maxLineThreshold && validArr.length > config.maxLineThreshold) {
                  ret.overMaxLineThresholdPaths.push({ path: filePath })
                } else {
                  ret.paths.push({ path: filePath, lineTotal: validArr.length })
                  ret.total += validArr.length
                }
              }
            } else {
              ret.ingorePaths.push({ path: filePath })
            }
          } else {
            // 为空未根目录
          }
        }
      }
    }
  }

  fs.writeFileSync(path.resolve(statsvnTmpDir, `./svn-statsvn-${config.svnRevisionARG.replace(/:/g, "")}${uniqTag}.json`), JSON.stringify(ret, null, 2))

  if (config.delTmpAfterRunSingle) {
    fs.removeSync(statsvnTmpDir)
  }

  return ret
}

/**
 * 单个svn项目
 * @param {*} options = {
 *    svnProjectPaths: [], // D:/svnProject
 * }
 * @returns 
 */
async function runMore (options) {

  const config = Object.assign({}, options)

  const ret = {
    config,
    total: 0, // 总和
    arr: [],
  }

  const arr = []
  for (let i = 0; i < config.svnProjectPaths.length; i++) {
    // 规格化，['path'] => [{cwd: 'path'}]
    let item = config.svnProjectPaths[i]
    if (typeof item !== 'object') {
      item = { cwd: item }
    }
    const singleRet = await runSingle(Object.assign({}, config, item))
    arr.push(singleRet)
  }
  ret.total = arr.reduce((val, item) => val + item.total, 0)
  ret.arr = arr
  return ret
}

/**
 * 单个svn项目
 * @param {*} options = {
 *    svnProjectPaths: [], // D:/svnProject
 *    subSvnPaths: [], // ['auth', 'base', 'config']
 * }
 * @returns 
 */
async function run (options) {
  const config = Object.assign({}, options)

  if (config.svnProjectPaths.length) {
    return await runMore(config)
  } else if (config.subSvnPaths.length) {
    config.svnProjectPaths = config.subSvnPaths.map(item => {
      return path.resolve(config.cwd, item)
    })
    return await runMore(config)
  } else {
    return await runSingle(config)
  }
}

module.exports = {
  svnCheck,
  runSingle,
  run,
}

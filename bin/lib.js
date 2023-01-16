// 核心
// https://www.iteye.com/blog/ully-1270957
// svn log -r {2022-01-01}:{2022-12-31} --xml -v > %home%\\svnlog2022\\svn.log

var Client = require('svn-spawn')
var convert = require('xml-js');
var fs = require('fs-extra');
var Util = require('./utils')
var minimatch = require("minimatch")
var path = require('path')
var moment = require('moment');
const { info } = require('console');

var fsExistsSync = Util.fsExistsSync

/**
 * 检测是否正确安装svn
 */
async function svnCheck () {
  const client = new Client()

  const ret = { success: true, message: '', version: '' }

  return new Promise((resolve) => {
    client.cmd(['--version', '--quiet'], function (err, data) {
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
  }, options)

  if (!config.svnRevisionARG) {
    config.svnRevisionARG = `{${config.svnStartDayTime}}:{${config.svnEndDayTime}}`
  }

  var client = new Client({
    cwd: path.resolve(config.cwd), // 项目路径
    // username: 'username', // optional if authentication not required or is already saved
    // password: 'password', // optional if authentication not required or is already saved
    // noAuthCache: true, // optional, if true, username does not become the logged in user on the machine
  });

  var ret = {
    config,
    total: 0,
    paths: [], // { path: '', lineTotal: 0 }
    failPaths: [], // { path: '' }
    ingorePaths: [], // { path: '', err: '' }
    overMaxLineThresholdPaths: [], // { path: '' }
    svnInfo: {}, // { url: '' }
  }

  // 创建缓存目录
  const statsvnTmpDir = path.resolve(config.cwd, 'statsvnTmp')
  if (!fsExistsSync(statsvnTmpDir)) {
    fs.mkdirSync(statsvnTmpDir)
  }

  // promise方法
  function clientGetInfo (client) {
    const tmpFilePath = path.resolve(statsvnTmpDir, `svn-info.json`)
    return new Promise((resolve) => {

      if (!fsExistsSync(tmpFilePath)) {
        client.getInfo(function (err, data) {
          const result = {
            err,
            data
          }
          fs.mkdirsSync(path.dirname(tmpFilePath))
          fs.writeFileSync(tmpFilePath, JSON.stringify(result, null, 2))
          resolve(result)
        })
      } else {
        const result = JSON.parse(fs.readFileSync(tmpFilePath).toString())
        resolve(result)
      }
    })
  }

  // cmd方法
  function clientCmd (client, arr) {
    const tmpFilePath = path.resolve(statsvnTmpDir, `${arr.join('#').replace(/:/g, "")}`)

    return new Promise((resolve) => {
      if (!fsExistsSync(tmpFilePath)) {
        client.cmd(arr, function (err, data) {
          const result = {
            err,
            data
          }
          fs.mkdirsSync(path.dirname(tmpFilePath))
          fs.writeFileSync(tmpFilePath, JSON.stringify(result))
          resolve(result)
        })
      } else {
        const result = JSON.parse(fs.readFileSync(tmpFilePath).toString())
        resolve(result)
      }
    })
  }

  var infoResult = await clientGetInfo(client)
  if (!infoResult.err) {
    const svnUrl = infoResult.data.url
    const relativeUrl = infoResult.data['relative-url']

    ret.svnInfo = infoResult.data

    let logResult = await clientCmd(client, ['log', '-r', config.svnRevisionARG, '--xml', '-v'])

    if (!logResult.err) {
      const xmlResult = convert.xml2js(logResult.data, {
        compact: true,
        spaces: 4
      })

      fs.writeFileSync(path.resolve(statsvnTmpDir, `./svn-log-${config.svnRevisionARG.replace(/:/g, "")}.json`), JSON.stringify(xmlResult, null, 2))

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
              let diffResult = await clientCmd(client, ['diff', '-c', version, filePath])

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

  fs.writeFileSync(path.resolve(statsvnTmpDir, `./svn-statsvn-${config.svnRevisionARG.replace(/:/g, "")}.json`), JSON.stringify(ret, null, 2))

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

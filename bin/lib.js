// 核心
// https://www.iteye.com/blog/ully-1270957
// svn log -r {2022-01-01}:{2022-12-31} --xml -v > %home%\\svnlog2022\\svn.log

var Client = require('svn-spawn')
var convert = require('xml-js');
var fs = require('fs');
var minimatch = require("minimatch")
var path = require('path')
var moment = require('moment')

// promise方法
function clientGetInfo (client) {
  return new Promise((resolve) => {
    client.getInfo(function (err, data) {
      resolve({
        err,
        data
      })
    })
  })
}

// cmd方法
function clientCmd (client, arr) {
  return new Promise((resolve) => {
    client.cmd(arr, function (err, data) {
      resolve({
        err,
        data
      })
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
    svnRevisionARG: '',
    svnStartDayTime: moment().format("YYYY-MM-DD 00:00:00"), // 默认当天
    svnEndDayTime: moment().format("YYYY-MM-DD 23:59:59"),
    maxLineThreshold: 0, // 最大行数阈值，如果一个文件超过最大行数，则不处理他的新增行数信息 0代表不限制
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
  }
  
  var infoResult = await clientGetInfo(client)
  if (!infoResult.err) {
    const svnUrl = infoResult.data.url
    const relativeUrl = infoResult.data['relative-url']
    const logResult = await clientCmd(client, ['log', '-r', config.svnRevisionARG, '--xml', '-v'])
    if (!logResult.err) {
      const xmlResult = convert.xml2js(logResult.data, {
        compact: true,
        spaces: 4
      })

      if (config.debug) {
        fs.writeFileSync(path.resolve(config.cwd, "./statsvn-debug-svn-log.json"), JSON.stringify(xmlResult, null, 2))
      }

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

        for (fileItem of item.paths.path) {
          let filePath = fileItem._text.replace(new RegExp(relativeUrl), "")

         
          if (filePath) {
            filePath = filePath.slice(1) // 去除第一个/

             // 忽略的不处理，删除的不处理，特定后缀不处理
            if (config.ingorePaths.reduce((val, item) => !minimatch(filePath, item) && val, true) 
              && fileItem._attributes.action !== 'D' && fileItem._attributes.kind === 'file' ) {

              // diff比较
              const diffResult = await clientCmd(client, ['diff', '-c', version, filePath])
              if (diffResult.err) {
                ret.failPaths.push({ path: filePath, err: diffResult.err })
              } else if (config.maxLineThreshold && diffResult.data.length > config.maxLineThreshold)  {
                ret.ingorePaths.push({ path: filePath })
              } else {
                // grep "^+" ./tmplate|grep -v "^+++"|sed 's/^.//'|sed '/^$/d'|wc -l
                // 以^+开头，但不已+++，且不已空行开头，不已注释开头（这里实际允许注释//开头）
                const arr = diffResult.data.split('\n')
                var validArr = arr.filter(item => {
                  return item.startsWith('+') && !item.startsWith("+++") && !!item.trim()
                })

                ret.paths.push({ path: filePath, lineTotal: validArr.length })

                ret.total += validArr.length
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
    let item = config.svnProjectPaths[0]
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
    config.svnProjectPath = config.subSvnPaths.map(item => {
      return path.resolve(config.cwd, item)
    })
    return await runMore(config)
  } else {
    return await runSingle(config)
  }
}

module.exports = {
  runSingle,
  run,
}

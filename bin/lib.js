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
 * 
 * @param {*} options = {
 *    ingorePaths: [], // [**/node_modules/**]
 *    svnRevisionARG: '{2022-05-20 00:00:00}:{2022-05-20 23:59:59}', // 具体通过看svn log -h查看-r的参数格式
 *    svnStartDayTime: '', 2022-05-20 00:00:00 // 只有在svnRevisionARG为空的情况下使用
 *    svnEndDayTime: '', // 2022-05-20 23:59:59 // 只有在svnRevisionARG为空的情况下使用
 * }
 * @returns 
 */
async function run (options) {

  const config = Object.assign({}, options, {
    ingorePaths: [],
    svnRevisionARG: '',
    svnStartDayTime: moment().format("YYYY-MM-DD 00:00:00"), // 默认当天
    svnEndDayTime: moment().format("YYYY-MM-DD 23:59:59"),
  })

  if (!config.svnRevisionARG) {
    config.svnRevisionARG = `{${config.svnStartDayTime}}:{${config.svnEndDayTime}}`
  }

  var client = new Client({
    cwd: config.cwd, // 项目路径
    // username: 'username', // optional if authentication not required or is already saved
    // password: 'password', // optional if authentication not required or is already saved
    // noAuthCache: true, // optional, if true, username does not become the logged in user on the machine
  });

  var ret = {
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

      // fs.writeFileSync("./aa.json", JSON.stringify(xmlResult))

      if (!Array.isArray(xmlResult.log.logentry)) {
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

            if (config.ingorePaths.reduce((val, item) => !minimatch(filePath, item) && val, true)) {

              // diff比较
              const diffResult = await clientCmd(client, ['diff', '-c', version, filePath])
              if (!diffResult.err) {

                // grep "^+" ./tmplate|grep -v "^+++"|sed 's/^.//'|sed '/^$/d'|wc -l
                // 以^+开头，但不已+++，且不已空行开头，不已注释开头（这里实际允许注释//开头）
                const arr = diffResult.data.split('\n')
                var validArr = arr.filter(item => {
                  return item.startsWith('+') && !item.startsWith("+++") && !!item.trim()
                })

                ret.paths.push({ path: filePath, lineTotal: validArr.length })

                ret.total += validArr.length
              } else {
                ret.failPaths.push({ path: filePath, err: diffResult.err })
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

module.exports = {
  run,
}

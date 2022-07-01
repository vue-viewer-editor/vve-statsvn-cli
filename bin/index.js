// 核心
// https://www.iteye.com/blog/ully-1270957
// svn log -r {2022-01-01}:{2022-12-31} --xml -v > %home%\\svnlog2022\\svn.log

var Client = require('svn-spawn')
var convert = require('xml-js');
var fs = require('fs');
const { resolve } = require('path');

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

async function run () {
  var client = new Client({
    cwd: 'G:\\SvnWorkspaces\\20220629-inc-inc-emb-trunk-yr',
    // username: 'username', // optional if authentication not required or is already saved
    // password: 'password', // optional if authentication not required or is already saved
    // noAuthCache: true, // optional, if true, username does not become the logged in user on the machine
  });
  
  var infoResult = await clientGetInfo(client)
  if (!infoResult.err) {
    const svnUrl = infoResult.data.url
    const relativeUrl = infoResult.data['relative-url']
    const logResult = await clientCmd(client, ['log', '-r', '{2022-04-27}:{2022-04-28 15:02:57}', '--xml', '-v'])
    if (!logResult.err) {
      const xmlResult = convert.xml2js(logResult.data, {
        compact: true,
        spaces: 4
      })
      fs.writeFileSync("./aa.json", JSON.stringify(xmlResult))

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
            console.log(filePath)

            console.log('version', version, filePath)
            

            const diffResult = await clientCmd(client, ['diff', '-c', version, filePath])
            if (!diffResult.err) {

              

              // console.log(diffResult.data)
            } else {
              console.log('diffResult.err', diffResult.err)
            }
          } else {
            // 为空未根目录
          }
        }
      }
    }
  }
}

run ()

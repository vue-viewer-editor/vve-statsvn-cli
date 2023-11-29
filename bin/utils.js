"use strict";
const path = require("path");
const fs = require("fs");
const url = require('url');

// 判断文件是否存在
function fsExistsSync(path) {
  try {
    fs.accessSync(path, fs.F_OK);
  } catch (e) {
    return false;
  }
  return true;
}

exports.fsExistsSync = fsExistsSync;

// 拷贝文件
function copyFile(src, dist) {
  fs.writeFileSync(dist, fs.readFileSync(src));
}

exports.copyFile = copyFile;

// 过滤出满足规则的key，规则可以是一个字符串，正则或者函数
function filterObjByKeyRules(obj = {}, keyRules = []) {
  const newObj = {};
  if (keyRules.length === 0) {
    return newObj;
  }
  const keys = Object.keys(obj);
  keys.forEach(key => {
    for (let i = 0; i < keyRules.length; i++) {
      const keyRole = keyRules[i];
      if (
        (Object.prototype.toString.call(keyRole) === "[object RegExp]" &&
          keyRole.test(key)) ||
        (Object.prototype.toString.call(keyRole) === "[object Function]" &&
          keyRole(key)) ||
        keyRole === key
      ) {
        newObj[key] = obj[key];
        break;
      }
    }
  });
  return newObj;
}

exports.filterObjByKeyRules = filterObjByKeyRules;


// 判定一个KEY是否满足规则，满足一个则为true
// 规则可以是一个字符串，正则或者函数
function testRules(key, keyRules = []) {
  return keyRules.some(keyRole => {
    if (Object.prototype.toString.call(keyRole) === "[object RegExp]") {
      return keyRole.test(key)
    }
    if (Object.prototype.toString.call(keyRole) === "[object Function]") {
      return keyRole(key)
    }
    return keyRole === key
  })
}

exports.testRules = testRules;

// 根据url地址生成一个文件路径
function generateFolderPathFromUrl(urlString) {
  const parsedUrl = url.parse(urlString);
  const pathname = parsedUrl.pathname;
  if (pathname) {
    const folders = pathname.split('/').filter(folder => folder !== '');
    return folders.join("_");
  }
  return ''
}

exports.generateFolderPathFromUrl = generateFolderPathFromUrl;

// url 路径拼接
function joinUrlPath(baseUrl, relativePath) {
  if (relativePath.startsWith('/')) {
    relativePath = relativePath.substring(1);
  }
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.substring(0, baseUrl.length - 1);
  }
  return `${baseUrl}/${relativePath}`
}

exports.joinUrlPath = joinUrlPath;

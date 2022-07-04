'use strict';

const shelljs = require('shelljs')
const expect = require('chai').expect
const path = require('path')
const jsonfile = require("jsonfile");

describe('statsvn-cli', function () {
  this.timeout(60 * 1000)

  it ('should be a function', function (done) {
    shelljs.exec(`node ./bin/index.js`, function (code, stdout, stderr) {
      // todo
      done()
    })
  })
})

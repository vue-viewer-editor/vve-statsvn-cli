module.exports = {
  ingorePaths: [
    'npm-shrinkwrap.json',
    '**/dist/**',
    'dist/**',
    '**/node_module/**',
    'node_module/**',
    'statsvnTmp/**',
    '**/statsvnTmp/**',
    '.git/**',
    '.gitignore',
    '.vscode/**',
    '**/*.jpg', '**/*.jpeg', '**/*.png', '**/*.svg', '**/*.eot', '**/*.ttf', '**/*.woff', '**/*.woff2', '**/*.gif',
    '*.jpg', '*.jpeg', '*.png', '*.svg', '*.eot', '*.ttf', '*.woff', '*.woff2', '*.gif',
  ],
  maxLineThreshold: 1500,
  svnProjectPaths: [
    { cwd: 'G:/SvnWorkspaces/xxx', alias: '一个SVN项目' }, // 修改相关路径后，执行`npm run statsvn`开始统计，之后到对应svn目录下查看以`statsvn`文件名开头的文件
  ],
  debug: true,
  svnStartDayTime: "2023-01-01 00:00:00",
  svnEndDayTime: "2023-02-01 00:00:00",
  outDir: '.',
  outCsv: true,
}

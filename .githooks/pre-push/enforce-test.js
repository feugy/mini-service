#!/usr/bin/env node

const spawn = require('child_process').spawn
const join = require('path').join

spawn('npm', ['run', 'test'], {
  cwd: join(__dirname, '..', '..'),
  stdio: 'inherit',
  shell: true
}).on('exit', code => {
  if (code !== 0) {
    console.error('There are some test failure/linter/coverage error. Please fix them before push')
    return process.exit(code)
  }
  console.log('All tests are clear, please proceed !')
  process.exit(0)
})

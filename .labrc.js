const outputs = [{
  reporter: 'console',
  output: 'stdout'
}, {
  reporter: 'html',
  output: 'coverage/index.html'
}]

module.exports = {
  coverage: true,
  leaks: true,
  globals: '__core-js_shared__', // came from power-assert
  lint: true,
  'lint-warnings-threshold': 10,
  threshold: 98,
  transform: './node_modules/lab-espower-transformer',
  verbose: true,
  reporter: outputs.map(o => o.reporter),
  output: outputs.map(o => o.output)
}

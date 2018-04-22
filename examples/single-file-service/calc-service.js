const { startServer } = require('../../') // require('mini-service')

// service definition: name, version and the exposed APIs
// export it so you can easilly use it with a local caller
module.exports = {
  name: 'calc-service',
  version: '1.0.0',
  init: () => ({
    add: (a, b) => a + b,
    subtract: (a, b) => a - b
  })
}

// in server mode, simply call startServer() with the same service definition
if (process.argv[1].replace('.js', '') === __filename.replace('.js', '')) startServer(module.exports)

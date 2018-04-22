const { startServer } = require('../../') // require('mini-service')

// service definition: name, version and the exposed APIs
// export it so you can easilly use it with a local caller
module.exports = {
  name: 'documented-service',
  version: '1.0.0',
  // enable swagger descriptor, see https://github.com/glennjones/hapi-swagger
  openApi: {
    info: {
      title: 'Documentation example for mini-service',
      description: 'Provide OpenAPI descriptor and GUI thanks to <a href="https://github.com/glennjones/hapi-swagger">hapi-swagger</a>'
    },
    // default to /swagger.json
    jsonPath: '/openapi.json',
    // default to /documentation
    documentationPath: '/doc',
    // false to only expose swagger.json
    documentationPage: true,
    // attach general description to each group
    tags: [{
      name: 'users',
      description: 'Simplistic user repository'
    }]
  },
  groups: [
    require('./users')
  ]
}

startServer(module.exports)

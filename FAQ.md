# Frequently Asked Questions

- [What are deployment modes?](#what-are-deployment-modes)
- [Can exposed API be asynchronous?](#can-exposed-api-be-asynchronous)
- [Where to put asynchronous initialization?](#where-to-put-asynchronous-initialization)
- [Can initialization code be configured?](#can-initialization-code-be-configured)
- [How can service definition be more modular?](#how-can-service-definition-be-more-modular)
- [How can initialisation be shared by different groups?](#how-can-initialisation-be-shared-by-different-groups)
- [How could input parameters be validated?](#how-could-input-parameters-be-validated)
- [Is Swagger/OpenAPI supported?](#is-swaggeropenapi-supported)

## What are deployment modes?

µServices based on mini-service could be deployed either:
- locally: runs on the same nodejs process as the caller code
  ```js
  const {getClient} = require('mini-service')

  // define a service
  const calc = getClient({
    name: 'calc',
    version: '1.0.0',
    init: () => ({
      add: (a, b) => a + b
    })
  })

  await calc.init()

  // invoke exposed api as async function
  const sum = await calc.add(10 + 5)
  ```

- remotely: runs as a dedicated HTTP server
  ```js
  // server.js
  const {startServer} = require('mini-service')

  // define a service, start Http server
  startServer({
    name: 'calc',
    version: '1.0.0',
    init: () => ({
      add: (a, b) => a + b
    })
  })
  ```

  ```js
  // client.js
  const {getClient} = require('mini-service')

  // will connect to server on demand
  const calc = getClient({
    remote: 'http://localhost:3000'
  })

  // invoke exposed api as async function
  const sum = await calc.add(10 + 5)
  ```

No need to add the service code as a dependency when using `getClient()` with remote url/


## Can exposed API be asynchronous?

Yes, by using Promises:

```js
const {startService} = require('mini-service')

startService({
  name: 'calc',
  version: '1.0.0',
  init: () => ({
    add: (a, b) => a + b,                    // synchronous API,
    subtract: async (a, b) => a - b          // asynchronous API, async/await syntax
    divide: (a, b) => Promise.resolve(a / b) // asynchronous API, promise-based
  })
})
```


## Where to put asynchronous initialization? (connect to DB, open files...)

To serve this purpose, the `init()` function can be either synchronous or return a Promise.

```js
const {promisify} = require('util')
const readFile = promisify(require('readFile').readFile)
const {startService} = require('mini-service')

startService({
  name: 'async-init',
  version: '1.0.0',
  init: async () => {
    // let's say we need to read a configuration file...
    const content = await readFile('whatever.html')
    return {
      // exposed API list
    }
  }
})
```

Rejecting the `init()` promise will prevent server to start.


## Can initialization code be configured?

`init()` functions are invoked with a single Object parameter, populated with values from the service descriptor.

```js
const {promisify} = require('util')
const readFile = promisify(require('readFile').readFile)
const {startService} = require('mini-service')

const config = {
  filePath: 'whatever.html'
}

startService({
  name: 'configurable-init'
  version: '1.0.0',
  // single parameter is the service definition itself
  init: async ({filePath}) => {
    const content = await readFile(filePath)
    return {
      // exposed API list
    }
  },
  // all keys in the service definition will be passed to init()
  ...config
})
```

If you use [API groups](#how-can-service-definition-be-more-modular), each group has its own configuration object stored in `groupOpts[group.name]`.


## How can service definition be more modular?

Service definition object tend to grow quickly.
API groups is how mini-service makes the code more modular.

This big service definition:

```js
const {startService} = require('mini-service')

startService({
  name: 'monolitic-service',
  version: '1.0.0',
  init: () => ({
    api1: () => {/* ... */},
    api2: () => {/* ... */},
    api3: () => {/* ... */},
    api4: () => {/* ... */},
    api5: () => {/* ... */}
  })
})
```

can be turned to different groups:

```js
// server.js
const {startService} = require('mini-service')

startService({
  name: 'modular-service',
  version: '1.0.0',
  groups: [
    require('./api/group1'),
    require('./api/group2')
  ],
  groupOpts: {
    group1: {/* for group 'group1' */},
    group2: {/* for group 'group2' */}
  }
})
```

```js
// api/group1.js
module.exports = {
  // must be a valid JS identifier
  name: 'group1',
  // opts comes from groupOpts[group1]
  init: opts => ({
    api1: () => {/* ... */},
    api2: () => {/* ... */}
  })
}
```

```js
// api/group2.js
module.exports = {
  name: 'group2',
  // opts comes from groupOpts[group2]
  init: opts => ({
    api3: () => {/* ... */},
    api4: () => {/* ... */},
    api5: () => {/* ... */}
  })
}
```

Please note that groups are initialized **sequentially**, following the declaration order.


## How can initialisation be shared by different groups?

Services are initialized sequentially.
One can use orderring to perform shared initialization.


```js
// server.js
const {startService} = require('mini-service')

let shared

startService({
  name: 'modular-configurable-service',
  version: '1.0.0',
  groups: [{
    name: 'global-init',
    init: obj => {
      // initialized shared items
      shared = { /* ... */ }
      // doesn't have to expose any API
    }
  }, {
    name: 'group1',
    // pass your shared object to your init method, as well as other options
    init: opts => require('./api/group1')(shared, opts)
  ],
  groupOpts: {
    shared: {/* for group 'shared' */}
    group1: {/* for group 'group1' */}
  }
})
```

```js
// api/group1.js
module.exports = (shared, opts) {
  // initialization code, can use shared items
  return {/* exposed APIs */}
}
```


## How could input parameters be validated?

As parameters validation is a common pattern (syntactic validation), mini-service supports it out of the box.
Parameters of exposed API could be validated with [Joi](https://github.com/hapijs/joi/blob/master/API.md).

Assign an array of *validation schemas* to the `validate` property of an exposed API.
Each schema will validated a given parameter (order matters).

```js
const Joi = require('joi')
const {startService} = require('mini-service')

startService({
  name: 'my-service',
  version: '1.0.0',
  init: () => {
    // declare your API
    const add = (a, b) => a + b
    // attached a schema for each parameter in an array
    add.validate = [
      Joi.Number().required(), // a
      Joi.Number().required() // b, example used in Swagger documentation
    ]
    return {add}
  }
})
```

Prior to any invokation of the API, incoming parameters will be matched against the validation schema.
The invokation will fail with a 400 error (Bad Request) if they don't comply.

## Is Swagger/OpenAPI supported?

Yes, but is disabled by default. It can only be used through `startService()`.

To enable and customize it, use `openApi` configuration key.

```js
const Joi = require('joi')
const {startService} = require('mini-service')

startService({
  name: 'documented-service',
  version: '1.0.0',
  openApi: {
    // see https://github.com/glennjones/hapi-swagger/blob/master/optionsreference.md
    info: {
      title: 'Simple calculator'
    }
    /* defaults are:
    info: {version},
    documentationPath: '/documentation',
    jsonPath: '/swagger.json',
    basePath: '/api',
    pathPrefixSize: 2
    */
  }
  init: () => {
    const add = (a, b) => a + b

    // document api
    add.description = 'Sum numbers'
    add.notes = 'Only works with two numbers'

    // document parameters
    add.validate = [
      Joi.Number().required().description('reference number').example(5),
      Joi.Number().required().description('added to reference').example(2)
    ]
    return {add}
  }
})
```

See a more [complete example](https://github.com/feugy/mini-service/tree/master/examples/documented-service).

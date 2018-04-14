# Frequently Asked Questions

- [What are deployment modes?](#what-are-deployment-modes-)
- [Can exposed API be asynchronous?](#can-exposed-api-be-asynchronous-)
- [Are there limitations on exposed API signatures?](#are-there-limitations-on-exposed-api-signatures-)
- [Where to put asynchronous initialization?](#where-to-put-asynchronous-initialization-)
- [Can initialization code be configured?](#can-initialization-code-be-configured-)
- [How can service definition be more modular?](#how-can-service-definition-be-more-modular-)
- [How can initialisation be shared by different groups?](#how-can-initialisation-be-shared-by-different-groups-)
- [How could input parameters be validated?](#how-could-input-parameters-be-validated-)
- [How could results be validated](#how-could-results-be-validated-)
- [Is Swagger/OpenAPI supported?](#is-swagger-openapi-supported-)
- [Can endpoint method/headers/query be configured?](#can-endpoint-method-headers-query-be-configured-)

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


## Are there limitations on exposed API signatures?

Despite all our efforts, yes. Hopefully main cases are covered.

Because parameters will be stringified when sent to server:
- they could be of these any type that fundamental objects: Array, Boolean, Number, Strings, Object
- they could be `null` or `undefined`
- they could be of other types (Date, Error, RegExp, custom classes...) but will boils down to the output of their `toString()` method

In particular, don't use functions as parameters.

Same limitations applies to API returned object.

You can use destructuring, rest parameters and even default values:
```js
async withExoticParameters ([a, b], {c: {d}} = {}, ...other) {
  return [a, b, d, ...other]
}
```

However, Node's `Buffer` type is supported, as long as:
- it is the only parameter, and the API has `Joi.binary` (not wrapped in an array) attached as input validation
- it is returned by the API
```js
const api = {
  async bufferHandling (buffer) {
    assert(Buffer.isBuffer(buffer))
    return Buffer.concat([buffer, new Uint8Array([3, 4])])
  }
}
// adds inut validation to enable buffer
apis.bufferHandling.validate = Joi.binary().required()
```

Nesting buffers in plain object doesn't work.


## Where to put asynchronous initialization?

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
  name: 'validate-inputs',
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


## How could results be validated?

Although less common, returned results can be validated against a [Joi](https://github.com/hapijs/joi/blob/master/API.md) schema by assigning to the expose API:
- a *validation schemas* to the `responseSchema`.
- `true` to `validateResponse` property.

Ommitting `validateResponse` property (or setting a falsy value) will disable result validation.

Results that don't match response schema will trigger a 512 `Bad Response` error.

```js
const Joi = require('joi')
const {startService} = require('mini-service')

startService({
  name: 'validate-results',
  version: '1.0.0',
  init: () => {
    // declare your API
    const add = (a, b) => a + b
    // adds output documentation & validation
    add.responseSchema = Joi.number().required()
    add.validateResponse = true
    return {add}
  }
})
```


## Is Swagger/OpenAPI supported?

Yes, but is disabled by default. It can only be used through `startService()`.

To enable and customize it, use `openApi` configuration key.
Documentation can be added:
- at upper level: `openApi.info.title`, `openApi.info.description`
- at group level: `openApi.tags[].description` (`tags[].name` has to match group's name)
- at api level, by attaching to the exposed API:
  - `description`: general description
  - `notes`: string or array of implementation notes
  - `validate`: array of Joi objects to validate incoming parameters (request body)
  - `responseSchema`: Joi object describing expected response

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

    // document results
    add.responseSchema = Joi.Number().required().description('number summation').example(7)
    return {add}
  }
})
```

See a more [complete example](https://github.com/feugy/mini-service/tree/master/examples/documented-service).


## Can endpoint method/headers/query be configured?

No it cannot.

Mini-service purposely hides details regarding exposed Http endpoints.
Its goal is not to be another web framework, but acts more as an remote-procedure-call toolkit.

When exposing an API function, the following conventions apply:
- endpoint path is `/api/${function name}` (case sensitive)
- endpoint method is `GET` if function has no declared parameters, `POST` otherwise
- endpoint headers can not be configured
- endpoint query string can note be configured
- incoming request payload is always parsed as JSON
- when `validate` is set, and request payload doesn't comply, a 400 `Bad Request` error is returned with details
- when `responseSchema` and `validateResponse` are set, and response payload doesn't comply, a 512 `Bad Response` error is returned with details
- otherwise, endpoint always returns 200, and result (if it exists) is always serialized as JSON

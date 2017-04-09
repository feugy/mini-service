# Frequently Asked Questions

## How can my µService be deployed ?

You can use it locally (same node.js instance as the caller code), or remotely (deployed as remote HTTP server).
Local is the default mode.

To use remotely, simply:

 - call `startServer()` with your service definition (including init function options)
 - from the caller code, provide the Http server url to your client: `const client = require('service')({remote: 'http://my-service:3000')`

And that's all !


## I'm tired of writing parameters validation logic...

Because validating (from a syntactic point of view) parameters is so common, mini-service includes a validation feature.
Each exposed API can be linked to a [Joi](https://github.com/hapijs/joi/blob/master/API.md) validation object.
This object is an array of *validation schema*, each of them bound to a parameter and specifying parameter syntactic expectations.

```javascript
const Joi = require('joi')
const {startService} = require('mini-service')

startService({
  name: 'my-service',
  version: '1.0.0',
  init: () => {
    // declare your API
    const add = (a, b) => Promise.resolve(a + b)
    // attached a schema for each parameter in an array
    add.validate = [
      Joi.Number().required(), // a
      Joi.Number().required(), // b
    ]

    return Promise.resolve({add})
  }
})
```

Prior to any invokation of the API, incoming parameters will be matched against the validation schema, and rejected with
a 400 error (Bad Request) if they don't comply with expectations.

Tying a schema to an API can be done by assigning a `validate` property the API function, and this schema will only be
used if the API has at least one parameter.


## My service definition isn't really modular...

Your service definition object will probably grow quickly.
Mini-service offers you an approach to make it more modular: API groups.

You can turn this big service definition:

```javascript
const {startService} = require('mini-service')

startService({
  name: 'my-big-service',
  version: '10.4.2',
  init: opts => {
    // ... initialization code
    return Promise.resolve({
      api1: () => {/* ... */},
      api2: () => {/* ... */},
      api3: () => {/* ... */},
      api4: () => {/* ... */},
      api5: () => {/* ... */},
      // ...
    })
  },
  // other opts for init()
})
```

To use different groups:
`server.js`
```javascript
const {startService} = require('mini-service')

startService({
  name: 'my-big-service',
  version: '10.4.2',
  groups: [
    require('api/group1'),
    require('api/group2')
  ],
  groupOpts: {
    group1: {/* group 1 init options */},
    group2: {/* group 2 init options */}
  }
}
```
`api/group1.js`
```javascript
module.exports =
  name: 'group1', // must be a valid JS identifier (for the groupOpts hash)
  init: opts => {
    // initialization code, opts is groupOpts.group1
    return Promise({
      api1: () => {/* ... */},
      api2: () => {/* ... */}
    })
  }
}
```

Please note that groups are initialized **sequentially**, following the declaration order.


## My service needs to connect to DB/open some files/use asynchronous initialization code...

The `init()` function is the right place to do that:

```javascript
const fs = require('readFile')

module.exports = {
  name: 'calc'
  init: () => new Promise((resolve, reject) => {
    // let's say we need to read a configuration file...
    fs.readFile('config.json', (err, content) => {
      if (err) return reject(err)
      // initialization goes on...
      // when you're ready, resolve the promise with the exposed functions
      resolve({
        add: (a, b) => Promise.resolve(a + b)
        subtract: (a, b) => Promise.resolve(a - b)
      })
    })
  })
}]
```

Rejecting the `init()` promise will prevent server to start.


## How do I configure my service initialization ?

The `init()` function will be invoked with a single Object parameter, populated with values from the service descriptor.

```javascript
const fs = require('readFile')

module.exports = [{
  name: 'calc'
  // opts is an object
  init: opts => new Promise((resolve, reject) => {
    // use file given in options instead of hardcoded the value
    fs.readFile(opts.config, (err, content) => {
      if (err) return reject(err)
      resolve({
        add: (a, b) => Promise.resolve(a + b)
        subtract: (a, b) => Promise.resolve(a - b)
      })
    })
  }),
  // configuration values
  config: 'config.json'
}]
```

If you use API groups, the actual options hash is taken from `groupOpts[group.name]`

If you use the simpler service definition form, options hash is the service definition itself.


## How can I share initialisation between different files ?

Services will be initialized serially, so you can use this order to perform general initialization.

```javascript
// shared object among services
let sql

module.exports = [{
  name: 'global-init',
  init: options => new Promise(resolve => {
    sql = mysqljs(options)
    // no need to expose anything
    resolve()
  })
}, {
  name: 'calc',
  // pass your shared object to your init method, as well as other options
  init: opts => require('./calc')(sql, opts)
}, {
  name: 'utilities',
  init: opts => require('./utilities')(sql, opts)
}]
```

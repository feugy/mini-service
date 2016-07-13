# Simplistic µService skeleton

The goal of this skeleton is to give the minimal structure to implement a µService, that can be invoked locally or remotely.

Its principles are the following:
- very easy to add new service api endpoints
- easy to use client interface, same usage both locally and remotely
- hide deployment details and provide simple-yet-working solution
- promises based

## Client usage

In a nodejs module *caller* that needs to use this µService *service*, add the µService as NPM dependency:

`> npm install --save-dev service`

Then require the exposed interface (given that service exposes an `add()`api):

```javascript
const client = require('service')()
// you can also provide options, see below..

console.log(client.version)
// outputs µService NPM version

client.init().then(() => {
  client.add(10, 5).then(sum => console.log(sum))
})

// outputs 15
```

## Server usage

Inside your *service* module, you can expose as many APIs as you want.
Go to the `/lib/services/index.js` file, and add your own code, e.g.

```javascript
module.exports = [{
  // you can group your API and give them a name
  name: 'calc',
  // you need to provide an initialization function, that will take options,
  // and returns a Promise when APIs are ready to be used
  init: () => Promise.resolve({
    // each exposed API is a function that takes as many parameters as needed, and returns a Promise
    add: (a, b) => Promise.resolve(a + b),
    subtract: (a, b) => Promise.resolve(a - b)
  })
}]
```

For an example, see [sample.js](./test/fixtures/sample.js).

Note: you don't need to put all the code in this file, you're free to divide it into different files/modules.
In that case, simply require and add them into the array exported by `/lib/services/index.js`.

## How can my µService be deployed ?

You can use it locally (same node.js instance as the caller code), or remotely (deployed as remote HTTP server).
Local is the default mode.

To use remotely, simply:

 - start your µService as an Http server by running `> npm start`
 - from the caller code, provide the Http server url to your client: `const client = require('service')({remote: 'http://my-service:8080')`

And that's all !

## My service needs to connect to DB/open some files/use asynchronous initialization code...

The `init()` function is the right place to do that:

```javascript
const fs = require('readFile')

module.exports = [{
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

## How do I configure my service initialization ?

The `init()` function takes a single Object parameter, that can be used for options:

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
  })
}]
```

To specify actual parameter values, change the caller code:

- local µService, in the *caller* code:
  ```javascript
  const client = require({
    // all options are regrouped under serviceOpts
    serviceOpts: {
      // reuse service name as property, and give any value you need
      calc: {config: './config.json'}
    }
  })
  ```

- remote µService, in `./bin/start.js` file:
  ```javascript
  const startServer = require('../lib/server')

  startServer({
    // all options are grouped under serviceOpts
    serviceOpts: {
      // use service name as property, and give any value you need
      calc: {config: './config.json'}
    }
  })
  ```

In addition to the specified options, your service `init()` parameter also contains `logger` property, which is the overall Bunyan logger.

## How can I exposed function from different files ?

Instead of putting everything in the same file, you can use as many files as you want.
A simple file layout example:

`/lib/services/index.js`

```javascript
module.exports = [
  {name: 'calc', init: require('./calc')},
  {name: 'utilities', init: require('./utilities')}
]
```

`/lib/services/calc.js`

```javascript
// you need to provide an initialization function, that will take options,
// and returns a Promise when APIs are ready to be used
module.exports = options => Promise.resolve({
  // each exposed API is a function that takes as many parameters as needed, and returns a Promise
  add: (a, b) => Promise.resolve(a + b),
  subtract: (a, b) => Promise.resolve(a - b)
})
```

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

## Acknowledgements

This project was kindly sponsored by [nearForm](http://nearform.com).


## License

Copyright [Damien Simonin Feugas](https://github.com/feugy) and other contributors, licensed under [MIT](./LICENSE).
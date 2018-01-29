# Mini-service

Simplistic µService library

[![npm package][npm-badge]][npm-url]
[![NSP Status][nsp-badge]][nsp-url]
[![dependencies][david-badge]][david-url]
[![build][travis-badge]][travis-url]
[![coverage][coveralls-badge]][coveralls-url]
[![License: MIT][license-badge]][license-url]

- [API Reference][api-reference-url]
- [Frequently asked questions][faq]
- [Examples][examples]

## Introduction

The goal of mini-service is to give the minimal structure to implement a µService, that can be invoked locally or remotely.

Its principles are the following:
- very easy to add new service api endpoints
- easy to use client interface, same usage both locally and remotely
- hide deployment details and provide simple-yet-working solution
- promises based (and thus, async/await compatible)

mini-service uses the latest ES6 features, so it requires node 6+


## Example

Here is a simple calculator service definition, that exposes functions to add and subtract numbers.

`calc-service.js`
```javascript
module.exports = {
  name: 'calc-service',
  version: '1.0.0',
  init: () => {
    // each exposed APIs could also return a promise/be async
    add: (a, b) => a + b,
    subtract: (a, b) => a - b
  }
}
```

If you want to use it locally in a different file:
require the service definition, and create a [mini-client][mini-client-url] with it

`caller-local.js`
```javascript
const {getClient} = require('mini-service')
const calcService = require('./calc-service')

const calc = getClient(calcService)
```

Then, init it (it's an async operation) and invoke any exposed API you need:

`caller-local.js`
```javascript
await calc.init()
const sum = await calc.add(10, 5)
console.log(`Result is: ${sum}`)
```

Now let's imagine you need to deploy your calculator service in a standalone Http server, and invoke it from a remote server.
To turn your local service into a real server, expose your service definition with mini-service's `startServer()`:

`calc-service.js`
```javascript
const {startServer} = require('mini-service')

module.exports = {...} // same service definition as above
// starts Http server
startServer(module.exports)
```
A server is now listening on port 3000.

And to use it from a remote caller, creates a mini-client giving the proper url:

`caller-remote.js`
```javascript
const getClient = require('mini-client') // or: const {getClient} = require('mini-service')

const calc = getClient({
  remote: 'http://localhost:3000'
})
```
Please note that you **don't need to require the service definition anymore**.

Usage is exactly the same as previously.

`caller-remote.js`
```javascript
await calc.init() // no-op, can be skipped
const sum = await calc.add(10, 5)
console.log(`Result is: ${sum}`)
```


## Acknowledgements

This project was kindly sponsored by [nearForm][nearform].


## License

Copyright [Damien Simonin Feugas][feugy] and other contributors, licensed under [MIT](./LICENSE).


## 2.x to 3.x changes

Groups are now used as sub-objects of mini-client.

Given a service exposing:
- api `ping` without group *(or if group has same name as overall service)*
- group `a` with apis `ping` & `pong`
- group `b` with api `ping`

the final Mini-client will be:
```javascript
client = {
  ping(),
  a: {
    ping(),
    pong()
  },
  b: {
    ping()
  }
}
```


## 1.x to 2.x changes

Local services, as remote services, **must** have `name` and `version` options defined

When loading services, the `services` property was renamed to `groups`, and `serviceOpts` is now `groupOpts`:

```javascript
const {startServer} = require('mini-service')

startServer({
  groups: [ // was services previously
    require('../serviceA'),
    require('../serviceB'),
    require('../serviceC')
  ],
  groupOpts: { // was serviceOpts previously
    serviceA: {},
    serviceB: {},
    serviceC: {}
  }
})
```

[nearform]: http://nearform.com
[feugy]: https://github.com/feugy
[david-badge]: https://img.shields.io/david/feugy/mini-service.svg
[david-url]: https://david-dm.org/feugy/mini-service
[npm-badge]: https://img.shields.io/npm/v/mini-service.svg
[npm-url]: https://npmjs.org/package/mini-service
[travis-badge]: https://api.travis-ci.org/feugy/mini-service.svg
[travis-url]: https://travis-ci.org/feugy/mini-service
[coveralls-badge]: https://img.shields.io/coveralls/feugy/mini-service/master.svg
[coveralls-url]: https://coveralls.io/r/feugy/mini-service?branch=master
[api-reference-url]: https://feugy.github.io/mini-service/?api
[faq]: https://feugy.github.io/mini-service/?content=faq
[examples]: https://github.com/feugy/mini-service/tree/master/examples
[mini-client]: https://feugy.github.io/mini-client/
[license-badge]: https://img.shields.io/badge/License-MIT-green.svg
[license-url]: https://github.com/feugy/mini-service/blob/master/LICENSE
[nsp-badge]: https://nodesecurity.io/orgs/perso/projects/6bc9b474-6f9e-4db0-a4d3-c3bf5443a63a/badge
[nsp-url]: https://nodesecurity.io/orgs/perso/projects/6bc9b474-6f9e-4db0-a4d3-c3bf5443a63a
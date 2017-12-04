# Mini-service

Simplistic µService skeleton

[![npm package][npm-image]][npm-url]
[![dependencies][david-image]][david-url]
[![build][travis-image]][travis-url]
[![coverage][coveralls-image]][coveralls-url]

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
    // each exposed APIs could also return a promise
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
calc.init().then(() =>
  calc.add(10, 5).then(sum => console.log(`Result is: ${sum}`))
)
```

Now let's imagine you need to deploy your calculator service in a standalone Http server, and invoke it from a remote server.
To turn your local service into a real server, expose your service definition with mini-service's `startServer()`:

`calc-service.js`
```javascript
const {startServer} = require('mini-service')

module.exports = {...} // same service definition as above
startServer(module.exports)
```
A server is now listening on port 3000.

And to use it from a remote caller, creates a mini-client giving the proper url:

`caller-remote.js`
```javascript
const getClient = require('mini-client') // same as: `const {getClient} = require('mini-service')`

const calc = getClient({
  remote: 'http://localhost:3000'
})
```
Please note that you **don't need to require the service definition anymore**.

Usage is exactly the same as previously.

`caller-remote.js`
```javascript
calc.init().then(() =>
  calc.add(10, 5).then(sum => console.log(`Result is: ${sum}`))
)
```

Simplistic, but it fits lots of usecases


## Going further

Please also checkout:
- [API Reference][api-reference-url]
- [Frequently asked questions][faq]
- [Examples][examples]

FAQ covers topics like modularity, aynsc initialization, parameters validation...

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

## Changelog

### 3.2.1
- diabled low-level socket timeout

### 3.2.0
- Support synchronous `init()` and API functions
- Dependencies update

### 3.1.0
- Don't wrap Boom errors to keep http status codes
- Use [standard.js](https://standardjs.com/) lint configuration

### 3.0.0
- [*Breaking change*] Use mini-client@3.0.0 that uses sub-objects for exposed groups.
- Returns CRC32 checksum of exposed API during every call, to allow mini-client checking compatibility
- Dependency update (except Joi 11 that introduced a regression in Hapi)

### 2.1.0

### 2.0.0
- Externalized client using [mini-client][mini-client-url], to decouple clients and service code
- [*Breaking change*] Introduce new terminology, with service descriptor and API groups
- [*Breaking change*] When parsing exposed APIs, expect 'group' property instead of 'name'
- Allow to declare API without groups
- Allow to declare API validation in group options
- [*Breaking change*] Force name+version on local client
- Better documentation and code examples
- More understandable error messages

### 1.3.0
- Add NSP checks, and upgrade vulnerable dependency

### 1.2.2
- fix parameter detection
- fix Proxy that is detected as a Thenable object

### 1.2.1
- fix issue related to parameter name extraction when using arrow functions

### 1.2.0
- use proxy to delay remotely exposed Apis retrieval to the first effective usage
- activate Travis CI and coveralls reports
- update dependencies

### 1.1.3
- client functions always returns a real promise (request-promise return a mixed stream + promise object that prevent direct usage in Hapi)
- checks exposed services interface to avoid mistakes

### 1.1.2
- update dependencies
- use lab configuration file

### 1.1.1
- fix bug that prevent to specify version when creating the service

### 1.1.0
- allows to use general logger object within exposed services

### 1.0.0
- initial release

[nearform]: http://nearform.com
[feugy]: https://github.com/feugy
[david-image]: https://img.shields.io/david/feugy/mini-service.svg
[david-url]: https://david-dm.org/feugy/mini-service
[npm-image]: https://img.shields.io/npm/v/mini-service.svg
[npm-url]: https://npmjs.org/package/mini-service
[travis-image]: https://api.travis-ci.org/feugy/mini-service.svg
[travis-url]: https://travis-ci.org/feugy/mini-service
[coveralls-image]: https://img.shields.io/coveralls/feugy/mini-service/master.svg
[coveralls-url]: https://coveralls.io/r/feugy/mini-service?branch=master
[api-reference-url]: https://feugy.github.io/mini-service/
[faq]: https://minigithub.com/feugy/mini-service/tree/master/FAQ.md
[example]: https://github.com/feugy/mini-service/tree/master/examples
[mini-client]: https://feugy.github.io/mini-client/
# Simplistic µService skeleton

The goal of this skeleton is to give the minimal structure to implement a µService. that can be invoked locally or remotely.

Its principles are the following:
- impose very few constraint to developers that will add features
- expose an easy to use interface to user code
- hide deployment details and provide simple-yet-working solution

## How do I use features from my µService ?

In a nodejs module *caller* that needs to use this µService *service*, add the µService as NPM dependency.

`> npm install --save-dev service`

Then require the exposed interface (given that service exposes a `add()`api):

```javascript
const client = require('service')()
// you can provide options, see further

console.log(client.version)
// ouputs µService NPM version

client.init().then(() => {
  client.add(10, 5).then(sum => console.log(sum))
})

// outputs 15
```

## How do I add features to my µService ?

Inside you *service* module, you can expose as many APIs as you want.
Goes to the `/lib/services/index.js` file, and add you own code.

```javascript
module.exports = [{
  // you can regroup your API and give them a name
  name: 'calc',
  // you need to provide an initialization function, that will take options,
  // and returns a Promise when APIs is ready to be used
  init: () => Promise.resolve({
    // each exposed API is a function that takes as many parameters as needed, and returns a Promise
    add: (a, b) => Promise.resolve(a + b),
    subtract: (a, b) => Promise.resolve(a - b)
  })
}]
```

You don't need to put all the code in this file, you're free to divide it into different files/modules.
In that case, simply requires and add them into the array exported by `/lib/services/index.js`

## How my µService can be deployed ?

You can use it locally (same node.js instance as the caller code), or remotely (deployed as remote Http server).
Local is the default mode.
To go remote, simply:

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

The `init()` function takes a single Object parameter, that you can use as option

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
    // all options are regrouped under serviceOpts
    serviceOpts: {
      // reuse service name as property, and give any value you need
      calc: {config: './config.json'}
    }
  })
  ```
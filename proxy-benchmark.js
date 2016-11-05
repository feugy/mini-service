'use strict'

const benchmark = require('benchmark')
const list = [1, 2, 3, 4, 5]

const sum = () => {
  let total = 0
  for (let i = 0; i < list.length; i++) {
    total += list[i]
  }
  return total
}

// simple object
const obj = {sum}

// proxy that wraps an empty object
const emptyProxy = new Proxy({}, {
  get(target, key) {
    if (key === 'sum') {
      return obj.sum
    }
    return undefined  // eslint-disable-line no-undefined
  }
})

// no-op proxy around
const noopProxy = new Proxy(obj, {})

// one-time proxy
const handler = {
  get(target, key) {
    target.sum = sum
    delete handler.get
    return target[key]
  }
}
const oneTimeProxy = new Proxy({}, handler)

new benchmark.Suite().add('normal method', () =>
  obj.sum()
).add('proxy', () =>
  emptyProxy.sum()
).add('no-op proxy', () =>
  noopProxy.sum()
).add('one time proxy', () =>
  oneTimeProxy.sum()
).on('cycle', ({target}) =>
  console.log(target.toString()) // eslint-disable-line no-console
).run()

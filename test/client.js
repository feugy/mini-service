const Lab = require('lab')
const assert = require('power-assert')
const moment = require('moment')
const client = require('../')
const startServer = require('../lib/server')
const {version} = require('../package.json')
const utils = require('./utils')

const lab = exports.lab = Lab.script()
const {describe, it, before, beforeEach, after} = lab

const services = [{
  name: 'sample',
  init: require('./fixtures/sample')
}]

describe('service\'s client', () => {

  before(utils.shutdownLogger)

  after(utils.restoreLogger)

  it('should expose service\'s version', done => {
    assert.equal(client().version, version)
    done()
  })

  it('should be initialized multiple times', () => {
    const instance = client({services})
    return instance.init()
      .then(() => instance.init())
  })

  const declareTests = context => {

    it('should respond to ping', () =>
      context.client.ping()
        .then(result => {
          assert(moment(result.time).isValid())
          assert.equal(typeof result.time, 'string')
        })
    )

    it('should greets people', () =>
      context.client.greeting('Jane')
        .then(result => {
          assert.equal(result, 'Hello Jane nice to meet you !')
        })
    )

    it('should handle API errors', () =>
      context.client.failing()
        .then(res => {
          assert.fail(res, '', 'unexpected result')
        }, err => {
          assert(err instanceof Error)
          assert.notEqual(err.message.indexOf('really bad'), -1)
        })
    )

    it('should validate parameter existence', () =>
      context.client.greeting()
        .then(res => {
          assert.fail(res, '', 'unexpected result')
        }, err => {
          assert(err instanceof Error)
          assert.notEqual(err.message.indexOf('required'), -1)
        })
    )

    it('should validate parameter type', () =>
      context.client.greeting(18)
        .then(res => {
          assert.fail(res, '', 'unexpected result')
        }, err => {
          assert(err instanceof Error)
          assert.notEqual(err.message.indexOf('must be a string'), -1)
        })
    )

    it('should not allows extra parameters', () =>
      context.client.greeting('Jane', 'Peter')
        .then(res => {
          assert.fail(res, '', 'unexpected result')
        }, err => {
          assert(err instanceof Error)
          assert.notEqual(err.message.indexOf('must contain at most'), -1)
        })
    )
  }

  describe('a local client', () => {
    const context = {client: client({
      services,
      serviceOpts: {
        sample: {greetings: ' nice to meet you'}
      }
    })}

    before(() => context.client.init())

    declareTests(context)
  })

  describe('a remote client', () => {
    const context = {client: null}
    let server

    before(() =>
      startServer({
        services,
        serviceOpts: {
          sample: {greetings: ' nice to meet you'}
        }
      })
        .then(serv => {
          server = serv
          context.client = client({
            services,
            remote: server.info.uri
          })
        })
        .then(() => context.client.init())
    )

    after(() => server.stop())

    declareTests(context)
  })

  describe('a remote client without server', () => {
    const remote = client({services, remote: 'http://localhost:1234'})

    before(() => remote.init())

    it('should handle communication errors', () =>
      remote.ping()
        .then(res => {
          assert.fail(res, '', 'unexpected result')
        }, err => {
          assert(err instanceof Error)
          assert.notEqual(err.message.indexOf('ECONNREFUSED'), -1)
        })
    )
  })

  describe('clients with an ordered list of services', () => {
    const initOrder = []
    const orderedServices = Array.from({length: 3}).map((v, i) => ({
      name: `service-${i}`,
      init: opts => new Promise((resolve, reject) => {
        if (opts.fail) return reject(new Error(`service ${i} failed to initialize`))
        initOrder.push(i)
        return resolve()
      })
    }))

    beforeEach(done => {
      initOrder.splice(0, initOrder.length)
      done()
    })

    it('should keep order when registering locally', () =>
      client({services: orderedServices}).init()
        .then(() => assert.deepEqual(initOrder, [0, 1, 2]))
    )

    it('should not stop initialisation at first error', () =>
      client({
        services: orderedServices,
        serviceOpts: {
          'service-1': {fail: true}
        }
      }).init()
        .then(res => {
          assert.fail(res, '', 'unexpected result')
        }, err => {
          assert(err instanceof Error)
          assert.notEqual(err.message.indexOf('service 1 failed to initialize'), -1)
          assert.deepEqual(initOrder, [0])
        })
    )
  })
})

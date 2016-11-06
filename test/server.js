const Lab = require('lab')
const bunyan = require('bunyan')
const assert = require('power-assert')
const request = require('request-promise')
const {startServer} = require('../')
const utils = require('./test-utils')

const lab = exports.lab = Lab.script()
const {describe, it, before, beforeEach, after, afterEach} = lab

const services = [{
  name: 'sample',
  init: require('./fixtures/sample')
}]

describe('service\'s server', () => {

  let started

  before(utils.shutdownLogger)

  after(utils.restoreLogger)

  afterEach(() => {
    if (!started) return Promise.resolve()
    return started.stop()
  })

  it('should start with default port', () =>
    startServer()
      .then(server => server.stop())
  )

  it('should handle configuration error', done => {
    assert.throws(() => startServer({port: -1}), Error)
    done()
  })

  it('should handle start error', () => {
    let first
    // given a started server
    return startServer()
      .then(server => {
        first = server
      })
      // when starting another server on the same port
      .then(() => startServer({port: first.info.port}))
      .then(second => {
        first.stop()
        second.stop()
        assert.fail('', '', 'server shouldn\'t have start')
      }, err => {
        first.stop()
        assert(err instanceof Error)
        assert(err.message.indexOf('EADDRINUSE') >= 0)
      })
  })

  it('should list exposed APIs', () =>
    startServer({name: 'sample', version: '1.0.0', services})
      .then(server =>
        request({
          method: 'GET',
          url: `${server.info.uri}/api/exposed`,
          json: true
        }).then(exposed => {
          assert.deepEqual(exposed, {
            name: 'sample',
            version: '1.0.0',
            apis: [{
              name: 'sample', id: 'ping', path: '/api/sample/ping', params: []
            }, {
              name: 'sample', id: 'greeting', path: '/api/sample/greeting', params: ['name']
            }, {
              name: 'sample', id: 'failing', path: '/api/sample/failing', params: []
            }]
          })
        }).then(() => server.stop())
          .catch(err => {
            server.stop()
            throw err
          })
      )
  )

  describe('given a started server', () => {
    let server

    before(() =>
      startServer({
        name: 'sample',
        version: '1.0.0',
        services
      }).then(s => {
        server = s
      })
    )

    after(done => {
      server.stop()
      done()
    })

    it('should invoke api without argument', () =>
      request({
        method: 'GET',
        url: `${server.info.uri}/api/sample/ping`
      }).then(date => {
        assert(date)
      })
    )

    it('should invoke api with argument', () =>
      request({
        method: 'POST',
        url: `${server.info.uri}/api/sample/greeting`,
        body: {
          name: 'John'
        },
        json: true
      }).then(greetings => {
        assert.equal(greetings, 'Hello John !')
      })
    )

    it('should handle argument validation', () =>
      request({
        method: 'POST',
        url: `${server.info.uri}/api/sample/greeting`,
        body: {
          name: 10
        },
        json: true
      }).then(() => {
        throw new Error('should have failed')
      }, ({error}) => {
        assert(error.message.includes('"name" must be a string'))
        assert.equal(error.statusCode, 400)
      })
    )

    it('should handle api failure', () =>
      request({
        method: 'GET',
        url: `${server.info.uri}/api/sample/failing`
      }).then(() => {
        throw new Error('should have failed')
      }, ({error}) => {
        const err = JSON.parse(error)
        assert.equal(err.statusCode, 599)
        assert.equal(err.message, 'something went really bad')
      })
    )
  })

  describe('server with an ordered list of services', () => {
    const initOrder = []
    const orderedServices = Array.from({length: 3}).map((v, i) => ({
      name: `service-${i}`,
      init: opts => new Promise((resolve, reject) => {
        if (opts.fail) return reject(new Error(`service ${i} failed to initialize`))
        initOrder.push(i)
        opts.logger.warn(`from service ${i}`)
        return resolve()
      })
    }))

    beforeEach(done => {
      initOrder.splice(0, initOrder.length)
      done()
    })

    it('should keep order when registering locally', () =>
      startServer({services: orderedServices})
        .then(server => {
          server.stop()
          assert.deepEqual(initOrder, [0, 1, 2])
        })
    )

    it('should stop initialisation at first error', () =>
      startServer({
        services: orderedServices,
        serviceOpts: {
          'service-1': {fail: true}
        }
      })
        .then(server => {
          server.stop()
          assert.fail('', '', 'server shouln\'t have start')
        }, err => {
          assert(err instanceof Error)
          assert.notEqual(err.message.indexOf('service 1 failed to initialize'), -1)
          assert.deepEqual(initOrder, [0])
        })
    )

    it('should ignore services that doesn\'t expose an object', () =>
      startServer({
        services: [{
          name: 'init-string',
          init: () => Promise.resolve('initialized')
        }, {
          name: 'init-boolean',
          init: () => Promise.resolve(true)
        }, {
          name: 'init-array',
          init: () => Promise.resolve([{worked: true}])
        }, {
          name: 'init-empty',
          init: () => Promise.resolve(null)
        }].concat(orderedServices)
      }).then(server => {
        server.stop()
      })
    )

    it('should enforce service name', () =>
      startServer({
        services: [{
          init: () => Promise.resolve('initialized')
        }]
      }).then(server => {
        server.stop()
        throw new Error('should have failed')
      }, err => {
        assert.ok(err instanceof Error)
        assert.notEqual(err.message.indexOf('"name" is required'), -1)
      })
    )

    it('should enforce service init function', () =>
      startServer({
        services: [{
          name: 'test'
        }]
      }).then(server => {
        server.stop()
        throw new Error('should have failed')
      }, err => {
        assert.ok(err instanceof Error)
        assert.notEqual(err.message.indexOf('"init" is required'), -1)
      })
    )

    it('should check that service init function returns a Promise', () =>
      startServer({
        services: [{
          name: 'test',
          init: () => ({test: true})
        }]
      }).then(server => {
        server.stop()
        throw new Error('should have failed')
      }, err => {
        assert.ok(err instanceof Error)
        assert.notEqual(err.message.indexOf('didn\'t returned a promise'), -1)
      })
    )

    it('should expose logger to services', () => {
      const logs = []
      const logger = bunyan.createLogger({name: 'test'})
      logger.warn = msg => logs.push(msg)
      return startServer({
        logger,
        services: orderedServices
      }).then(server => {
        server.stop()
        assert.deepEqual(logs, ['from service 0', 'from service 1', 'from service 2'])
      })
    })
  })
})

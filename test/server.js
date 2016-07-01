const Lab = require('lab')
const assert = require('power-assert')
const startServer = require('../lib/server')
const utils = require('./utils')

const lab = exports.lab = Lab.script()
const {describe, it, before, beforeEach, after} = lab

describe('service\'s server', () => {

  before(utils.shutdownLogger)

  after(utils.restoreLogger)

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
      .then(res => {
        first.stop()
        assert.fail(res, '', 'unexpected result')
      }, err => {
        first.stop()
        assert(err instanceof Error)
        assert(err.message.indexOf('EADDRINUSE') >= 0)
      })
  })

  describe('server with an ordered list of services', () => {
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
      startServer({services: orderedServices})
        .then(server => {
          server.stop()
          assert.deepEqual(initOrder, [0, 1, 2])
        })
    )

    it('should not stop initialisation at first error', () =>
      startServer({
        services: orderedServices,
        serviceOpts: {
          'service-1': {fail: true}
        }
      })
        .then(server => {
          server.stop()
          assert.fail('', '', 'server shouln\'t have started')
        }, err => {
          assert(err instanceof Error)
          assert.notEqual(err.message.indexOf('service 1 failed to initialize'), -1)
          assert.deepEqual(initOrder, [0])
        })
    )
  })
})

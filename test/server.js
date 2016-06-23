const Lab = require('lab')
const assert = require('power-assert')
const startServer = require('../lib/server')
const utils = require('./utils')

const lab = exports.lab = Lab.script()
const {describe, it, before, after} = lab

const services = [{
  name: 'sample',
  init: require('./fixtures/sample')
}]

describe('service\'s server', () => {

  before(utils.shutdownLogger)

  after(utils.restoreLogger)

  it('should start with default port', () =>
    startServer(services)
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
      .then(() => startServer([], {port: first.info.port}))
      .then(res => {
        first.stop()
        assert.fail(res, '', 'unexpected result')
      }, err => {
        first.stop()
        assert(err instanceof Error)
        assert(err.message.indexOf('EADDRINUSE') >= 0)
      })
  })
})

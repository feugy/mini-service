const Lab = require('lab')
const bunyan = require('bunyan')
const assert = require('power-assert')
const request = require('request-promise')
const {startServer} = require('../')
const utils = require('./test-utils')

const lab = exports.lab = Lab.script()
const {describe, it, before, beforeEach, after, afterEach} = lab

describe('service\'s server', () => {

  let started
  const name = 'test-server'
  const version = '1.0.0'
  const groups = [{
    name: 'sample',
    init: require('./fixtures/sample')
  }]
  const init = () => Promise.resolve({})

  before(utils.shutdownLogger)

  after(utils.restoreLogger)

  afterEach(() => {
    if (!started) return Promise.resolve()
    return started.stop()
  })

  it('should start with default port', () =>
    startServer({name, version, init})
      .then(server => server.stop())
  )

  it('should handle configuration error', done => {
    assert.throws(() => startServer({name, version, init, port: -1}), /"port" must be larger than or equal to 0/)
    done()
  })

  it('should handle missing name', done => {
    assert.throws(() => startServer({version, init}), /"name" and "version" options/)
    done()
  })

  it('should handle missing version', done => {
    assert.throws(() => startServer({name, init}), /"name" and "version" options/)
    done()
  })

  it('should handle wrong validation object', () =>
    startServer(require('./fixtures/invalid-schema'))
      .then(() => {
        throw new Error('should have failed')
      }, error => {
        assert(error)
        assert(error.message.includes('validation schema for API invalidValidator (from group invalid-schema)'))
        assert(error.message.includes('Invalid schema content'))
      })
  )

  it('should handle start error', () => {
    let first
    // given a started server
    return startServer({name, version, init})
      .then(server => {
        first = server
      })
      // when starting another server on the same port
      .then(() => startServer({name, version, init, port: first.info.port}))
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
    startServer({name, version, groups})
      .then(server =>
        request({
          method: 'GET',
          url: `${server.info.uri}/api/exposed`,
          json: true
        }).then(exposed => {
          assert.deepEqual(exposed, {
            name,
            version,
            apis: [{
              group: 'sample', id: 'ping', path: '/api/sample/ping', params: []
            }, {
              group: 'sample', id: 'greeting', path: '/api/sample/greeting', params: ['name']
            }, {
              group: 'sample', id: 'failing', path: '/api/sample/failing', params: []
            }, {
              group: 'sample', id: 'errored', path: '/api/sample/errored', params: []
            }, {
              group: 'sample', id: 'notCompliant', path: '/api/sample/notCompliant', params: []
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
      startServer({name, version, groups}).then(s => {
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
        assert(error.message.includes('Incorrect parameters for API greeting'))
        assert(error.message.includes('"name" must be a string'))
        assert.equal(error.statusCode, 400)
      })
    )

    it('should handle api asynchronous failure', () =>
      request({
        method: 'GET',
        url: `${server.info.uri}/api/sample/failing`
      }).then(() => {
        throw new Error('should have failed')
      }, ({error}) => {
        const err = JSON.parse(error)
        assert.equal(err.statusCode, 599)
        assert(err.message.includes('Error while calling API failing'))
        assert(err.message.includes('something went really bad'))
      })
    )

    it('should handle api synchronous failure', () =>
      request({
        method: 'GET',
        url: `${server.info.uri}/api/sample/errored`
      }).then(() => {
        throw new Error('should have failed')
      }, ({error}) => {
        const err = JSON.parse(error)
        assert.equal(err.statusCode, 599)
        assert(err.message.includes('Error while calling API errored'))
        assert(err.message.includes('errored API'))
      })
    )

    it('should handle not compliant failure', () =>
      request({
        method: 'GET',
        url: `${server.info.uri}/api/sample/notCompliant`
      }).then(() => {
        throw new Error('should have failed')
      }, ({error}) => {
        const err = JSON.parse(error)
        assert.equal(err.statusCode, 599)
        assert(err.message.includes('Error while calling API notCompliant'))
        assert(err.message.includes('.then is not a function'))
      })
    )
  })

  describe('server with an ordered list of groups', () => {
    const initOrder = []
    const ordered = Array.from({length: 3}).map((v, i) => ({
      name: `group-${i}`,
      init: opts => new Promise((resolve, reject) => {
        if (opts.fail) return reject(new Error(`group ${i} failed to initialize`))
        initOrder.push(i)
        opts.logger.warn(`from group ${i}`)
        return resolve()
      })
    }))

    beforeEach(done => {
      initOrder.splice(0, initOrder.length)
      done()
    })

    it('should keep order when registering locally', () =>
      startServer({name, version, groups: ordered})
        .then(server => {
          server.stop()
          assert.deepEqual(initOrder, [0, 1, 2])
        })
    )

    it('should stop initialisation at first error', () =>
      startServer({
        name,
        version,
        groups: ordered,
        groupOpts: {
          'group-1': {fail: true}
        }
      })
        .then(server => {
          server.stop()
          assert.fail('', '', 'server shouln\'t have start')
        }, err => {
          assert(err instanceof Error)
          assert.notEqual(err.message.indexOf('group 1 failed to initialize'), -1)
          assert.deepEqual(initOrder, [0])
        })
    )

    it('should ignore groups that doesn\'t expose an object', () =>
      startServer({
        name,
        version,
        groups: [{
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
        }].concat(ordered)
      }).then(server => {
        server.stop()
      })
    )

    it('should enforce group name', () =>
      startServer({
        name,
        version,
        groups: [{
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

    it('should enforce group init function', () =>
      startServer({
        name,
        version,
        groups: [{
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

    it('should check that group init function returns a Promise', () =>
      startServer({
        name,
        version,
        groups: [{
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

    it('should expose logger to groups', () => {
      const logs = []
      const logger = bunyan.createLogger({name: 'test'})
      logger.warn = msg => logs.push(msg)
      return startServer({
        name,
        version,
        logger,
        groups: ordered
      }).then(server => {
        server.stop()
        assert.deepEqual(logs, ['from group 0', 'from group 1', 'from group 2'])
      })
    })
  })
})

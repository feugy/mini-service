const Lab = require('lab')
const bunyan = require('bunyan')
const assert = require('power-assert')
const request = require('request-promise')
const crc32 = require('crc32')
const {checksumHeader} = require('mini-service-utils')
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
  }, {
    name: 'synchronous',
    init: require('./fixtures/synchronous')
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

  describe('given a started server', () => {
    let server
    const exposedApis = [{
      group: 'sample', id: 'ping', params: [], path: '/api/sample/ping'
    }, {
      group: 'sample', id: 'greeting', params: ['name'], path: '/api/sample/greeting'
    }, {
      group: 'sample', id: 'failing', params: [], path: '/api/sample/failing'
    }, {
      group: 'sample', id: 'errored', params: [], path: '/api/sample/errored'
    }, {
      group: 'sample', id: 'getUndefined', params: [], path: '/api/sample/getUndefined'
    }, {
      group: 'sample', id: 'boomError', params: [], path: '/api/sample/boomError'
    }, {
      group: 'synchronous', id: 'greeting', params: ['name'], path: '/api/synchronous/greeting'
    }, {
      group: 'synchronous', id: 'getUndefined', params: [], path: '/api/synchronous/getUndefined'
    }, {
      group: 'synchronous', id: 'boomError', params: [], path: '/api/synchronous/boomError'
    }]
    const checksum = crc32(JSON.stringify(exposedApis))

    before(() =>
      startServer({name, version, groups}).then(s => {
        server = s
      })
    )

    after(done => {
      server.stop()
      done()
    })

    it('should list exposed APIs', () =>
      request({
        method: 'GET',
        url: `${server.info.uri}/api/exposed`,
        json: true
      }).then(exposed => {
        assert.deepEqual(exposed, {
          name,
          version,
          apis: exposedApis
        })
      })
    )

    it('should include CRC32 as header', () =>
      request({
        method: 'GET',
        url: `${server.info.uri}/api/sample/ping`,
        json: true,
        resolveWithFullResponse: true
      }).then(response1 => {
        assert(checksum === response1.headers[checksumHeader])
        return request({
          method: 'POST',
          url: `${server.info.uri}/api/sample/greeting`,
          body: {
            name: 'John'
          },
          json: true,
          resolveWithFullResponse: true
        }).then(response2 => {
          assert(checksum === response2.headers['x-service-crc'])
        })
      })
    )

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
        assert(greetings === 'Hello John !')
        return request({
          method: 'POST',
          url: `${server.info.uri}/api/synchronous/greeting`,
          body: {
            name: 'John'
          },
          json: true
        })
      }).then(greetings => {
        assert(greetings === 'Hello John !')
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
        assert(error.statusCode === 400)
        return request({
          method: 'POST',
          url: `${server.info.uri}/api/sample/greeting`,
          body: {
            name: 10
          },
          json: true
        })
      }).then(() => {
        throw new Error('should have failed')
      }, ({error}) => {
        assert(error.message.includes('Incorrect parameters for API greeting'))
        assert(error.message.includes('"name" must be a string'))
        assert(error.statusCode === 400)
      })
    )

    it('should handle undefined results', () =>
      request({
        method: 'GET',
        url: `${server.info.uri}/api/sample/getUndefined`,
        json: true
      }).then(result => {
        assert(result === undefined)
        return request({
          method: 'GET',
          url: `${server.info.uri}/api/sample/getUndefined`,
          json: true
        })
      }).then(result => {
        assert(result === undefined)
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
        assert(err.statusCode === 599)
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
        assert(err.statusCode === 599)
        assert(err.message.includes('Error while calling API errored'))
        assert(err.message.includes('errored API'))
      })
    )

    it('should propagate Boom errors', () =>
      request({
        method: 'GET',
        url: `${server.info.uri}/api/sample/boomError`
      }).then(() => {
        throw new Error('should have failed')
      }, ({error}) => {
        const err = JSON.parse(error)
        assert(err.statusCode === 401)
        assert(err.message.includes('Custom authorization error'))
        return request({
          method: 'GET',
          url: `${server.info.uri}/api/sample/boomError`
        })
      }).then(() => {
        throw new Error('should have failed')
      }, ({error}) => {
        const err = JSON.parse(error)
        assert(err.statusCode === 401)
        assert(err.message.includes('Custom authorization error'))
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
          assert(err.message.includes('group 1 failed to initialize'))
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
        assert(err.message.indexOf('"name" is required') !== -1)
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
        assert(err.message.includes('"init" is required'))
      })
    )

    it('should manage init function not returning Promise', () =>
      startServer({
        name,
        version,
        groups: [{
          name: 'test',
          init: () => ({test: () => 'test'})
        }]
      }).then(server => {
        server.stop()
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

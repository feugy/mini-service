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
  const init = async () => ({})

  before(utils.shutdownLogger)

  after(utils.restoreLogger)

  afterEach(async () => {
    if (!started) return
    await started.stop()
  })

  it('should start with default port', async () => {
    const server = await startServer({name, version, init})
    await server.stop()
  })

  it('should handle configuration error', async () => {
    try {
      await startServer({name, version, init, port: -1})
    } catch (err) {
      assert(err instanceof Error)
      assert(err.message.includes('"port" must be larger than or equal to 0'))
      return
    }
    throw new Error('should have failed')
  })

  it('should handle missing name', async () => {
    try {
      await startServer({version, init})
    } catch (err) {
      assert(err instanceof Error)
      assert(err.message.includes('"name" and "version" options'))
      return
    }
    throw new Error('should have failed')
  })

  it('should handle missing version', async () => {
    try {
      await startServer({name, init})
    } catch (err) {
      assert(err instanceof Error)
      assert(err.message.includes('"name" and "version" options'))
      return
    }
    throw new Error('should have failed')
  })

  it('should handle wrong validation object', async () => {
    try {
      await startServer(require('./fixtures/invalid-schema'))
    } catch (err) {
      assert(err instanceof Error)
      assert(err.message.includes('validation schema for API invalidValidator (from group invalid-schema)'))
      assert(err.message.includes('Invalid schema content'))
      return
    }
    throw new Error('should have failed')
  })

  it('should handle start error', async () => {
    let err
    // given a started server
    const first = await startServer({name, version, init})
    // when starting another server on the same port
    try {
      const second = await startServer({name, version, init, port: first.info.port})
      await second.stop()
    } catch (threw) {
      err = threw
    }
    await first.stop()
    assert(err instanceof Error)
    assert(err.message.indexOf('EADDRINUSE') >= 0)
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
      group: 'sample', id: 'withExoticParameters', params: ['param1', 'param2', 'other'], path: '/api/sample/withExoticParameters'
    }, {
      group: 'synchronous', id: 'greeting', params: ['name'], path: '/api/synchronous/greeting'
    }, {
      group: 'synchronous', id: 'getUndefined', params: [], path: '/api/synchronous/getUndefined'
    }, {
      group: 'synchronous', id: 'boomError', params: [], path: '/api/synchronous/boomError'
    }, {
      group: 'synchronous', id: 'withExoticParameters', params: ['param1', 'param2', 'other'], path: '/api/synchronous/withExoticParameters'
    }]
    const checksum = crc32(JSON.stringify(exposedApis))

    before(async () => {
      server = await startServer({name, version, groups, openApi: {}})
    })

    after(async () => server.stop())

    it('should list exposed APIs', async () =>
      assert.deepEqual(await request({
        method: 'GET',
        url: `${server.info.uri}/api/exposed`,
        json: true
      }), {
        name,
        version,
        apis: exposedApis
      })
    )

    it('should expose documentation', async () =>
      assert((await request({
        method: 'GET',
        url: `${server.info.uri}/documentation`
      })).includes('/swaggerui/swagger-ui.js'))
    )

    it('should expose openApi descriptor', async () => {
      const descriptor = await request({
        method: 'GET',
        url: `${server.info.uri}/swagger.json`,
        json: true
      })
      assert(descriptor.swagger === '2.0')
      assert(descriptor.basePath === '/api')
      assert.deepStrictEqual(descriptor.info, {title: 'API documentation', version})
    })

    it('should include CRC32 as header for API without parameter', async () => {
      const response = await request({
        method: 'GET',
        url: `${server.info.uri}/api/sample/ping`,
        json: true,
        resolveWithFullResponse: true
      })
      assert(checksum === response.headers[checksumHeader])
    })

    it('should include CRC32 as header for API with parameters', async () => {
      const response = await request({
        method: 'POST',
        url: `${server.info.uri}/api/sample/greeting`,
        body: {
          name: 'John'
        },
        json: true,
        resolveWithFullResponse: true
      })
      assert(checksum === response.headers['x-service-crc'])
    })

    it('should invoke API without argument', async () =>
      assert(await request({
        method: 'GET',
        url: `${server.info.uri}/api/sample/ping`
      }))
    )

    it('should invoke async API with argument', async () => {
      const greetings = await request({
        method: 'POST',
        url: `${server.info.uri}/api/sample/greeting`,
        body: {
          name: 'John'
        },
        json: true
      })
      assert(greetings === 'Hello John !')
    })

    it('should invoke sync API with argument', async () => {
      const greetings = await request({
        method: 'POST',
        url: `${server.info.uri}/api/synchronous/greeting`,
        body: {
          name: 'John'
        },
        json: true
      })
      assert(greetings === 'Hello John !')
    })

    it('should handle argument validation for async API', async () => {
      try {
        await request({
          method: 'POST',
          url: `${server.info.uri}/api/sample/greeting`,
          body: {
            name: 10
          },
          json: true
        })
      } catch ({error}) {
        assert(error.message.includes('Incorrect parameters for API greeting'))
        assert(error.message.includes('"name" must be a string'))
        assert(error.error === 'Bad Request')
        assert(error.statusCode === 400)
        return
      }
      throw new Error('should have failed')
    })

    it('should handle argument validation for async API', async () => {
      try {
        await request({
          method: 'POST',
          url: `${server.info.uri}/api/synchronous/greeting`,
          body: {
            name: 10
          },
          json: true
        })
      } catch ({error}) {
        assert(error.message.includes('Incorrect parameters for API greeting'))
        assert(error.message.includes('"name" must be a string'))
        assert(error.error === 'Bad Request')
        assert(error.statusCode === 400)
        return
      }
      throw new Error('should have failed')
    })

    it('should handle response validation for async API', async () => {
      let res
      try {
        res = await request({
          method: 'POST',
          url: `${server.info.uri}/api/sample/greeting`,
          body: {
            name: 'boom'
          },
          json: true
        })
      } catch ({error}) {
        assert(error.message.includes('Incorrect response for API greeting'))
        assert(error.message.includes('"greetingResult" must be a string'))
        assert(error.error === 'Bad Response')
        assert(error.statusCode === 512)
        return
      }
      throw new Error(`unexpected result: ${JSON.stringify(res, null, 2)}`)
    })

    it('should handle response validation for sync API', async () => {
      let res
      try {
        res = await request({
          method: 'POST',
          url: `${server.info.uri}/api/synchronous/greeting`,
          body: {
            name: 'boom'
          },
          json: true
        })
      } catch ({error}) {
        assert(error.error === 'Bad Response')
        assert(error.message.includes('Incorrect response for API greeting'))
        assert(error.message.includes('"greetingResult" must be a string'))
        assert(error.statusCode === 512)
        return
      }
      throw new Error(`unexpected result: ${JSON.stringify(res, null, 2)}`)
    })

    it('should handle undefined results from async API', async () => {
      const result = await request({
        method: 'GET',
        url: `${server.info.uri}/api/sample/getUndefined`,
        json: true
      })
      assert(result === undefined)
    })

    it('should handle undefined results from sync API', async () => {
      const result = await request({
        method: 'GET',
        url: `${server.info.uri}/api/synchronous/getUndefined`,
        json: true
      })
      assert(result === undefined)
    })

    it('should handle API asynchronous failure', async () => {
      try {
        await request({
          method: 'GET',
          url: `${server.info.uri}/api/sample/failing`,
          json: true
        })
      } catch ({error}) {
        assert(error.statusCode === 599)
        assert(error.message.includes('Error while calling API failing'))
        assert(error.message.includes('something went really bad'))
        return
      }
      throw new Error('should have failed')
    })

    it('should handle API synchronous failure', async () => {
      try {
        await request({
          method: 'GET',
          url: `${server.info.uri}/api/sample/errored`,
          json: true
        })
      } catch ({error}) {
        assert(error.statusCode === 599)
        assert(error.message.includes('Error while calling API errored'))
        assert(error.message.includes('errored API'))
        return
      }
      throw new Error('should have failed')
    })

    it('should propagate Boom errors from async API', async () => {
      try {
        await request({
          method: 'GET',
          url: `${server.info.uri}/api/sample/boomError`,
          json: true
        })
      } catch ({error}) {
        assert(error.statusCode === 401)
        assert(error.message.includes('Custom authorization error'))
        return
      }
      throw new Error('should have failed')
    })

    it('should propagate Boom errors from sync API', async () => {
      try {
        await request({
          method: 'GET',
          url: `${server.info.uri}/api/synchronous/boomError`,
          json: true
        })
      } catch ({error}) {
        assert(error.statusCode === 401)
        assert(error.message.includes('Custom authorization error'))
        return
      }
      throw new Error('should have failed')
    })

    it('should handle async API with exotic parameters', async () => {
      const result = await request({
        method: 'POST',
        url: `${server.info.uri}/api/sample/withExoticParameters`,
        body: {
          param1: [1, 2],
          param2: {c: {d: 3}},
          other: 4,
          3: 5, // according to arrayToObj(), param0 is 0, param2 is 1, other is 2.
          4: 6
        },
        json: true
      })
      assert.deepStrictEqual(result, [1, 2, 3, 4, 5, 6])
    })

    it('should handle sync API with exotic parameters', async () => {
      const result = await request({
        method: 'POST',
        url: `${server.info.uri}/api/synchronous/withExoticParameters`,
        body: {
          param1: [1, 2],
          param2: {c: {d: 3}},
          other: 4,
          3: 5, // according to arrayToObj(), param0 is 0, param2 is 1, other is 2.
          4: 6
        },
        json: true
      })
      assert.deepStrictEqual(result, [1, 2, 3, 4, 5, 6])
    })

    it('should not complain about big payload', {timeout: 5e3}, async () => {
      const name = Array.from({length: 1024 * 1024 * 10}, () => 'a').join('')
      const greetings = await request({
        method: 'POST',
        url: `${server.info.uri}/api/sample/greeting`,
        body: {name},
        json: true
      })
      assert(greetings)
    })
  })

  describe('server with an ordered list of groups', () => {
    let server
    const initOrder = []
    const ordered = Array.from({length: 3}).map((v, i) => ({
      name: `group-${i}`,
      init: async opts => {
        if (opts.fail) throw new Error(`group ${i} failed to initialize`)
        initOrder.push(i)
        opts.logger.warn(`from group ${i}`)
      }
    }))

    beforeEach(() => {
      server = null
      initOrder.splice(0, initOrder.length)
    })

    afterEach(async () => {
      if (server) {
        await server.stop()
      }
    })

    it('should keep order when registering locally', async () => {
      server = await startServer({name, version, groups: ordered})
      assert.deepEqual(initOrder, [0, 1, 2])
    })

    it('should stop initialisation at first error', async () => {
      try {
        server = await startServer({
          name,
          version,
          groups: ordered,
          groupOpts: {
            'group-1': {fail: true}
          }
        })
      } catch (err) {
        assert(err instanceof Error)
        assert(err.message.includes('group 1 failed to initialize'))
        assert.deepEqual(initOrder, [0])
        return
      }
      throw new Error('should have failed')
    })

    it('should ignore groups that doesn\'t expose an object', async () => {
      server = await startServer({
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
      })
    })

    it('should enforce group name', async () => {
      try {
        server = await startServer({
          name,
          version,
          groups: [{
            init: () => Promise.resolve('initialized')
          }]
        })
      } catch (err) {
        assert(err instanceof Error)
        assert(err.message.indexOf('"name" is required') !== -1)
        return
      }
      throw new Error('should have failed')
    })

    it('should enforce group init function', async () => {
      try {
        server = await startServer({
          name,
          version,
          groups: [{
            name: 'test'
          }]
        })
      } catch (err) {
        assert(err instanceof Error)
        assert(err.message.includes('"init" is required'))
        return
      }
      throw new Error('should have failed')
    })

    it('should manage init function not returning Promise', async () => {
      server = await startServer({
        name,
        version,
        groups: [{
          name: 'test',
          init: () => ({test: () => 'test'})
        }]
      })
    })

    it('should expose logger to groups', async () => {
      const logs = []
      const logger = bunyan.createLogger({name: 'test'})
      logger.warn = msg => logs.push(msg)
      server = await startServer({
        name,
        version,
        logger,
        groups: ordered
      })
      assert.deepEqual(logs, ['from group 0', 'from group 1', 'from group 2'])
    })
  })
})

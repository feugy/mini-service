const Lab = require('lab')
const bunyan = require('bunyan')
const assert = require('power-assert')
const got = require('got')
const crc32 = require('crc32')
const { checksumHeader } = require('mini-service-utils')
const BufferList = require('bl')
const { expose, validateOpts } = require('../../lib/transports/http')
const utils = require('../test-utils')

const lab = exports.lab = Lab.script()
const { describe, it, before, beforeEach, after, afterEach } = lab

describe('Http transport', () => {
  let started
  const name = 'test-server'
  const version = '1.0.0'
  const groups = [{
    name: 'sample',
    init: require('../fixtures/sample')
  }, {
    name: 'synchronous',
    init: require('../fixtures/synchronous')
  }]
  const init = async () => ({})

  before(utils.shutdownLogger)

  after(utils.restoreLogger)

  afterEach(async () => {
    if (!started) return
    await started.stop()
  })

  it('should start with default port', async () => {
    const server = await expose({ name, version, init, transport: { type: 'http' } })
    await server.stop()
  })

  it('should handle configuration error', async () => {
    try {
      validateOpts({ name, version, init, transport: { type: 'http', port: -1 } })
    } catch (err) {
      assert(err instanceof Error)
      assert(err.message.includes('"port" must be larger than or equal to 0'))
      return
    }
    throw new Error('should have failed')
  })

  it('should handle missing name', async () => {
    try {
      await validateOpts({ version, init, transport: { type: 'http' } })
    } catch (err) {
      assert(err instanceof Error)
      assert(err.message.includes('"name" is required'))
      return
    }
    throw new Error('should have failed')
  })

  it('should handle missing version', async () => {
    try {
      await validateOpts({ name, init, transport: { type: 'http' } })
    } catch (err) {
      assert(err instanceof Error)
      assert(err.message.includes('"version" is required'))
      return
    }
    throw new Error('should have failed')
  })

  it('should handle wrong validation object', async () => {
    try {
      await expose(Object.assign({
        transport: {
          type: 'http'
        }
      }, require('../fixtures/invalid-schema')))
    } catch (err) {
      assert(err instanceof Error)
      assert(err.message.includes('exposed API invalidValidator (from group invalid-schema)'))
      assert(err.message.includes('"validate" must be an array'))
      return
    }
    throw new Error('should have failed')
  })

  it('should handle start error', async () => {
    let err
    // given a started server
    const first = await expose({ name, version, init, transport: { type: 'http' } })
    // when starting another server on the same port
    try {
      const second = await expose({ name, version, init, transport: { type: 'http', port: first.info.port } })
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
      group: 'sample',
      id: 'ping',
      params: [],
      path: '/api/sample/ping',
      hasBufferInput: false,
      hasStreamInput: false
    }, {
      group: 'sample',
      id: 'greeting',
      params: ['name'],
      path: '/api/sample/greeting',
      hasBufferInput: false,
      hasStreamInput: false
    }, {
      group: 'sample',
      id: 'failing',
      params: [],
      path: '/api/sample/failing',
      hasBufferInput: false,
      hasStreamInput: false
    }, {
      group: 'sample',
      id: 'errored',
      params: [],
      path: '/api/sample/errored',
      hasBufferInput: false,
      hasStreamInput: false
    }, {
      group: 'sample',
      id: 'getUndefined',
      params: [],
      path: '/api/sample/getUndefined',
      hasBufferInput: false,
      hasStreamInput: false
    }, {
      group: 'sample',
      id: 'boomError',
      params: [],
      path: '/api/sample/boomError',
      hasBufferInput: false,
      hasStreamInput: false
    }, {
      group: 'sample',
      id: 'withExoticParameters',
      params: ['param1', 'param2', 'other'],
      path: '/api/sample/withExoticParameters',
      hasBufferInput: false,
      hasStreamInput: false
    }, {
      group: 'sample',
      id: 'bufferHandling',
      params: ['buffer'],
      path: '/api/sample/bufferHandling',
      hasBufferInput: true,
      hasStreamInput: false
    }, {
      group: 'sample',
      id: 'streamHandling',
      params: ['stream'],
      path: '/api/sample/streamHandling',
      hasBufferInput: false,
      hasStreamInput: true
    }, {
      group: 'synchronous',
      id: 'greeting',
      params: ['name'],
      path: '/api/synchronous/greeting',
      hasBufferInput: false,
      hasStreamInput: false
    }, {
      group: 'synchronous',
      id: 'getUndefined',
      params: [],
      path: '/api/synchronous/getUndefined',
      hasBufferInput: false,
      hasStreamInput: false
    }, {
      group: 'synchronous',
      id: 'boomError',
      params: [],
      path: '/api/synchronous/boomError',
      hasBufferInput: false,
      hasStreamInput: false
    }, {
      group: 'synchronous',
      id: 'withExoticParameters',
      params: ['param1', 'param2', 'other'],
      path: '/api/synchronous/withExoticParameters',
      hasBufferInput: false,
      hasStreamInput: false
    }]
    const checksum = crc32(JSON.stringify(exposedApis))

    before(async () => {
      server = await expose({ name, version, groups, transport: { type: 'http', openApi: {} } })
    })

    after(async () => server.stop())

    it('should list exposed APIs', async () => {
      const { body: exposed } = await got.get(`${server.info.uri}/api/exposed`, {
        json: true
      })
      assert.deepStrictEqual(exposed, {
        name,
        version,
        apis: exposedApis
      })
    })

    it('should expose documentation', async () =>
      assert((await got.get(`${server.info.uri}/documentation`)).body.includes('/swaggerui/swagger-ui.js'))
    )

    it('should expose openApi descriptor', async () => {
      const { body: descriptor } = await got.get(`${server.info.uri}/swagger.json`, {
        json: true
      })
      assert(descriptor.swagger === '2.0')
      assert(descriptor.basePath === '/api')
      assert.deepStrictEqual(descriptor.info, { title: 'API documentation', version })
    })

    it('should include CRC32 as header for API without parameter', async () => {
      const { headers } = await got.get(`${server.info.uri}/api/sample/ping`)
      assert(checksum === headers[checksumHeader])
    })

    it('should include CRC32 as header for API with parameters', async () => {
      const { headers } = await got.post(`${server.info.uri}/api/sample/greeting`, {
        body: JSON.stringify({ name: 'John' })
      })
      assert(headers['x-service-crc'] === checksum)
    })

    it('should invoke API without argument', async () => {
      const { body: { time } } = await got.get(`${server.info.uri}/api/sample/ping`, {
        json: true
      })
      assert(typeof time === 'string')
    })

    it('should invoke async API with argument', async () => {
      const { body: greetings } = await got.post(`${server.info.uri}/api/sample/greeting`, {
        body: JSON.stringify({ name: 'John' })
      })
      assert(greetings === 'Hello John !')
    })

    it('should invoke sync API with argument', async () => {
      const { body: greetings } = await got.post(`${server.info.uri}/api/synchronous/greeting`, {
        body: JSON.stringify({ name: 'John' })
      })
      assert(greetings === 'Hello John !')
    })

    it('should handle argument validation for async API', async () => {
      try {
        await got.post(`${server.info.uri}/api/sample/greeting`, {
          body: {
            name: 10
          },
          json: true
        })
      } catch (error) {
        assert(error.statusMessage === 'Bad Request')
        assert(error.statusCode === 400)
        assert(error.response.body.message.includes('Incorrect parameters for API greeting'))
        assert(error.response.body.message.includes('"name" must be a string'))
        return
      }
      throw new Error('should have failed')
    })

    it('should handle argument validation for sync API', async () => {
      try {
        await got.post(`${server.info.uri}/api/synchronous/greeting`, {
          body: {
            name: 10
          },
          json: true
        })
      } catch (error) {
        assert(error.statusMessage === 'Bad Request')
        assert(error.statusCode === 400)
        assert(error.response.body.message.includes('Incorrect parameters for API greeting'))
        assert(error.response.body.message.includes('"name" must be a string'))
        return
      }
      throw new Error('should have failed')
    })

    it('should handle response validation for async API', async () => {
      let res
      try {
        res = await got.post(`${server.info.uri}/api/sample/greeting`, {
          body: {
            name: 'boom'
          },
          json: true
        })
      } catch (error) {
        assert(error.statusCode === 512)
        assert(error.response.body.error === 'Bad Response')
        assert(error.response.body.message.includes('Incorrect response for API greeting'))
        assert(error.response.body.message.includes('"greetingResult" must be a string'))
        return
      }
      throw new Error(`unexpected result: ${JSON.stringify(res, null, 2)}`)
    })

    it('should handle response validation for sync API', async () => {
      let res
      try {
        res = await got.post(`${server.info.uri}/api/synchronous/greeting`, {
          body: {
            name: 'boom'
          },
          json: true
        })
      } catch (error) {
        assert(error.statusCode === 512)
        assert(error.response.body.error === 'Bad Response')
        assert(error.response.body.message.includes('Incorrect response for API greeting'))
        assert(error.response.body.message.includes('"greetingResult" must be a string'))
        return
      }
      throw new Error(`unexpected result: ${JSON.stringify(res, null, 2)}`)
    })

    it('should handle undefined results from async API', async () => {
      const { headers } = await got.get(`${server.info.uri}/api/sample/getUndefined`)
      assert(+headers['content-length'] === 0)
    })

    it('should handle undefined results from sync API', async () => {
      const { headers } = await got.get(`${server.info.uri}/api/synchronous/getUndefined`)
      assert(+headers['content-length'] === 0)
    })

    it('should handle API asynchronous failure', async () => {
      try {
        await got.get(`${server.info.uri}/api/sample/failing`, {
          json: true
        })
      } catch (error) {
        assert(error.statusCode === 599)
        assert(error.response.body.message.includes('Error while calling API failing'))
        assert(error.response.body.message.includes('something went really bad'))
        return
      }
      throw new Error('should have failed')
    })

    it('should handle API synchronous failure', async () => {
      try {
        await got.get(`${server.info.uri}/api/sample/errored`, {
          json: true
        })
      } catch (error) {
        assert(error.statusCode === 599)
        assert(error.response.body.message.includes('Error while calling API errored'))
        assert(error.response.body.message.includes('errored API'))
        return
      }
      throw new Error('should have failed')
    })

    it('should propagate Boom errors from async API', async () => {
      try {
        await got.get(`${server.info.uri}/api/sample/boomError`, {
          json: true
        })
      } catch (error) {
        assert(error.statusCode === 401)
        assert(error.response.body.message.includes('Custom authorization error'))
        return
      }
      throw new Error('should have failed')
    })

    it('should propagate Boom errors from sync API', async () => {
      try {
        await got.get(`${server.info.uri}/api/synchronous/boomError`, {
          json: true
        })
      } catch (error) {
        assert(error.statusCode === 401)
        assert(error.response.body.message.includes('Custom authorization error'))
        return
      }
      throw new Error('should have failed')
    })

    it('should handle async API with exotic parameters', async () => {
      const { body: result } = await got.post(`${server.info.uri}/api/sample/withExoticParameters`, {
        body: {
          param1: [1, 2],
          param2: { c: { d: 3 } },
          other: 4,
          3: 5, // according to arrayToObj(), param0 is 0, param2 is 1, other is 2.
          4: 6
        },
        json: true
      })
      assert.deepStrictEqual(result, [1, 2, 3, 4, 5, 6])
    })

    it('should handle sync API with exotic parameters', async () => {
      const { body: result } = await got.post(`${server.info.uri}/api/synchronous/withExoticParameters`, {
        body: {
          param1: [1, 2],
          param2: { c: { d: 3 } },
          other: 4,
          3: 5, // according to arrayToObj(), param0 is 0, param2 is 1, other is 2.
          4: 6
        },
        json: true
      })
      assert.deepStrictEqual(result, [1, 2, 3, 4, 5, 6])
    })

    it('should not complain about big payload', { timeout: 5e3 }, async () => {
      const { body: greetings } = await got.post(`${server.info.uri}/api/sample/greeting`, {
        body: `{"name":"${Array.from({ length: 1024 * 1024 * 10 }, () => 'a').join('')}"}`
      })
      assert(greetings)
    })

    it('should send and receive buffers', async () => {
      const { headers, body } = await got.post(`${server.info.uri}/api/sample/bufferHandling`, {
        body: Buffer.from(new Uint8Array([1, 2]))
      })
      assert(headers['content-type'] === 'application/octet-stream')
      assert(headers['x-service-crc'] === checksum)
      const result = Buffer.from(body)
      assert(Buffer.compare(result, Buffer.from(new Uint8Array([1, 2, 3, 4]))) === 0)
    })

    it('should send and receive streams', async () => {
      const { response, result } = await new Promise((resolve, reject) => {
        let response
        const output = new BufferList()
        const input = new BufferList()

        input.pipe(
          got.stream(`${server.info.uri}/api/sample/streamHandling`, { method: 'post' })
            .on('response', r => { response = r })
            .on('error', reject)
        )
          .pipe(output)
          .on('error', reject)
          .on('finish', () => {
            resolve({ response, result: output.toString() })
          })

        input.append('here is the message body', 'utf8')
      })
      assert(result === 'here is a prefix -- here is the message body')
      assert(response.headers['x-service-crc'] === checksum)
      assert(response.headers['transfer-encoding'] === 'chunked')
      assert(!response.headers['content-type'])
    })
  })

  describe('server with an ordered list of groups', () => {
    let server
    const initOrder = []
    const ordered = Array.from({ length: 3 }).map((v, i) => ({
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
      server = await expose({ name, version, groups: ordered, transport: { type: 'http' } })
      assert.deepEqual(initOrder, [0, 1, 2])
    })

    it('should stop initialisation at first error', async () => {
      try {
        server = await expose({
          name,
          version,
          groups: ordered,
          groupOpts: {
            'group-1': { fail: true }
          },
          transport: { type: 'http' }
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
      server = await expose({
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
          init: () => Promise.resolve([{ worked: true }])
        }, {
          name: 'init-empty',
          init: () => Promise.resolve(null)
        }].concat(ordered),
        transport: { type: 'http' }
      })
    })

    it('should enforce group name', async () => {
      try {
        server = await expose({
          name,
          version,
          groups: [{
            init: () => Promise.resolve('initialized')
          }],
          transport: { type: 'http' }
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
        server = await expose({
          name,
          version,
          groups: [{
            name: 'test'
          }],
          transport: { type: 'http' }
        })
      } catch (err) {
        assert(err instanceof Error)
        assert(err.message.includes('"init" is required'))
        return
      }
      throw new Error('should have failed')
    })

    it('should manage init function not returning Promise', async () => {
      server = await expose({
        name,
        version,
        groups: [{
          name: 'test',
          init: () => ({ test: () => 'test' })
        }],
        transport: { type: 'http' }
      })
    })

    it('should expose logger to groups', async () => {
      const logs = []
      const logger = bunyan.createLogger({ name: 'test' })
      logger.warn = msg => logs.push(msg)
      server = await expose({
        name,
        version,
        logger,
        groups: ordered,
        transport: { type: 'http' }
      })
      assert.deepEqual(logs, ['from group 0', 'from group 1', 'from group 2'])
    })
  })
})

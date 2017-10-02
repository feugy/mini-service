const {Server} = require('hapi')
const joi = require('joi')
const boom = require('boom')
const crc32 = require('crc32')
const {
  arrayToObj,
  checksumHeader,
  extractGroups,
  getLogger,
  getParamNames,
  isApi,
  validateParams
} = require('mini-service-utils')

/**
 * @module server
 */

/**
 * @private
 * @summary Write error in HTTP response
 * @description If error is a Boom error, writes it as is. Otherwise, wrapps it into a 599 Boom error
 * @param {string}   id     exposed api id
 * @param {Function} reply  Hapi response interface
 * @param {Error}    err    processed error
 * @returns {Response}      written Http response
 */
const handleError = (id, reply, err) =>
  reply(err.isBoom ? err : boom.create(599, `Error while calling API ${id}: ${err.message}`))

/**
 * @private
 * @typedef {Object} ExposedAPI
 * @property {String} name            group name
 * @property {String} id              exposed api id
 * @property {Array<String>} exposed  api parameter names
 * @property {String} path            http endpoint full path
 */

/**
 * @private
 * @summary Register all given API groups to an Hapi server
 * @description All groups will be initialized first (order matters) using the given options, at server start.
 * API could be exposed:
 * - directly using `opts.name` & `opts.init`
 * - with groups using `opts.groups` and opts.groupOpts`
 *
 * @param {Hapi} server         in which APIs are exposed as Http endpoints
 * @param {Object} opts         server options, including
 * @param {Function} [opts.init]        initialization function that takes options as parameter and returns
 * a Promise resolved with exposed APIs (an object with functions that returns promises).
 * Takes precedence over `opts.groups` as a simpler alternative of API group.
 * The `opts` object itself will be used as options for this single API group.
 * @param {Array<Object>} [opts.groups] exposed APIs groups, an array containing for each group:
 * @param {String} opts.groups.name       group friendly name (a valid JavaScript identifier)
 * @param {Function} opts.groups.init     initialization function that takes options as parameter and returns
 * a Promise resolved with exposed APIs (an object with functions that returns promises)
 * @param {Object} [opts.groupOpts]     per-group configuration. might contain a properties named after group
 * @param {Object} logger       {@link https://github.com/trentm/node-bunyan|bunyan} compatible logger
 * @returns {Promise<Array<ExposedAPI>>} promise   when all groups have been registered as Hapi plugins,
 * with the list of exposed APIs
 */
const registerAsPlugins = (server, opts, logger) => {
  const exposed = []
  let checksum
  try {
    const {groups, groupOpts} = extractGroups(opts)
    return server.register(
      // all groups will be considered as Hapi plugins
      groups.map(({name: group, init}) => {
        const plugin = {
          register: (serv, pluginOpts, next) =>
            // supports synchronous and asynchonous init
            Promise.resolve(init(Object.assign({logger}, groupOpts[group])))
              .then(apis => {
                if (!isApi(apis)) return
                for (const id in apis) {
                  const api = apis[id]
                  const params = getParamNames(api)
                  const path = `/api/${group}/${id}`
                  const config = {validate: {}}
                  // adds input validation if needed
                  if (api.length && api.validate) {
                    try {
                      const schema = joi.object(arrayToObj(api.validate, params)).unknown(false)
                      // use custom validation instead of Joi schema for a better reporting in case of extra parameters
                      config.validate.payload = (values, validationOpts, done) =>
                        done(validateParams(values, schema, id, params.length))
                    } catch (exc) {
                      throw new Error(`Invalid validation schema for API ${id} (from group ${group}): ${exc.message}`)
                    }
                  }
                  // keep the list of exposed functions
                  exposed.push({group, id, params, path})
                  // publish each API as a POST endpoint
                  serv.route({
                    method: api.length ? 'POST' : 'GET',
                    path,
                    config,
                    handler: (req, reply) => {
                      const payload = req.payload || {}
                      try {
                        // supports both synchronous and asynchronous API
                        Promise.resolve(api(...params.map(prop => payload[prop])))
                          .then(res => reply(res).header(checksumHeader, checksum))
                          .catch(err => handleError(id, reply, err))
                      } catch (exc) {
                        // bubble any synchronous problem (not returning promise...)
                        handleError(id, reply, exc)
                      }
                    }
                  })
                  logger.debug(`API ${path} exposed`)
                }
              })
              .then(next)
              .catch(next)
        }
        plugin.register.attributes = {name: group}
        return plugin
      })
    ).then(() => {
      // compute checksum as the CRC-32 of the exposed API
      checksum = crc32(JSON.stringify(exposed))
      return exposed
    })
  } catch (err) {
    return Promise.reject(err)
  }
}

/**
 * @function startServer
 * @summary Configure and start service in a standalone Hapi Http server
 * @description
 * To start a server with the proper service definition, you can pass:
 * ```
 * {
 *   name: 'service name',
 *   version: '1.0.0',
 *   init: () => {} // init function that expose APIs in a single default group
 *   foo: 'bar' // any option needed in your init function
 * }```
 *
 * Or, if you need to divide exposed APIs in different groups:
 * ```
 * {
 *   name: 'service name',
 *   version: '1.0.0',
 *   groups: [{
 *     name: 'group1'
 *     init: () => {} // init function that expose APIs for group 1
 *   }, {
 *     name: 'group2'
 *     init: () => {} // init function that expose APIs for group 2
 *   }],
 *   groupOpts: {
 *     group1: {
 *       foo: 'bar' // any option needed by group1's init
 *     },
 *     group2: {
 *       foo: 'biz' // options for group2's init
 *     }
 *   }
 * }```
 *
 * All APIs will be exposed as POST or GET `/api/{group}/{api}` endpoints, where:
 *
 * - `group` identifies the API group
 * - `api` is the method name of the exposed API
 *
 * `GET` are used when exposed function doesn't take any parameter, `POST` are used otherwise
 *
 * @param {Object} opts         server options, including
 * @param {String} opts.name            server name
 * @param {String} opts.version         server version
 * @param {Number} [opts.port = 3000]   listening port (use 0 to pick first available port)
 * @param {Object} [opts.logger]        {@link https://github.com/trentm/node-bunyan|bunyan} compatible logger
 * @param {Function} [opts.init]        initialization function that takes options as parameter and returns
 * a Promise resolved with exposed APIs (an object with functions that returns promises).
 * Takes precedence over `opts.groups` as a simpler alternative of API group.
 * The `opts` object itself will be used as options for this single API group.
 * @param {Array<Object>} [opts.groups] exposed APIs groups, an array containing for each group:
 * @param {String} opts.groups.name       group friendly name (a valid JavaScript identifier)
 * @param {Function} opts.groups.init     initialization function that takes options as parameter and returns
 * a Promise resolved with exposed APIs (an object with functions that returns promises)
 * @param {Object} [opts.groupOpts]     per-group configuration. might contain a properties named after group
 * @returns {Promise} promise   resolved with the **started** Hapi server as parameter
 */
module.exports = (opts = {}) => {
  const options = Object.assign({
    port: 3000,
    logger: getLogger()
  }, opts)

  const {port, name, version, logger} = options
  // required name & version
  if (!name || !version) {
    throw new Error('Server needs "name" and "version" options')
  }

  logger.debug({port}, 'Configure server')

  const server = new Server()
  server.connection({port})

  return registerAsPlugins(server, options, logger)
    .then(apis => {
      // list of exposed APIs, for clients
      server.route({
        method: 'GET',
        path: '/api/exposed',
        handler: (req, reply) => reply({
          name,
          version,
          apis
        })
      })
    })
    .then(() => server.start())
    .then(() => {
      logger.info(server.info, 'server started')
      return server
    })
    .catch(err => {
      logger.error(err, 'failed to start server')
      throw err
    })
}

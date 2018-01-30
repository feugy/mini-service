const {Server} = require('hapi')
const joi = require('joi')
const boom = require('boom')
const crc32 = require('crc32')
const {merge} = require('hoek')
const {
  arrayToObj,
  checksumHeader,
  enrichError,
  extractGroups,
  extractValidate,
  getLogger,
  getParamNames,
  isApi
} = require('mini-service-utils')

const basePath = '/api'

/**
 * @typedef {Object} ExposedAPI
 * @private
 * @property {String} name            group name
 * @property {String} id              exposed api id
 * @property {Array<String>} exposed  api parameter names
 * @property {String} path            http endpoint full path
 */

/**
 * Register all given API groups to an Hapi server
 *
 * All groups will be initialized first (order matters) using the given options, at server start.
 * API could be exposed:
 * - directly using `opts.name` & `opts.init`
 * - with groups using `opts.groups` and opts.groupOpts`
 *
 * @async
 * @private
 * @param {Hapi} server         in which APIs are exposed as Http endpoints
 * @param {Object} opts         server options, including
 * @param {Function} [opts.init]        async initialization function that takes options as parameter and
 * resolves with exposed APIs (an object with async functions).
 * Takes precedence over `opts.groups` as a simpler alternative of API group.
 * The `opts` object itself will be used as options for this single API group.
 * @param {Array<Object>} [opts.groups] exposed APIs groups, an array containing for each group:
 * @param {String} opts.groups.name       group friendly name (a valid JavaScript identifier)
 * @param {Function} opts.groups.init     async initialization function that takes options as parameter and
 * resolves with exposed APIs (an object with async functions).
 * @param {Object} [opts.groupOpts]     per-group configuration. might contain a properties named after group
 * @param {Object} logger       {@link https://github.com/trentm/node-bunyan|bunyan} compatible logger
 * @returns {Array<ExposedAPI>} list of exposed APIs
 */
const registerAsPlugins = async (server, opts, logger) => {
  const exposed = []
  let checksum
  const {groups, groupOpts} = extractGroups(opts)
  await server.register(
    // all groups will be considered as Hapi plugins
    groups.map(({name: group, init}) => ({
      register: async (serv, pluginOpts) => {
        // supports synchronous and asynchonous init
        const apis = await init(Object.assign({logger}, groupOpts[group]))
        if (!isApi(apis)) {
          return
        }
        for (const id in apis) {
          const api = apis[id]
          const params = getParamNames(api)
          const path = `${basePath}/${group}/${id}`
          const options = {
            // disabled default 2 minutes timeout
            timeout: {socket: false},
            tags: ['api'],
            // copy documentation keys, if available, for openapi description
            notes: api.notes,
            description: api.description
          }
          // adds input validation if needed
          const payloadSchema = extractValidate(id, apis, groupOpts[group], 'validate')
          if (params.length && payloadSchema) {
            try {
              options.validate = {
                payload: joi.object(arrayToObj(payloadSchema, params)).unknown(false).label(id),
                // customize error message for convenience
                failAction: (req, h, err) => enrichError(err, id)
              }
            } catch (exc) {
              throw new Error(`Invalid validation schema for API ${id} (from group ${group}): ${exc.message}`)
            }
            // disabled payload timeout and set 1Gb max size
            options.payload = {
              timeout: false,
              maxBytes: 1024 * 1024 * 1024
            }
          }
          // adds response validation if needed
          const responseSchema = extractValidate(id, apis, groupOpts[group], 'responseSchema')
          if (responseSchema) {
            options.response = {
              schema: responseSchema.label(`${id}Result`),
              // customize error message for convenience
              failAction: (req, h, err) => enrichError(err, id, false),
              // only apply response validation if explicitly needed
              sample: api.validateResponse ? 100 : 0
            }
          }
          // keep the list of exposed functions
          exposed.push({group, id, params, path})
          // publish each API as a POST endpoint
          serv.route({
            method: params.length ? 'POST' : 'GET',
            path,
            options,
            handler: async (req, h) => {
              const payload = req.payload || {}
              try {
                // supports both synchronous and asynchronous API
                const res = await api(...params.map(prop => payload[prop]))
                return h.response(res).header(checksumHeader, checksum)
              } catch (err) {
                // bubble any synchronous problem (not returning promise...)
                if (!err.isBoom) {
                  throw boom.boomify(err, {statusCode: 599, message: `Error while calling API ${id}: ${err.message}`})
                }
                throw err
              }
            }
          })
          logger.debug(`API ${path} exposed`)
        }
      },
      name: group
    }))
  )
  // compute checksum as the CRC-32 of the exposed API
  checksum = crc32(JSON.stringify(exposed))
  return exposed
}

/**
 * Expose OpenAPI json descriptor and documentation GUI
 *
 * Expose Swagger GUI under `/documentation` and `/swagger.json` file.
 * All options supported by https://github.com/glennjones/hapi-swagger can be used.
 * Can only document routes already registered.
 *
 * @async
 * @private
 * @param {Hapi} server                   for which documentation is created and exposed
 * @param {Object} opts                   hapi-swagger options, with following defaults:
 * @param {Object} [opts.info]              global informations, including
 * @param {String} [opts.info.version]        API version, same as service version
 * @param {String} [opts.documentationPath] path for GUI, defaults to /documentation
 * @param {String} [opts.jsonPath]          path for json descriptor, defaults to /swagger.json
 * @param {String} [opts.basePath]          endpoint base path, defaults to /api
 * @param {Number} [opts.pathPrefixSize]    number of segment used for grouping, defaults to 2
 * @param {String} version                server version
 * @param {Object} logger                 {@link https://github.com/trentm/node-bunyan|bunyan} compatible logger
 */
const exposeDocumentation = async (server, opts, version, logger) => {
  await server.register([
    require('inert'),
    require('vision'),
    {
      plugin: require('hapi-swagger'),
      options: merge({
        info: {version},
        documentationPath: '/documentation',
        jsonPath: '/swagger.json',
        basePath,
        pathPrefixSize: 2
      }, opts)
    }]
  )
  logger.info(`OpenAPI documentation available at ${opts.documentationPath} and descriptor at ${opts.jsonPath}`)
}

/**
 * Configure and start service in a standalone Hapi Http server
 *
 * See {@link http://github.com/feugy/mini-service?content=readme|Read-me} for more detailed information
 * on how to shape service definitions
 *
 * All APIs will be exposed as `POST` or `GET` `/api/{group}/{api}` endpoints, where:
 * <ul>
 *  <li>`group` identifies the API group</li>
 *  <li>`api` is the method name of the exposed API</li>
 * </ul>
 *
 * `GET` are used when exposed function doesn't take any parameter, `POST` are used otherwise
 *
 * @module server
 * @async
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
 * @returns {Object} <b>started</b> {@link https://hapijs.com/api#server()|hapi} server as parameter
 */
module.exports = async (opts = {}) => {
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

  try {
    const server = new Server({port})

    const apis = await registerAsPlugins(server, options, logger)
    // list of exposed APIs, for clients
    server.route({
      method: 'GET',
      path: `${basePath}/exposed`,
      handler: () => ({
        name,
        version,
        apis
      })
    })

    const {openApi, version} = opts
    if (openApi) {
      await exposeDocumentation(server, openApi, version, logger)
    }
    await server.start()
    logger.info(server.info, 'server started')
    return server
  } catch (err) {
    logger.error(err, 'failed to start server')
    throw err
  }
}

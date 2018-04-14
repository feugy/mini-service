const {Server} = require('hapi')
const {getLogger} = require('mini-service-utils')
const {exposeDocumentation} = require('./expose-documentation')
const {registerGroups} = require('./register-groups')
const {basePath} = require('./constants')

/**
 * Configure and start service in a standalone Hapi Http server
 *
 * See {@link https://feugy.github.io/mini-service/?content=readme|Read-me} for more detailed information
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
 * @function server
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
    // temporary workaround until https://github.com/glennjones/hapi-swagger/issues/492 is fixed
    // (prevent swagger UI requests to be processed)
    const forwardedHostHeader = 'x-forwarded-host'
    server.ext('onRequest', async (request, h) => {
      /* $lab:coverage:off$ */
      request.headers[forwardedHostHeader] = (request.headers[forwardedHostHeader] || request.info.host)
      /* $lab:coverage:on$ */
      return h.continue
    })

    const apis = await registerGroups(server, options, logger)
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

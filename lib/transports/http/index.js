/**
 * Http implementation based on Hapi server.
 *
 * All APIs will be exposed as `POST` or `GET` `/api/{group}/{api}` endpoints, where:
 * - `group` identifies the API group
 * - `api` is the method name of the exposed API
 *
 * `GET` are used when exposed function doesn't take any parameter, `POST` are used otherwise
 *
 * Dependencies:
 * - hapi@17
 * - boom@7
 * - hapi-swagger@9 (openAPI = true)
 * - inert@5 (openAPI = true)
 * - vision@5 (openAPI = true)
 *
 * @module transports/http
 */
const joi = require('joi')
const { merge } = require('hoek')
const { extractApis, basePath } = require('../../utils')
const exposeDocumentation = require('./expose-documentation')
const registerRoute = require('./register-route')

/**
 * Hapi server. A wrapper around nodejs' Http server.
 * @typedef {Object} Hapi
 * @see {@link https://hapijs.com/api#server|Hapi documentation}
 */

/**
 * Group of exposed API
 * @typedef {Object} APIGroup
 * @property {String} name    - group friendly name (a valid JavaScript identifier)
 * @property {Function} init  - async initialization function that takes options as parameter and
 *                              resolves with exposed APIs (an object of async functions)
 */

/**
 * OpenAPI configuration object, such as defined in
 * [swagger-hapi plugin](https://github.com/glennjones/hapi-swagger)
 * @typedef {Object} OpenAPI
 * @property {String} [jsonPath = '/swagger.json']           - path for json descriptor
 * @property {String} [documentationPath = '/documentation'] - path for GUI
 */

/**
 * Http transport options
 * @typedef {Object} HttpOptions
 * @property {String} type          - transport type: 'http' in this case
 * @property {String} [port = 3000] - listening port (use 0 to pick first available port)
 * @property {OpenAPI} [openApi]    - if provided, enables (and customizes) OpenAPI descriptor and GUI
 */

/**
 * Validates incoming options
 * @param {ServiceOptions} options - option hash to validate
 * @throws {Error} when mandatory properties are missing
 * @throws {Error} when property values are misformated
 */
exports.validateOpts = options => {
  joi.assert(options, joi.object({
    name: joi.string().required(),
    version: joi.string().required(),
    transport: joi.object({
      type: joi.string().only('http').required(),
      port: joi.number().integer().min(0),
      openApi: joi.object().unknown()
    }).unknown(true).required()
  }).unknown(true))
}

/**
 * Configures and starts a service through a standalone Http server
 *
 * @async
 * @static
 * @param {HttpOptions} opts - service options
 * @returns {Hapi} *started* http server as parameter
 */
exports.expose = async opts => {
  // peer dependencies
  const { Server } = require('hapi')

  const { exposed, descriptors, checksum, logger } = await extractApis(opts)

  const { name, version, transport: { openApi, port } } = merge({
    transport: {
      port: 3000
    }
  }, opts)

  try {
    logger.debug({ port }, 'Configure server')
    const server = new Server({ port })
    // list of exposed APIs, for clients
    server.route({
      method: 'GET',
      path: `${basePath}/exposed`,
      handler: () => ({
        name,
        version,
        apis: exposed
      })
    })

    // register all routes
    descriptors.map(registerRoute(server, logger, checksum))

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

const {Server} = require('hapi')
const {getLogger} = require('./utils')
const {registerAsPlugins} = require('./utils/register')

/**
 * Configure and start service in a standalone Hapi Http server
 * By default, exposes service declared in ./service/index.js
 *
 * All service APIs will be exposed as POST or GET `/api/{service}/{api}` endpoints, where:
 * `service` is the filename of the service file
 * `api` is the method name of the exposed API
 * GET are used when exposed function doesn't take any parameter
 *
 * @param {Object} opts - server options, including
 * @param {Number} [opts.port = 3000] - listening port
 * @param {Object} [opts.logger] - bunyan compatible logger
 * @param {Array<Object>} [opts.services] - exposed services, an array containing for each service:
 * @param {String} [opts.services.name] - service friendly name (a valid JavaScript identifier)
 * @param {String} [opts.services.init] - initialization function that takes options as parameter and returns
 * a Promise resolved with exposed APIs (an object with functions that returns promises)
 * @param {Object} [opts.serviceOpts] - per-service configuration. might contain a properties named after services
 * @returns {Promise} promise - resolve with the Hapi server as parameter
 */
module.exports = (opts = {}) => {

  const options = Object.assign({
    port: 3000,
    logger: getLogger(),
    serviceOpts: {},
    services: require('./services')
  }, opts)

  const {port, logger, serviceOpts, services} = options
  logger.debug({port}, 'Configure server')

  const server = new Server()
  server.connection({port})

  return registerAsPlugins(server, services, serviceOpts, logger)
    .then(exposed => {
      // list of exposed APIs, for clients
      server.route({
        method: 'GET',
        path: '/api/exposed',
        handler: (req, reply) => reply(exposed)
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

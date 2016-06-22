const {Server} = require('hapi')
const boom = require('boom')
const Joi = require('joi')
const {getLogger, getParamNames, arrayToObj, validateParams} = require('./utils')

/**
 * Configure and start service in a standalone Hapi Http server
 *
 * All service APIs will be exposed as POST or GET `/api/{service}/{api}` endpoints, where:
 * `service` is the filename of the service file
 * `api` is the method name of the exposed API
 * GET are used when exposed function doesn't take any parameter
 *
 * @param {Array<Object>} services - exposed services, as an array of object containing
 * @param {String} services.name - service short name
 * @param {Function} services.init - initialization function that takes options as parameter and returns
 * a Promise resolved with exposed APIs (an object with functions that returns promises)
 * @param {Object} opts - server options, including
 * @param {Number} [opts.port = 3000] - listening port
 * @param {Object} [opts.logger] - bunyan compatible logger
 * @param {Object} [opts.serviceOpts] - per-service configuration. might contain a properties named after services
 * @returns {Promise} promise - resolve with the Hapi server as parameter
 */
module.exports = (services = [], opts = {}) => {

  const options = Object.assign({
    port: 3000,
    logger: getLogger(),
    serviceOpts: {}
  }, opts)

  const {port, logger, serviceOpts} = options
  logger.debug({port}, 'Configure server')

  const server = new Server()
  server.connection({port})

  return server.register(
    // all services will be considered as Hapi plugins
    services.map(({name, init}) => {
      const plugin = {
        register: (serv, pluginOpts, next) =>
          init(serviceOpts[name] || {})
            .then(apis => {
              for (const id in apis) {
                const api = apis[id]
                const params = getParamNames(api)
                const path = `/api/${name}/${id}`
                const config = {validate: {}}
                // adds input validation if needed
                if (api.length && api.validate) {
                  const schema = Joi.object(arrayToObj(api.validate, params)).unknown(false)
                  // use custom validation instead of Joi schema for a better reporting in case of extra parameters
                  config.validate.payload = (values, validationOpts, done) =>
                    done(validateParams(values, schema, id, params.length))
                }
                // publish each API as a POST endpoint
                serv.route({
                  method: api.length ? 'POST' : 'GET',
                  path,
                  config,
                  handler: (req, reply) => {
                    const payload = req.payload || {}
                    api(...params.map(prop => payload[prop]))
                      .then(reply)
                      .catch(err => reply(boom.create(599, err.message)))
                  }
                })
                logger.debug(`API ${path} exposed`)
              }
            })
            .then(next)
            .catch(next)
      }
      plugin.register.attributes = {name}
      return plugin
    })
  )
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

const {Server} = require('hapi')
const boom = require('boom')
const Joi = require('joi')
const services = require('./services')
const {getLogger} = require('./utils')

/**
 * Configure and start service in a standalone Hapi Http server
 *
 * All service APIs will be exposed as POST `/api/{service}/{api}` endpoints, where:
 * `service` is the filename of the service file
 * `api` is the method name of the exposed API
 *
 * @param {Object} opts - server options, including
 * @param {Number} [opts.port = 3000] - listening port
 * @param {Object} [opts.logger] - bunyan compatible logger
 * @returns {Promise} promise - resolve with the Hapi server as parameter
 */
module.exports = opts => {

  const options = Object.assign({
    port: 3000,
    logger: getLogger()
  }, opts)

  const {port, logger} = options
  logger.debug({port}, 'Configure server')

  const server = new Server()
  server.connection({port})

  return server.register(
    // all services will be considered as Hapi plugins
    services.map(({name, register}) => {
      const plugin = {
        register: (serv, pluginOpts, next) =>
          register()
            .then(apis => {
              for (const id in apis) {
                const path = `/api/${name}/${id}`
                const validate = apis[id].validate || []
                // publish each API as a POST endpoint
                serv.route({
                  method: 'POST',
                  path,
                  // adds input validation
                  config: {
                    validate: {
                      payload: Joi.array().ordered(...validate).max(validate.length)
                    }
                  },
                  handler: (req, reply) => {
                    apis[id](...req.payload)
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

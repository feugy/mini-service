const joi = require('joi')
const boom = require('boom')
const {getParamNames, arrayToObj, validateParams, isApi, serviceschema}= require('mini-service-utils')

/**
 * Register all given services to an Hapi server
 * All services will be initialized first (order matters) using the given options, at server start.
 *
 * @param {Hapi} server - in which services are exposed as Http endpoints
 * @param {Array<Object>} services - services definition including name and init() function
 * @param {Object} serviceOpts - service individual options
 * @param {Bunyan} logger - logger used to report init
 * @returns {Promise} promise - resolve when all services have been registered as Hapi plugins.
 * @returns {Array<Object>} promise.exposed - list of exposed routes:
 * @returns {String} promise.exposed.name - service name
 * @returns {String} promise.exposed.id - exposed api id
 * @returns {Array<String>} promise.exposed.params - exposed api parameter names
 * @returns {String} promise.exposed.path - http endpoint full path
 */
exports.registerAsPlugins = (server, services, serviceOpts, logger) => {
  const exposed = []
  const valid = serviceschema.validate(services)
  if (valid.error) return Promise.reject(valid.error)
  return server.register(
    // all services will be considered as Hapi plugins
    services.map(({name, init}) => {
      const plugin = {
        register: (serv, pluginOpts, next) => {
          const initialized = init(Object.assign({logger}, serviceOpts[name]))
          if (Promise.resolve(initialized) !== initialized) {
            return next(new Error(`service ${name} init() method didn't returned a promise`))
          }
          return initialized.then(apis => {
            if (!isApi(apis)) return
            for (const id in apis) {
              const api = apis[id]
              const params = getParamNames(api)
              const path = `/api/${name}/${id}`
              const config = {validate: {}}
              // adds input validation if needed
              if (api.length && api.validate) {
                const schema = joi.object(arrayToObj(api.validate, params)).unknown(false)
                // use custom validation instead of Joi schema for a better reporting in case of extra parameters
                config.validate.payload = (values, validationOpts, done) =>
                  done(validateParams(values, schema, id, params.length))
              }
              // keep the list of exposed functions
              exposed.push({name, id, params, path})
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
      }
      plugin.register.attributes = {name}
      return plugin
    })
  ).then(() => exposed)
}

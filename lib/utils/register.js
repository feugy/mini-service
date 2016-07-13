const request = require('request-promise')
const joi = require('joi')
const boom = require('boom')
const {getParamNames, arrayToObj, validateParams, isApi}= require('./')

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
  return server.register(
    // all services will be considered as Hapi plugins
    services.map(({name, init}) => {
      const plugin = {
        register: (serv, pluginOpts, next) =>
          init(Object.assign({logger}, serviceOpts[name]))
            .then(apis => {
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
      plugin.register.attributes = {name}
      return plugin
    })
  ).then(() => exposed)
}

/**
 * Ask a given server for apis to register into the given context
 *
 * @param {Object} context - in which services exposed api will be registered
 * @param {String} url - remote server that exposes the APIs
 * @param {Bunyan} logger - logger used to report init
 * @returns {Promise} promise - resolve without argument when all service apis have been exposed into context
 */
exports.registerFromServer = (context, url, logger) =>
  request({
    method: 'GET',
    uri: `${url}/api/exposed`,
    json: true
  }).then(exposed =>
    exposed.forEach(({name, path, id, params}) => {
      const method = params.length ? 'POST' : 'GET'
      // adds the corresponding method to client
      context[id] = (...args) =>
        request({
          method,
          uri: `${url}${path}`,
          body: arrayToObj(args, params),
          json: true
        })
      logger.debug(`APIs ${id} from service ${name} loaded`)
    })
  )

/**
 * Register given services using serviceOpts into the given context
 * All services will be initialized first (order matters) using the given options
 *
 * @param {Object} context - in which services exposed api will be registered
 * @param {Array<Object>} services - services definition including name and init() function
 * @param {Object} serviceOpts - service individual options
 * @param {Bunyan} logger - logger used to report init
 * @returns {Promise} promise - resolve without argument when all service apis have been exposed into context
 */
exports.registerLocal = (context, services, serviceOpts, logger) =>
  [Promise.resolve()].concat(services)
    .reduce((previous, {name, init}) =>
      previous
        .then(() => init(Object.assign({logger}, serviceOpts[name])))
        .then(apis => {
          if (!isApi(apis)) return
          for (const id in apis) {
            const validate = apis[id].validate
            // extrat param names for validation
            const params = getParamNames(apis[id])
            let schema = null

            if (validate) {
              // use hash instead of array for more understandable error messages
              schema = joi.object(arrayToObj(validate, params)).unknown(false)
            }

            // enrich context with a dedicated function
            context[id] = (...args) => {
              // adds input validation
              if (schema) {
                const error = validateParams(arrayToObj(args, params), schema, id, params.length)
                if (error) {
                  return Promise.reject(error)
                }
              }
              // forces input/output serialization and deserialization to have consistent result with remote client
              return apis[id](...JSON.parse(JSON.stringify(args)))
                .then(result => JSON.parse(JSON.stringify(result)))
            }
          }
          logger.debug({apis: Object.keys(apis)}, `APIs from service ${name} loaded`)
        })
    )

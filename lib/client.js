const request = require('request-promise')
const Joi = require('joi')
const {version} = require('../package.json')
const {getLogger, getParamNames, arrayToObj, validateParams} = require('./utils')

class Client {

  // client's version
  get version() {
    return version
  }

  /**
   * Builds a new remote or local client
   * By default, exposes service declared in ./service/index.js
   *
   * Remote clients will ignore services and serviceOpts options, only intended to local clients
   *
   * @param {Object} opts - client options, including:
   * @param {String} [opts.remote] - Provide a valid http(s) uri to bind this client to a distant service.
   * Set to null to instanciate the µService locally
   * @param {Object} [opts.logger] - Bunyan compatible logger
   * @param {Array<Object>} [opts.services] - exposed services, an array containing for each service:
   * @param {String} [opts.services.name] - service friendly name (a valid JavaScript identifier)
   * @param {String} [opts.services.init] - initialization function that takes options as parameter and returns
   * a Promise resolved with exposed APIs (an object with functions that returns promises)
   * @param {Object} [opts.serviceOpts] - per-service configuration. might contain a properties named after services
   * (only used if client is local)
   */
  constructor(opts = {}) {
    this.initialized = false
    this.options = Object.assign({
      logger: getLogger(),
      remote: null,
      serviceOpts: {},
      services: require('./services')
    }, opts)
  }

  /**
   * Initialize the client by registering services APIs as client's method.
   * @returns {Promise} promise - resolved when client is initialized, without any arguments
   */
  init() {
    if (this.initialized) return Promise.resolve()
    const {logger, remote, services, serviceOpts} = this.options
    return Promise.resolve()
      .then(() => {
        if (remote) {
          // remote: connect to server to get the list of exposed APIs
          return request({
            method: 'GET',
            uri: `${remote}/api/exposed`,
            json: true
          }).then(exposed =>
            exposed.forEach(({name, path, id, params}) => {
              const method = params.length ? 'POST' : 'GET'
              // adds the corresponding method to client
              this[id] = (...args) =>
                request({
                  method,
                  uri: `${remote}${path}`,
                  body: arrayToObj(args, params),
                  json: true
                })
              logger.debug(`APIs ${id} from service ${name} loaded`)
            })
          )
        }
        // local: register all available services serially
        return [Promise.resolve()].concat(services).reduce((previous, {name, init}) =>
          previous
            .then(() => init(Object.assign({logger: this.options.logger}, serviceOpts[name])))
            .then(apis => {
              for (const id in apis) {
                const validate = apis[id].validate
                // extrat param names for validation
                const params = getParamNames(apis[id])
                let schema = null

                if (validate) {
                  // use hash instead of array for more understandable error messages
                  schema = Joi.object(arrayToObj(validate, params)).unknown(false)
                }

                // enrich client with a dedicated function
                this[id] = (...args) => {
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
              logger.debug(`APIs from service ${name} loaded`)
            })
        )
      }).then(() => {
        this.initialized = true
        logger.debug(`${remote ? 'remote' : 'local'} client ready`)
      })
  }
}

/**
 * Creates a client that exposes all µService's functionnalites.
 *
 * @param {Object} opts - client options, see Client.constructor
 * @returns {Client} client - to use µService functionnalities
 */
module.exports = (...args) => new Client(...args)

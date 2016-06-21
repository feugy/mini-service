const request = require('request-promise')
const Joi = require('joi')
const {version} = require('../package.json')
const {getLogger} = require('./utils')
const services = require('./services')

class Client {

  // client's version
  get version() {
    return version
  }

  /**
   * Builds a new remote or local client
   * @param {Object} opts - client options, including:
   * @param {String} [opts.remote] - Provide a valid http(s) uri to bind this client to a distant service.
   * Set to null to instanciate the µService locally
   * @param {Object} [opts.logger] - Bunyan compatible logger
   */
  constructor(opts = {}) {
    this.initialized = false
    this.options = Object.assign({
      logger: getLogger(),
      remote: null
    }, opts)
  }

  /**
   * Initialize the client by registering services APIs as client's method.
   * @returns {Promise} promise - resolved when client is initialized, without any arguments
   */
  init() {
    if (this.initialized) return Promise.resolve()
    const {logger, remote} = this.options

    if (remote) {
      // remote: creates an Hapi server
      return Promise.all(services.map(({name, register}) =>
        register()
          .then(apis => {
            for (const id in apis) {
              // adds the corresponding method to client
              this[id] = (...args) =>
                request({
                  method: 'POST',
                  uri: `${remote}/api/${name}/${id}`,
                  body: args,
                  json: true
                })
            }
            logger.debug(`APIs from service ${name} loaded`)
          })
      )).then(() => {
        this.initialized = true
        logger.debug({remote}, 'remote client ready')
      })
    }
    // local: register all available services
    return Promise.all(services.map(({name, register}) =>
      register()
        .then(apis => {
          for (const id in apis) {
            const validate = apis[id].validate
            this[id] = (...args) => {
              // adds input validation
              if (validate) {
                const report = Joi.array().ordered(...validate).max(validate.length).validate(args)
                if (report.error) {
                  return Promise.reject(new Error(report.error))
                }
              }
              // forces input/output serialization and deserialization to have consistent result with remote client
              return apis[id](...JSON.parse(JSON.stringify(args)))
                .then(result => JSON.parse(JSON.stringify(result)))
            }
          }
          logger.debug(`APIs from service ${name} loaded`)
        })
    )).then(() => {
      this.initialized = true
      logger.debug('local client ready')
    })
  }
}

/**
 * Creates a client that exposes all µService's functionnalites.
 *
 * @param {Object} opts - client options, see Client.constructor
 * @returns {Client} client - to use µService functionnalities
 */
module.exports = opts => new Client(opts)

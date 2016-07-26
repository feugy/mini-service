const {version} = require('../package.json')
const {getLogger} = require('./utils')
const {registerLocal, registerFromServer} = require('./utils/register')

const reserved = ['then', 'catch', 'finally']

class Client {

  // client's version
  get version() {
    return this.options.version
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
      services: require('./services'),
      version
    }, opts)

    const {logger, remote} = this.options

    return remote ? new Proxy(this, {
      get(target, propKey) {
        // use first defined properties
        if (propKey in target) {
          return target[propKey]
        }
        // reserved keyword that aren't defined must be undefined (thenable false-positive)
        if (reserved.includes(propKey)) {
          /* eslint no-undefined: 0 */
          return undefined
        }
        // creates a function that will get exposed API from remote server
        return (...args) => {
          logger.debug(`during ${propKey}, connect to ${remote} to get exposed apis`)
          return registerFromServer(target, remote, logger)
            .then(() => {
              logger.debug('remote client ready')
              // now, invoke the API with initial arguments, but only if it exists
              if (!(propKey in target)) {
                throw new TypeError(`${propKey} is not a function`)
              }
              return target[propKey](...args)
            })
        }
      }
    }) : this
  }

  /**
   * Initialize the client by registering services APIs as client's method.
   * @returns {Promise} promise - resolved when client is initialized, without any arguments
   */
  init() {
    if (this.initialized || this.options.remote) return Promise.resolve()
    const {logger, services, serviceOpts} = this.options
    return Promise.resolve()
      .then(() =>
        // local: register all available services serially
        registerLocal(this, services, serviceOpts, logger)
      ).then(() => {
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
module.exports = (...args) => new Client(...args)

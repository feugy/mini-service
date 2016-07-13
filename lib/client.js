const {version} = require('../package.json')
const {getLogger} = require('./utils')
const {registerLocal, registerFromServer} = require('./utils/register')

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
          return registerFromServer(this, remote, logger)
        }
        // local: register all available services serially
        return registerLocal(this, services, serviceOpts, logger)
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

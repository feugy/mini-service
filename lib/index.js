/**
 * Mini-service entry point
 * @module mini-service
 */
const { merge } = require('hoek')
const { loadTransport } = require('mini-service-utils')

/**
 * Service definition and transport options
 * @typedef {Object} ServiceOptions
 * @property {String} name                  - service name
 * @property {String} version               - service version
 * @property {Function} [init]              - async initialization function that takes options as parameter and
 *                                            resolves with exposed APIs (an object of async functions).
 *                                            Takes precedence over `groups` as a simpler alternative of API group.
 *                                            The LocalOptions object itself will be used as options for this single API group.
 * @property {Array<APIGroup>} groups       - exposed APIs groups, in case `init` isn't provided
 * @property {Object} [groupOpts]           - per-group configuration.
 *                                            Might contain a properties named after group.
 *                                            Only used when `init` isn't provided)
 * @property {HttpOptions} transport        - transport specific options:
 * @property {Bunyan} logger                - logger used for reporting
 */

/**
 * Starts a server using given service definition(s)
 * TODO test
 *
 * @deprecated
 * @static
 */
exports.startServer = async opts => {
  // backward compatibility
  // TODO remove in version 5
  process.emitWarning('mini-service: startServer has been deprecated. Use start instead')
  const options = merge({
    transport: {
      type: 'http'
    }
  }, opts)
  const { port, openApi } = options
  if (port !== undefined) {
    options.transport.port = port
    process.emitWarning('mini-service: port option has been deprecated. Use transport.port instead')
  }
  if (openApi !== undefined) {
    options.transport.openApi = openApi
    process.emitWarning('mini-service: openApi option has been deprecated. Use transport.openApi instead')
  }
  return exports.start(options)
}

/**
 * Returns a generic client
 * @static
 * @see {@link http://github.com/feugy/mini-client|mini-client}
 */
exports.getClient = require('mini-client')

/**
 * Expose the specified service(s) using a given transport
 * TODO test
 *
 * @static
 * @param {ServiceOptions} options - service definition and transport options
 */
exports.start = async options => {
  const { validateOpts, expose } = loadTransport(options, require)
  validateOpts(options)
  return expose(options)
}

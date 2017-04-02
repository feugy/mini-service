/**
 * Mini-service entry point
 * @module mini-service
 */
module.exports = {

  /**
   * @summary Starts a server using given service definition(s).
   * @method
   * @see module:server~startServer
   */
  startServer: require('./server'),

  /**
   * @summary Returns a generic client
   * @method
   * @see {@link http://github.com/feugy/mini-client|mini-client}
   */
  getClient: require('mini-client')
}

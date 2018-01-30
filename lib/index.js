/**
 * Mini-service entry point
 * @module
 */
module.exports = {

  /**
   * Starts a server using given service definition(s).
   * @async
   * @see {@link #module:server}
   */
  startServer: require('./server'),

  /**
   * Returns a generic client
   * @see {@link http://github.com/feugy/mini-client|mini-client}
   */
  getClient: require('mini-client')
}

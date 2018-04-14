/**
 * Mini-service entry point
 * @module mini-service
 */
module.exports = {

  /**
   * Starts a server using given service definition(s).
   * @async
   * @see {@link #server}
   */
  startServer: require('./server'),

  /**
   * Returns a generic client
   * @see {@link http://github.com/feugy/mini-client|mini-client}
   */
  getClient: require('mini-client')
}

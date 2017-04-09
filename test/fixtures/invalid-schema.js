/**
 * Initialize service and returns an object containing APIs functions
 * @returns {Promise} promise - resolve with an object containing exposed APIs
 */
module.exports = {
  name: 'invalid-schema',
  version: '1.0.0',
  init: () => {
    const apis = {
      /**
       * Respond to message
       * @param {String} message    simple message received
       * @returns {Promise<String>} resolved with the sent message
       */
      invalidValidator(message) {
        return Promise.resolve(message)
      }
    }

    // adds input validation
    apis.invalidValidator.validate = 10

    return Promise.resolve(apis)
  }
}

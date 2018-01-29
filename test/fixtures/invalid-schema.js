/**
 * Initialize service and returns an object containing APIs functions
 * @returns {Promise} promise - resolve with an object containing exposed APIs
 */
module.exports = {
  name: 'invalid-schema',
  version: '1.0.0',
  init: () => {
    /**
     * Respond to message
     * @param {String} message    simple message received
     * @returns {String}          the sent message
     */
    const invalidValidator = (message) => message

    // adds input validation
    invalidValidator.validate = 10

    return {invalidValidator}
  }
}

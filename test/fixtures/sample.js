const Joi = require('joi')

/**
 * Initialize service and returns an object containing APIs functions
 * @param {Object} opts - service opts
 * @returns {Promise} promise - resolve with an object containing exposed APIs
 */
module.exports = (opts = {}) => {

  const apis = {
    /**
     * Respond to ping
     * @returns {Promise} promise - resolved with an object containing:
     * @returns {Date} promise.time - ping current time
     */
    ping() {
      return Promise.resolve({time: new Date()})
    },

    /**
     * Kindly say hello, and demonstrate how to validate input parameters
     * @param {String} name - person to greet
     * @returns {Promise} promise - resolved with a greeting string message
     */
    greeting(name) {
      return Promise.resolve(`Hello ${name}${opts.greetings || ''} !`)
    },

    /**
     * Failing API to test rejection handling
     * @returns {Promise} promise - always rejected
     */
    failing() {
      return Promise.reject(new Error('something went really bad'))
    }
  }

  // adds input validation
  apis.greeting.validate = [Joi.string().required()]

  return Promise.resolve(apis)
}

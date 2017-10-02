const Joi = require('joi')
const {unauthorized} = require('boom')

/**
 * Initialize service and returns an object containing APIs functions
 * @param {Object} opts service opts
 * @returns {Promise} resolve with an object containing exposed APIs
 */
module.exports = (opts = {}) => {
  const apis = {
    /**
     * Respond to ping
     * @returns {Promise<Object>} resolved with an object containing current time
     */
    ping () {
      return Promise.resolve({time: new Date()})
    },

    /**
     * Kindly say hello, and demonstrate how to validate input parameters
     * @param {String} name person to greet
     * @returns {Promise} resolved with a greeting string message
     */
    greeting (name) {
      return Promise.resolve(`Hello ${name}${opts.greetings || ''} !`)
    },

    /**
     * Failing API to test rejection handling
     * @returns {Promise} always rejected
     */
    failing () {
      return Promise.reject(new Error('something went really bad'))
    },

    /**
     * API that synchronously fails when executing
     * @throws always an error
     */
    errored () {
      throw new Error('errored API')
    },

    /**
     * API that returns undefined
     * @returns {Promise} always resolved with undefined
     */
    getUndefined () {
      return Promise.resolve(undefined)
    },

    /**
     * API that generates a 401 Boom error
     * @returns {Promise} rejected with Unauthorized Boom error with custom message
     */
    boomError () {
      return Promise.reject(unauthorized('Custom authorization error'))
    }
  }

  // adds input validation
  apis.greeting.validate = [Joi.string().required()]

  return Promise.resolve(apis)
}

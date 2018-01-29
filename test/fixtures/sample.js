const Joi = require('joi')
const {unauthorized} = require('boom')

/**
 * Initialize service and returns an object containing APIs functions
 * @param {Object} opts service opts
 * @returns {Promise} resolve with an object containing exposed APIs
 */
module.exports = async (opts = {}) => {
  const apis = {
    /**
     * Respond to ping
     * @returns {Promise<Object>} resolved with an object containing current time
     */
    async ping () {
      return {time: new Date()}
    },

    /**
     * Kindly say hello, and demonstrate how to validate input parameters and response
     * @param {String} name person to greet
     * @returns {Promise} resolved with a greeting string message, null if name is 'boom'
     */
    async greeting (name) {
      if (name === 'boom') {
        // will trigger response validation error
        return null
      }
      return `Hello ${name}${opts.greetings || ''} !`
    },

    /**
     * Failing API to test rejection handling
     * @returns {Promise} always rejected
     */
    async failing () {
      throw new Error('something went really bad')
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
    async getUndefined () {
      return undefined
    },

    /**
     * API that generates a 401 Boom error
     * @returns {Promise} rejected with Unauthorized Boom error with custom message
     */
    async boomError () {
      throw unauthorized('Custom authorization error')
    }
  }

  // adds output documentation
  apis.ping.responseSchema = Joi.date().required()

  // adds input validation
  apis.greeting.validate = [Joi.string().required()]

  // adds output documentation & validation
  apis.greeting.responseSchema = Joi.string().required()
  apis.greeting.validateResponse = true

  return apis
}

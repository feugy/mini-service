const Joi = require('joi')
const {unauthorized} = require('boom')

/**
 * Initialize service and returns an object containing APIs functions
 * @param {Object} opts service opts
 * @returns {Object} containing exposed APIs
 */
module.exports = (opts = {}) => {
  const apis = {
    /**
     * Kindly say hello, and demonstrate how to validate input parameters and response
     * @param {String} name person to greet
     * @returns {String} greeting string message, null if name is 'boom'
     */
    greeting (name) {
      if (name === 'boom') {
        // will trigger response validation error
        return null
      }
      return `Hello ${name}${opts.greetings || ''} !`
    },

    /**
     * API that returns undefined
     * @returns {void} always undefined
     */
    getUndefined () {
      return undefined
    },

    /**
     * API that generates a 401 Boom error
     * @throws {Error} Unauthorized Boom error with custom message
     */
    boomError () {
      throw unauthorized('Custom authorization error')
    }
  }

  // adds input validation
  apis.greeting.validate = [Joi.string().required()]

  // adds output documentation & validation
  apis.greeting.responseSchema = Joi.string().required()
  apis.greeting.validateResponse = true

  return apis
}

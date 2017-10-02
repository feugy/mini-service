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
     * Kindly say hello, and demonstrate how to validate input parameters
     * @param {String} name person to greet
     * @returns {String} greeting string message
     */
    greeting (name) {
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
     * @returns {Error} Unauthorized Boom error with custom message
     */
    boomError () {
      return unauthorized('Custom authorization error')
    }
  }

  // adds input validation
  apis.greeting.validate = [Joi.string().required()]

  return apis
}

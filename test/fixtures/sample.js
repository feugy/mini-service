const Joi = require('joi')
const assert = require('power-assert')
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
     * @async
     * @returns {Object} resolved with an object containing current time
     */
    async ping () {
      return {time: new Date()}
    },

    /**
     * Kindly say hello, and demonstrate how to validate input parameters and response
     * @async
     * @param {String} name person to greet
     * @returns {String} greeting message, null if name is 'boom'
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
     * @async
     * @throws always an error
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
     * @async
     */
    async getUndefined () {
      return undefined
    },

    /**
     * API that generates a 401 Boom error
     * @async
     * @throws always with Unauthorized Boom error with custom message
     */
    async boomError () {
      throw unauthorized('Custom authorization error')
    },

    /**
     * API with exotic signature including
     * - destructured parameters
     * - default values
     * - rest parameters
     * @async
     * @param {Array} param1  - array of anything
     * @param {Object} param2 - object that could contain a property named c
     * @param {Any} other     - array of other parameters
     * @returns {Array} array of effective parameters
     */
    async withExoticParameters ([a, b], {c: {d}} = {}, ...other) {
      return [a, b, d, ...other]
    },

    /**
     * API expecting a buffer as parameter and returning the same buffer with a prefix.
     *
     * @async
     * @param {Buffer} buffer - buffer handled
     * @returns {Buffer} received buffer concatented with Uint8Array containing 3 and 4
     */
    async bufferHandling (buffer) {
      assert(Buffer.isBuffer(buffer))
      return Buffer.concat([buffer, new Uint8Array([3, 4])])
    }
  }

  // adds output documentation: no validation enforce (validateResponse is undefined)
  apis.ping.responseSchema = Joi.object({time: Joi.date().required()})

  // adds input validation
  apis.greeting.validate = [Joi.string().required()]

  // adds output documentation & validation
  apis.greeting.responseSchema = Joi.string().required()
  apis.greeting.validateResponse = true

  // adds inut validation to enable buffer
  apis.bufferHandling.validate = Joi.binary().required()

  return apis
}

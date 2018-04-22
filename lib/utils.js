/**
 * Utilities for transports
 * @module utils
 */
const joi = require('joi')
const crc32 = require('crc32')
const {
  extractGroups,
  extractValidate,
  getLogger,
  getParamNames,
  isApi
} = require('mini-service-utils')

/**
 * Joi schema used for validations.
 * @typedef {Object} Joi
 * @see {@link https://github.com/hapijs/joi/blob/v13.1.2/API.md|Joi API}
 */

/**
 * Bunyan compatible logger
 * @typedef {Object} Bunyan
 * @see {@link https://github.com/trentm/node-bunyan#log-method-api|Bunyan API}
 */

/**
 * Exposed API
 * @typedef {Object} API
 * @property {String} group                   - group name
 * @property {String} id                      - exposed api id
 * @property {Array<String>} params           - api ordered parameter names
 * @property {String} path                    - API path
 * @property {Boolean} [hasBufferInput=false] - true if single input parameter is a buffer
 * @property {Boolean} [hasStreamInput=false] - true if single input parameter is a stream
 */

/**
 * Internal Descriptor: exposed API, validation schemas and actual handler
 * @typedef {API} Descriptor
 * @property {?Joi} payloadSchema               - joi object used to validate input parameters
 * @property {?Joi} responseSchema              - joi object used to validate API result
 * @property {Boolean} [validateResponse=false] - true to validate response against responseSchema,
 * @property {Function} api                     - api function
 */

/**
 * Internal list of exposed descriptors, api.
 * @typedef {Object} ExposedAPIList
 * @property {Array<Descriptor>} descriptors - array of API descriptor,
 * @property {Array<API>} exposed            - array of exposed apis
 * @property {String} checksum               - checksum of the stringified exposed API array
 * @property {Bunyan} logger                 - bunyan compatible logger
 */

/**
 * Purge descriptor to produces exposed API
 * @private
 * @param {Descriptor} descriptor - processed descriptor
 * @returns {API} corresponding API
 */
const purge = ({ id, group, hasBufferInput, hasStreamInput, params, path }) => ({
  group,
  id,
  params,
  path,
  hasBufferInput,
  hasStreamInput
})

/**
 * Base path used to expose API
 * @type {String}
 */
exports.basePath = '/api'

/**
 * Joi schema used to validate API found in services
 * @type {Joi}
 */
exports.apiSchema = joi.func().keys({
  // parameters validation schema
  validate: joi.array().items(joi.object().schema()).description('ordered arry of joi schemas, used to validate API parameters'),
  responseSchema: joi.object().schema().description('Joi schema to document API result. Will be used as validation when validateResponse is true'),
  validateResponse: joi.boolean().description('when true, apply responseSchema to API result'),
  hasBufferInput: joi.boolean().description('when true, consider the single parameter to be a buffer'),
  hasStreamInput: joi.boolean().description('when true, consider the single parameter to be a stream')
})// .unknown(true)
// either buffer, either stream
// .nand('hasBufferInput', 'hasStreamInput')
// if response is validated, need a schema
  .with('validateResponse', 'responseSchema')

/**
 * Extract API from groups so they could be registered for a given transport.
 *
 * All groups will be initialized first (order matters) using the provided options.
 * API could be exposed:
 *  - directly using `opts.name` & `opts.init`
 *  - with groups using `opts.groups` and opts.groupOpts`
 *
 * See [Read-me](https://feugy.github.io/mini-service/?content=readme) for more detailed information
 * on how to shape service definitions with and without groups
 *
 * @async
 * @static
 * @param {Object} opts               - group options, including
 * @param {Function} [opts.init]        - async initialization function that takes options as parameter and
 * resolves with exposed APIs (an object with async functions).
 * Takes precedence over `opts.groups` as a simpler alternative of API group.
 * The `opts` object itself will be used as options for this single API group.
 * @param {Array<Object>} [opts.groups] - exposed APIs groups, an array containing for each group:
 * @param {String} opts.groups.name       - group friendly name (a valid JavaScript identifier)
 * @param {Function} opts.groups.init     - async initialization function that takes options as parameter and
 * resolves with exposed APIs (an object with async functions).
 * @param {Object} [opts.groupOpts]     - per-group configuration. might contain a properties named after group
 * @param {Bunyan} [opts.logger]        - bunyan compatible logger
 * @returns {ExposedAPIList} list of exposed APIs
 */
exports.extractApis = async opts => {
  const options = Object.assign({
    logger: getLogger()
  }, opts)

  const { logger } = options
  const descriptors = []
  const { groups, groupOpts } = extractGroups(opts)
  for (const { name: group, init } of groups) {
    // supports synchronous and asynchonous init
    const apis = await init(Object.assign({ logger }, groupOpts[group]))
    if (!isApi(apis)) {
      continue
    }
    for (const id in apis) {
      const api = apis[id]
      // assert metadata
      joi.assert(api, exports.apiSchema, `Invalid exposed API ${id} (from group ${group}):`)

      const responseSchema = extractValidate(id, apis, groupOpts[group], 'responseSchema')
      // keep the list of exposed functions
      descriptors.push({
        group,
        id,
        params: getParamNames(api),
        path: `${exports.basePath}/${group}/${id}`,
        hasBufferInput: api.hasBufferInput || false,
        hasStreamInput: api.hasStreamInput || false,
        payloadSchema: extractValidate(id, apis, groupOpts[group], 'validate'),
        responseSchema,
        validateResponse: (responseSchema && api.validateResponse) || false,
        api
      })
    }
  }
  const exposed = descriptors.map(purge)
  // compute checksum as the CRC-32 of the exposed API
  const checksum = crc32(JSON.stringify(exposed))
  return { descriptors, exposed, checksum, logger }
}

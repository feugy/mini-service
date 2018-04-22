
const joi = require('joi')
const boom = require('boom')
const crc32 = require('crc32')
const {Readable} = require('stream')
const {
  arrayToObj,
  checksumHeader,
  enrichError,
  extractGroups,
  extractValidate,
  getParamNames,
  isApi
} = require('mini-service-utils')
const {basePath} = require('./constants')

const apiSchema = joi.func().keys({
  // parameters validation schema
  validate: joi.array().items(joi.object().schema()).description('ordered arry of joi schemas, used to validate API parameters'),
  responseSchema: joi.object().schema().description('Joi schema to document API result. Will be used as validation when validateResponse is true'),
  validateResponse: joi.boolean().description('when true, apply responseSchema to API result'),
  hasBufferInput: joi.boolean().description('when true, consider the single parameter to be a buffer'),
  hasStreamInput: joi.boolean().description('when true, consider the single parameter to be a stream')
}).unknown(true)
  // either buffer, either stream
  .nand('hasBufferInput', 'hasStreamInput')
  // if response is validated, need a schema
  .with('validateResponse', 'responseSchema')

/**
 * @typedef {Object} ExposedAPI
 * @private
 * @property {String} name            group name
 * @property {String} id              exposed api id
 * @property {Array<String>} exposed  api parameter names
 * @property {String} path            http endpoint full path
 */

/**
 * Register all given API groups to an Hapi server
 *
 * All groups will be initialized first (order matters) using the given options, at server start.
 * API could be exposed:
 * - directly using `opts.name` & `opts.init`
 * - with groups using `opts.groups` and opts.groupOpts`
 *
 * @async
 * @param {Hapi} server         in which APIs are exposed as Http endpoints
 * @param {Object} opts         server options, including
 * @param {Function} [opts.init]        async initialization function that takes options as parameter and
 * resolves with exposed APIs (an object with async functions).
 * Takes precedence over `opts.groups` as a simpler alternative of API group.
 * The `opts` object itself will be used as options for this single API group.
 * @param {Array<Object>} [opts.groups] exposed APIs groups, an array containing for each group:
 * @param {String} opts.groups.name       group friendly name (a valid JavaScript identifier)
 * @param {Function} opts.groups.init     async initialization function that takes options as parameter and
 * resolves with exposed APIs (an object with async functions).
 * @param {Object} [opts.groupOpts]     per-group configuration. might contain a properties named after group
 * @param {Object} logger       {@link https://github.com/trentm/node-bunyan|bunyan} compatible logger
 * @returns {Array<ExposedAPI>} list of exposed APIs
 */
exports.registerGroups = async (server, opts, logger) => {
  const exposed = []
  let checksum
  const {groups, groupOpts} = extractGroups(opts)
  await server.register(
    // all groups will be considered as Hapi plugins
    groups.map(({name: group, init}) => ({
      register: async (serv, pluginOpts) => {
        // supports synchronous and asynchonous init
        const apis = await init(Object.assign({logger}, groupOpts[group]))
        if (!isApi(apis)) {
          return
        }
        for (const id in apis) {
          const api = apis[id]
          // assert metadata
          joi.assert(api, apiSchema, `Invalid exposed API ${id} (from group ${group}):`)
          const params = getParamNames(api)
          const path = `${basePath}/${group}/${id}`
          const options = {
            // disabled default 2 minutes timeout
            timeout: {socket: false},
            tags: ['api'],
            // copy documentation keys, if available, for openapi description
            notes: api.notes,
            description: api.description
          }
          // no payload parsing if explicitely disabled. No validation either.
          const parseAndValidate = api.hasStreamInput !== true && api.hasBufferInput !== true
          if (params.length) {
            // adds input validation if needed
            const payloadSchema = extractValidate(id, apis, groupOpts[group], 'validate')
            // disabled payload timeout and set 1Gb max size
            options.payload = {
              timeout: false,
              maxBytes: 1024 * 1024 * 1024,
              parse: parseAndValidate,
              output: api.hasStreamInput ? 'stream' : 'data'
            }
            if (parseAndValidate && payloadSchema) {
              options.validate = {
                payload: joi.object(arrayToObj(payloadSchema, params)).unknown(false).label(id),
                // customize error message for convenience
                failAction: (req, h, err) => enrichError(err, id)
              }
            }
          }
          // adds response validation if needed
          const responseSchema = extractValidate(id, apis, groupOpts[group], 'responseSchema')
          if (parseAndValidate && responseSchema) {
            options.response = {
              schema: responseSchema.label(`${id}Result`),
              // customize error message for convenience
              failAction: (req, h, err) => enrichError(err, id, false),
              // only apply response validation if explicitly needed
              sample: api.validateResponse ? 100 : 0
            }
          }
          // keep the list of exposed functions
          exposed.push({
            group,
            id,
            params,
            path,
            hasBufferInput: api.hasBufferInput || false,
            hasStreamInput: api.hasStreamInput || false
          })
          // publish each API as a POST endpoint
          serv.route({
            method: params.length ? 'POST' : 'GET',
            path,
            options,
            handler: async (req, h) => {
              const payload = req.payload || {}
              try {
                const args = []
                if (!parseAndValidate) {
                  // if payload isn't parsed, use it as-is
                  args.push(payload)
                } else {
                  // gets first expected parameters, and then other values for potential rest parameters
                  args.push(...params.map(prop => payload[prop]))
                  args.push(...Object.keys(payload).filter(p => !params.includes(p)).map(prop => payload[prop]))
                }
                // supports both synchronous and asynchronous API
                const res = await api(...args)
                if (res instanceof Readable) {
                  // if result is a stream, don't wrap it
                  res.headers = {[checksumHeader]: checksum}
                  return res
                } else {
                  // otherwise, let Hapi deal with content type and length
                  return h.response(res).header(checksumHeader, checksum)
                }
              } catch (err) {
                // bubble any synchronous problem (not returning promise...)
                if (!err.isBoom) {
                  throw boom.boomify(err, {statusCode: 599, message: `Error while calling API ${id}: ${err.message}`})
                }
                throw err
              }
            }
          })
          logger.debug(`API ${path} exposed`)
        }
      },
      name: group
    }))
  )
  // compute checksum as the CRC-32 of the exposed API
  checksum = crc32(JSON.stringify(exposed))
  return exposed
}

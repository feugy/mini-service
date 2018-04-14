
const joi = require('joi')
const boom = require('boom')
const crc32 = require('crc32')
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
          // adds input validation if needed
          const payloadSchema = extractValidate(id, apis, groupOpts[group], 'validate')
          if (params.length && payloadSchema) {
            try {
              options.validate = {
                payload: joi.object(arrayToObj(payloadSchema, params)).unknown(false).label(id),
                // customize error message for convenience
                failAction: (req, h, err) => enrichError(err, id)
              }
            } catch (exc) {
              throw new Error(`Invalid validation schema for API ${id} (from group ${group}): ${exc.message}`)
            }
            // disabled payload timeout and set 1Gb max size
            options.payload = {
              timeout: false,
              maxBytes: 1024 * 1024 * 1024
            }
          }
          // adds response validation if needed
          const responseSchema = extractValidate(id, apis, groupOpts[group], 'responseSchema')
          if (responseSchema) {
            options.response = {
              schema: responseSchema.label(`${id}Result`),
              // customize error message for convenience
              failAction: (req, h, err) => enrichError(err, id, false),
              // only apply response validation if explicitly needed
              sample: api.validateResponse ? 100 : 0
            }
          }
          // keep the list of exposed functions
          exposed.push({group, id, params, path})
          // publish each API as a POST endpoint
          serv.route({
            method: params.length ? 'POST' : 'GET',
            path,
            options,
            handler: async (req, h) => {
              const payload = req.payload || {}
              try {
                // gets first expected parameters, and then other values for potential rest parameters
                const values = params.map(prop => payload[prop])
                const rest = Object.keys(payload).filter(p => !params.includes(p)).map(prop => payload[prop])
                // supports both synchronous and asynchronous API
                const res = await api(...values, ...rest)
                return h.response(res).header(checksumHeader, checksum)
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

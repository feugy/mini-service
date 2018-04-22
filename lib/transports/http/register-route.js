const joi = require('joi')
const { Readable } = require('stream')
const { arrayToObj, checksumHeader, enrichError } = require('mini-service-utils')

/**
 * Returns closure to register a route on a given server
 *
 * @private
 * @param {Hapi} server     - for which documentation is created and exposed
 * @param {Bunyan} logger   - bunyan compatible logger
 * @param {String} checksum - exposed API checksum exposed on route
 * @returns {Function} closure that register a route for a given ExposedAPI object
 */
module.exports = (server, logger, checksum) => {
  // peer dependencies
  const { boomify } = require('boom')

  return definition => {
    const {
      path,
      id,
      params,
      hasStreamInput,
      hasBufferInput,
      payloadSchema,
      responseSchema,
      validateResponse,
      api
    } = definition

    const options = {
      // disabled default 2 minutes timeout
      timeout: { socket: false },
      tags: ['api'],
      // copy documentation keys, if available, for openapi description
      notes: api.notes,
      description: api.description
    }
    // no payload parsing if explicitely disabled. No validation either.
    const parseAndValidate = !hasStreamInput && !hasBufferInput
    if (params.length) {
      // disabled payload timeout and set 1Gb max size
      options.payload = {
        timeout: false,
        maxBytes: 1024 * 1024 * 1024,
        parse: parseAndValidate,
        output: hasStreamInput ? 'stream' : 'data'
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
    if (parseAndValidate && responseSchema) {
      options.response = {
        schema: responseSchema.label(`${id}Result`),
        // customize error message for convenience
        failAction: (req, h, err) => enrichError(err, id, false),
        // only apply response validation if explicitly needed
        sample: validateResponse ? 100 : 0
      }
    }
    // publish each API as a POST endpoint
    server.route({
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
            res.headers = { [checksumHeader]: checksum }
            return res
          } else {
            // otherwise, let Hapi deal with content type and length
            return h.response(res).header(checksumHeader, checksum)
          }
        } catch (err) {
          // bubble any synchronous problem (not returning promise...)
          if (!err.isBoom) {
            throw boomify(err, { statusCode: 599, message: `Error while calling API ${id}: ${err.message}` })
          }
          throw err
        }
      }
    })
    logger.debug(`API ${path} exposed`)
  }
}

const { merge } = require('hoek')
const { basePath } = require('../../utils')

/**
 * Expose OpenAPI json descriptor and documentation GUI
 *
 * Expose Swagger GUI under `/documentation` and `/swagger.json` file.
 * All options supported by [happi-swagger](https://github.com/glennjones/hapi-swagger)
 * can be used.
 * Can only document routes already registered.
 *
 * @private
 * @async
 * @param {Hapi} server       - for which documentation is created and exposed
 * @param {HttpOptions} opts  - hapi-swagger options, with following defaults:
 * @param {String} version    - server version
 * @param {Bunyan} logger     - bunyan compatible logger
 */
module.exports = async (server, opts, version, logger) => {
  // peer dependencies
  const inert = require('inert')
  const vision = require('vision')
  const swagger = require('hapi-swagger')

  await server.register([
    inert,
    vision,
    {
      plugin: swagger,
      options: merge({
        info: { version },
        documentationPath: '/documentation',
        jsonPath: '/swagger.json',
        basePath,
        pathPrefixSize: 2
      }, opts)
    }]
  )
  logger.info(`OpenAPI documentation available at ${opts.documentationPath} and descriptor at ${opts.jsonPath}`)
}

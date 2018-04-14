const {basePath} = require('./constants')
const {merge} = require('hoek')

/**
 * Expose OpenAPI json descriptor and documentation GUI
 *
 * Expose Swagger GUI under `/documentation` and `/swagger.json` file.
 * All options supported by https://github.com/glennjones/hapi-swagger can be used.
 * Can only document routes already registered.
 *
 * @async
 * @param {Hapi} server                   for which documentation is created and exposed
 * @param {Object} opts                   hapi-swagger options, with following defaults:
 * @param {Object} [opts.info]              global informations, including
 * @param {String} [opts.info.version]        API version, same as service version
 * @param {String} [opts.documentationPath] path for GUI, defaults to /documentation
 * @param {String} [opts.jsonPath]          path for json descriptor, defaults to /swagger.json
 * @param {String} [opts.basePath]          endpoint base path, defaults to /api
 * @param {Number} [opts.pathPrefixSize]    number of segment used for grouping, defaults to 2
 * @param {String} version                server version
 * @param {Object} logger                 {@link https://github.com/trentm/node-bunyan|bunyan} compatible logger
 */
exports.exposeDocumentation = async (server, opts, version, logger) => {
  await server.register([
    require('inert'),
    require('vision'),
    {
      plugin: require('hapi-swagger'),
      options: merge({
        info: {version},
        documentationPath: '/documentation',
        jsonPath: '/swagger.json',
        basePath,
        pathPrefixSize: 2
      }, opts)
    }]
  )
  logger.info(`OpenAPI documentation available at ${opts.documentationPath} and descriptor at ${opts.jsonPath}`)
}

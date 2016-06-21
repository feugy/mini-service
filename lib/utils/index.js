const bunyan = require('bunyan')
const {name} = require('../../package.json')

// already created logger
let logger = null

/**
 * Creates or re-use an existing logger
 * @returns {Logger} logger - logger object.
 */
exports.getLogger = () => {
  if (!logger) {
    logger = bunyan.createLogger({
      name,
      streams: [{
        level: 'debug',
        stream: process.stdout
      }]
    })
  }
  return logger
}

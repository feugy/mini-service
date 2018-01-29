const {getLogger} = require('mini-service-utils')

// store logger levels for further restoration
let loggerLevels = null

/**
 * Shutdown (or changes levels of) all logger outputs
 */
exports.shutdownLogger = () => {
  loggerLevels = getLogger().levels()
  getLogger().level(Number.POSITIVE_INFINITY)
}

/**
 * Restore levels of existing logger outputs
 */
exports.restoreLogger = () => {
  for (const {level, i} of loggerLevels.entries()) {
    getLogger().level(i, level)
  }
}

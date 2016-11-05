const {getLogger} = require('../lib/utils')

// store logger levels for further restoration
let loggerLevels = null

/**
 * Shutdown (or changes levels of) all logger outputs
 * @returns {Promise} promise - resolve when logger has been shot down
 */
exports.shutdownLogger = () =>
  new Promise(resolve => {
    loggerLevels = getLogger().levels()
    getLogger().level(Number.POSITIVE_INFINITY)
    resolve()
  })

/**
 * Restore levels of existing logger outputs
 * @returns {Promise} promise - resolve when logger levels have been restored
 */
exports.restoreLogger = () =>
  new Promise(resolve => {
    for (const {level, i} of loggerLevels.entries()) {
      getLogger().level(i, level)
    }
    resolve()
  })

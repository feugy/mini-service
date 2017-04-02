const getClient = require('mini-client')
const calcService = require('./calc-service')

// local client needs service definition
const calc = getClient(calcService)

// after a mandatory initialisation, you can call any exposed API
calc.init().then(() =>
  calc.add(10, 5).then(sum => console.log(`Result is: ${sum}`))
)

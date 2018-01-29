const getClient = require('mini-client')
const calcService = require('./calc-service')

// local client needs service definition
const calc = getClient(calcService)

// async wrapper, only required in global scope
async function main () {
  // after a mandatory initialisation, you can call any exposed API
  await calc.init()
  console.log(`Result is: ${await calc.add(10, 5)}`)
}

main()

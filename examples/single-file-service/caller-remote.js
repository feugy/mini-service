const getClient = require('mini-client')

// remote client needs only service url
const calc = getClient({
  remote: 'http://localhost:3000'
})

// async wrapper, only required in global scope
async function main () {
  // initialisation isn't strictly required (it will be done at first call), but consistent with local mode
  // await calc.init()
  console.log(`Result is: ${await calc.add(10, 5)}`)
}

main()

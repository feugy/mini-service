const getClient = require('mini-client')

// remote client needs only service url
const calc = getClient({
  remote: 'http://localhost:3000'
})

// initialisation isn't strictly required (it will be done at first call), but consistent with local pattern
calc.init().then(() =>
  // then you can call any exposed API
  calc.add(10, 5).then(sum => console.log(`Result is: ${sum}`))
)

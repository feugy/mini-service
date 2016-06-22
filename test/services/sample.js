const Lab = require('lab')
const assert = require('power-assert')
const {init} = require('../fixtures/sample')

const lab = exports.lab = Lab.script()
const {describe, it, before} = lab

describe('Sample service', () => {

  let service

  before(() =>
    init().then(exposed => {
      service = exposed
    })
  )

  it('should respond to ping', () =>
    service.ping()
      .then(result => {
        assert(result.time instanceof Date)
      })
  )

  it('should greet people', () =>
    service.greeting('Peter')
      .then(result => {
        assert.equal(result, 'Hello Peter !')
      })
  )
})

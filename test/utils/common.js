const Lab = require('lab')
const assert = require('power-assert')
const utils = require('../../lib/utils')

const lab = exports.lab = Lab.script()
const {describe, it} = lab

describe('Utilities', () => {

  describe('getParamNames', () => {

    it('should fails on null', done => {
      assert.throws(() => utils.getParamNames(null), /unsupported function null/)
      done()
    })

    it('should fails on undefined', done => {
      assert.throws(() => utils.getParamNames(), /unsupported function undefined/)
      done()
    })

    it('should fails on object', done => {
      assert.throws(() => utils.getParamNames({}), /unsupported function \[object Object\]/)
      done()
    })

    it('should fails on rest parameter', done => {
      assert.throws(() => utils.getParamNames((...args) => {}), /unsupported function \(\.\.\.args\)/)
      done()
    })

    it('should handle typical function', done => {
      const obj = {
        ping() {
          return Promise.resolve({time: new Date()})
        }
      }
      assert.deepEqual(utils.getParamNames(obj.ping), [])
      done()
    })

    it('should handle empty function declaration', done => {
      /* eslint prefer-arrow-callback: 0, no-empty-function: 0 */
      function declared() {}
      assert.deepEqual(utils.getParamNames(declared), [])
      done()
    })

    it('should handle empty anonymous function', done => {
      /* eslint prefer-arrow-callback: 0, no-empty-function: 0 */
      assert.deepEqual(utils.getParamNames(function() {}), [])
      done()
    })

    it('should handle named function', done => {
      /* eslint prefer-arrow-callback: 0, no-empty-function: 0 */
      assert.deepEqual(utils.getParamNames(function named() {}), [])
      done()
    })

    it('should handle empty arrow function', done => {
      /* eslint no-empty-function: 0 */
      assert.deepEqual(utils.getParamNames(() => {}), [])
      done()
    })

    it('should handle function declaration with single parameter', done => {
      /* eslint prefer-arrow-callback: 0, no-empty-function: 0 */
      function declared(a) {}
      assert.deepEqual(utils.getParamNames(declared), ['a'])
      done()
    })

    it('should handle anonymous function with single parameter', done => {
      /* eslint prefer-arrow-callback: 0, no-empty-function: 0, no-unused-vars:0 */
      assert.deepEqual(utils.getParamNames(function(a) {}), ['a'])
      done()
    })

    it('should handle named function with single parameter', done => {
      /* eslint prefer-arrow-callback: 0, no-empty-function: 0, no-unused-vars:0 */
      assert.deepEqual(utils.getParamNames(function named(a) {}), ['a'])
      done()
    })

    it('should handle empty arrow function with single parameter', done => {
      /* eslint no-empty-function: 0, no-unused-vars:0 */
      assert.deepEqual(utils.getParamNames(a => {}), ['a'])
      done()
    })

    it('should handle function declaration with multiple parameter', done => {
      /* eslint prefer-arrow-callback: 0, no-empty-function: 0 */
      function declared(a, b, c) {}
      assert.deepEqual(utils.getParamNames(declared), ['a', 'b', 'c'])
      done()
    })

    it('should handle anonymous function with multiple parameters', done => {
      /* eslint prefer-arrow-callback: 0, no-empty-function: 0, no-unused-vars:0 */
      assert.deepEqual(utils.getParamNames(function(a, b, c) {}), ['a', 'b', 'c'])
      done()
    })

    it('should handle named function with multiple parameters', done => {
      /* eslint prefer-arrow-callback: 0, no-empty-function: 0, no-unused-vars:0 */
      assert.deepEqual(utils.getParamNames(function named(a, b, c) {}), ['a', 'b', 'c'])
      done()
    })

    it('should handle empty arrow function with multiple parameters', done => {
      /* eslint no-empty-function: 0, no-unused-vars:0 */
      assert.deepEqual(utils.getParamNames((a, b, c) => {}), ['a', 'b', 'c'])
      done()
    })

    it('should handle function declaration with default values', done => {
      /* eslint prefer-arrow-callback: 0, no-empty-function: 0 */
      function declared(a, b, c = false) {}
      assert.deepEqual(utils.getParamNames(declared), ['a', 'b', 'c'])
      done()
    })

    it('should handle anonymous function with default values', done => {
      /* eslint prefer-arrow-callback: 0, no-empty-function: 0, no-unused-vars:0 */
      assert.deepEqual(utils.getParamNames(function(a, b, c = 10) {}), ['a', 'b', 'c'])
      done()
    })

    it('should handle named function with default values', done => {
      /* eslint prefer-arrow-callback: 0, no-empty-function: 0, no-unused-vars:0 */
      assert.deepEqual(utils.getParamNames(function named(a, b, c = null) {}), ['a', 'b', 'c'])
      done()
    })

    it('should handle empty arrow function with default values', done => {
      /* eslint no-empty-function: 0, no-unused-vars:0 */
      assert.deepEqual(utils.getParamNames((a, b, c = []) => {}), ['a', 'b', 'c'])
      done()
    })
  })
})

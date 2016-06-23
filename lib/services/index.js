module.exports = [{
  name: 'calc',
  init: () =>
    /* $lab:coverage:off$ */
    Promise.resolve({
      add: (a, b) => Promise.resolve(a + b),
      subtract: (a, b) => Promise.resolve(a - b)
    })
    /* $lab:coverage:on$ */
}]

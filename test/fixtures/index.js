// contains all services to be exposed, as an array of object with name, register properties
const services = ['sample']

module.exports = services.map(name =>
  Object.assign({name}, require(`./${name}`))
)

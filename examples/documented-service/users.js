const Joi = require('joi')

module.exports = {
  name: 'users',
  init: () => {
    const cache = {}

    const apis = {
      list: (rank = 0, size = 10) =>
        Object.keys(cache)
          .filter((id, i) => i >= rank && i < rank + size)
          .map(id => cache[id]),

      save: user => {
        if (!user.id) {
          user.id = Math.floor(Math.random() * 1000)
        }
        cache[user.id] = user
        return user
      },

      remove: id => {
        cache[id] = undefined
      }
    }

    apis.list.validate = [
      Joi.number().min(0).default(0)
        .description('rank of first returned item'),
      Joi.number().min(1).default(10)
        .description('maximal size of returned list')
    ]
    apis.list.description = 'Paginated list of cached users.'
    apis.list.notes = 'Insertion order is used.'

    apis.save.validate = [
      Joi.object().keys({
        id: Joi.number()
          .description('user id, generated if not provided'),
        name: Joi.string().required()
          .description('user name').example('Mary')
      }).required().unknown()
        .label('User').description('saved user. Will update existing user if id already exists')
    ]
    apis.save.description = 'Adds new or updates existing user in cache, based on id.'

    apis.remove.validate = [
      Joi.number().required()
        .description('removed user id').example(1)
    ]
    apis.remove.description = 'Removes existing user in cache, based on id.'
    apis.remove.notes = 'Does nothing if id cannot be found.'

    return apis
  }
}

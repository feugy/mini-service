const Joi = require('joi')

module.exports = {
  name: 'users',
  init: () => {
    const cache = {}

    const userSchema = Joi.object().keys({
      id: Joi.number().required().description('user id'),
      name: Joi.string().required()
        .description('user name').example('Mary')
    }).required().unknown().label('User')

    const list = (rank = 0, size = 10) =>
      Object.keys(cache)
        .filter((id, i) => i >= rank && i < rank + size)
        .map(id => cache[id])

    list.description = 'Paginated list of cached users.'
    list.notes = 'Insertion order is used.'
    list.validate = [
      Joi.number().min(0).default(0)
        .description('rank of first returned item'),
      Joi.number().min(1).default(10)
        .description('maximal size of returned list')
    ]
    list.responseSchema = Joi.array().required().items(userSchema)
      .description('list (may be empty) of users')

    const save = user => {
      if (!user.id) {
        user.id = Math.floor(Math.random() * 1000)
      }
      cache[user.id] = user
      return user
    }

    save.description = 'Adds new or updates existing user in cache, based on id.'
    save.validate = [
      userSchema.keys({
        id: Joi.number().description('user id, generated if not provided')
      })
    ]
    save.responseSchema = userSchema.description('saved user')

    const remove = id => {
      cache[id] = undefined
    }

    remove.description = 'Removes existing user in cache, based on id.'
    remove.notes = 'Does nothing if id cannot be found.'
    remove.validate = [
      Joi.number().required()
        .description('removed user id').example(1)
    ]

    return {list, save, remove}
  }
}

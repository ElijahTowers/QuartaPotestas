/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // add field
  collection.fields.addAt(13, new Field({
    "hidden": false,
    "id": "readers_field",
    "max": null,
    "min": null,
    "name": "readers",
    "onlyInt": false,
    "presentable": true,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(14, new Field({
    "hidden": false,
    "id": "credibility_field",
    "max": null,
    "min": null,
    "name": "credibility",
    "onlyInt": false,
    "presentable": true,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // remove field
  collection.fields.removeById("readers_field")

  // remove field
  collection.fields.removeById("credibility_field")

  return app.save(collection)
})

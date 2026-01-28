/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // add field
  collection.fields.addAt(11, new Field({
    "hidden": false,
    "id": "treasury_field",
    "max": null,
    "min": null,
    "name": "treasury",
    "onlyInt": false,
    "presentable": true,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "hidden": false,
    "id": "purchased_upgrades_field",
    "maxSize": 0,
    "name": "purchased_upgrades",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // remove field
  collection.fields.removeById("treasury_field")

  // remove field
  collection.fields.removeById("purchased_upgrades_field")

  return app.save(collection)
})

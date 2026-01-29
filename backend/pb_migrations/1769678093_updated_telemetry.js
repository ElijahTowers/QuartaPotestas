/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2839269605")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\""
  }, collection)

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text118222445",
    "max": 0,
    "min": 0,
    "name": "visitor_id",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2839269605")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.type = \"admin\"",
    "viewRule": "@request.auth.type = \"admin\""
  }, collection)

  // remove field
  collection.fields.removeById("text118222445")

  return app.save(collection)
})

/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("articles") || app.findCollectionByNameOrId("pbc_4287850865")

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3834026137",
    "max": 0,
    "min": 0,
    "name": "original_title",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("articles") || app.findCollectionByNameOrId("pbc_4287850865")

  // remove field
  collection.fields.removeById("text3834026137")

  return app.save(collection)
})

/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("articles") || app.findCollectionByNameOrId("pbc_4287850865")

  // add field
  collection.fields.addAt(12, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "assistant_comment_field",
    "max": 0,
    "min": 0,
    "name": "assistant_comment",
    "pattern": "",
    "presentable": true,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("articles") || app.findCollectionByNameOrId("pbc_4287850865")

  // remove field
  collection.fields.removeById("assistant_comment_field")

  return app.save(collection)
})

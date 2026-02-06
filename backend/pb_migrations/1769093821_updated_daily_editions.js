/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("daily_editions") || app.findCollectionByNameOrId("pbc_189460901")
    if (!collection || collection.fields.getById("relation1780202391")) return
    collection.fields.addAt(Math.min(4, collection.fields.length), new Field({
      "cascadeDelete": false,
      "collectionId": "_pb_users_auth_",
      "hidden": false,
      "id": "relation1780202391",
      "maxSelect": 1,
      "minSelect": 0,
      "name": "test_user_relation2",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "relation"
    }))
    return app.save(collection)
  } catch (_) {}
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("daily_editions") || app.findCollectionByNameOrId("pbc_189460901")
    if (!collection || !collection.fields.getById("relation1780202391")) return
    collection.fields.removeById("relation1780202391")
    return app.save(collection)
  } catch (_) {}
})

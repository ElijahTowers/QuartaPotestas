/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("daily_editions") || app.findCollectionByNameOrId("pbc_189460901")
    if (!collection || collection.fields.getById("relation2375276105")) return
    collection.fields.addAt(Math.min(3, collection.fields.length), new Field({
      "cascadeDelete": false,
      "collectionId": "_pb_users_auth_",
      "hidden": false,
      "id": "relation2375276105",
      "maxSelect": 1,
      "minSelect": 0,
      "name": "user",
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
    if (!collection || !collection.fields.getById("relation2375276105")) return
    collection.fields.removeById("relation2375276105")
    return app.save(collection)
  } catch (_) {}
})

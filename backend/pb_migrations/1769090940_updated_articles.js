/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("pbc_4287850865") || app.findCollectionByNameOrId("articles")
    const dailyEditions = app.findCollectionByNameOrId("daily_editions")
    if (!collection || !dailyEditions) return
    if (collection.fields.getById("relation2311841597")) return

    const idx = Math.min(9, collection.fields.length)
    collection.fields.addAt(idx, new Field({
      "cascadeDelete": true,
      "collectionId": dailyEditions.id,
      "hidden": false,
      "id": "relation2311841597",
      "maxSelect": 1,
      "minSelect": 0,
      "name": "daily_edition_id",
      "presentable": false,
      "required": true,
      "system": false,
      "type": "relation"
    }))
    return app.save(collection)
  } catch (_) {
    // Skip if schema doesn't match (e.g. different migration order or existing data)
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("pbc_4287850865") || app.findCollectionByNameOrId("articles")
    if (!collection || !collection.fields.getById("relation2311841597")) return
    collection.fields.removeById("relation2311841597")
    return app.save(collection)
  } catch (_) {}
})

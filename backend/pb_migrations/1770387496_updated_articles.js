/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("articles") || app.findCollectionByNameOrId("pbc_4287850865")
  if (!collection || collection.fields.getById("url2776776943")) return

  collection.fields.addAt(Math.min(14, collection.fields.length), new Field({
    "exceptDomains": null,
    "hidden": false,
    "id": "url2776776943",
    "name": "source_url",
    "onlyDomains": null,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "url"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("articles") || app.findCollectionByNameOrId("pbc_4287850865")
  if (!collection || !collection.fields.getById("url2776776943")) return
  collection.fields.removeById("url2776776943")
  return app.save(collection)
})

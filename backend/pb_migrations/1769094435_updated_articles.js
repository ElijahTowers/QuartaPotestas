/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
  const collection = app.findCollectionByNameOrId("articles") || app.findCollectionByNameOrId("pbc_4287850865")
  if (!collection) return
  unmarshal({
    "createRule": "",
    "deleteRule": "",
    "listRule": "",
    "updateRule": "",
    "viewRule": ""
  }, collection)
  return app.save(collection)
  } catch (_) {}
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("articles") || app.findCollectionByNameOrId("pbc_4287850865")
  if (!collection) return
  unmarshal({
    "createRule": "@request.auth.id != \"\" && user = @request.auth.id",
    "deleteRule": "user = @request.auth.id",
    "listRule": "user = @request.auth.id",
    "updateRule": "user = @request.auth.id",
    "viewRule": "user = @request.auth.id"
  }, collection)
  return app.save(collection)
  } catch (_) {}
})

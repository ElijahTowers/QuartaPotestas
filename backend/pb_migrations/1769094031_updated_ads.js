/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
  const collection = app.findCollectionByNameOrId("ads") || app.findCollectionByNameOrId("pbc_1911549009")
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
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("ads") || app.findCollectionByNameOrId("pbc_1911549009")
  if (!collection) return
  unmarshal({
    "createRule": null,
    "deleteRule": null,
    "listRule": null,
    "updateRule": null,
    "viewRule": null
  }, collection)
  return app.save(collection)
  } catch (_) {}
})

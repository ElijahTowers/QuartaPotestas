/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1097676670")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\" || @request.auth.id = \"\"",
    "viewRule": "user = @request.auth.id || @request.auth.id = \"\""
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1097676670")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "user = @request.auth.id"
  }, collection)

  return app.save(collection)
})

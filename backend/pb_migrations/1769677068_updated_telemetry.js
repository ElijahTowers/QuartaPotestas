/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2839269605")

  // update collection data
  unmarshal({
    "createRule": ""
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2839269605")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id != \"\" || @request.auth.type = \"admin\""
  }, collection)

  return app.save(collection)
})

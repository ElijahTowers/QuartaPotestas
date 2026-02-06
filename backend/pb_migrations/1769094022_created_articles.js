/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const dailyEditions = app.findCollectionByNameOrId("daily_editions") || app.findCollectionByNameOrId("pbc_189460901");
    if (!dailyEditions || app.findCollectionByNameOrId("articles")) return;
  const collection = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
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
      },
      {
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
      },
      {
        "hidden": false,
        "id": "json609877699",
        "maxSize": 0,
        "name": "processed_variants",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "json1874629670",
        "maxSize": 0,
        "name": "tags",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "number4107308800",
        "max": null,
        "min": null,
        "name": "location_lat",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "number2536594420",
        "max": null,
        "min": null,
        "name": "location_lon",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text2908731252",
        "max": 0,
        "min": 0,
        "name": "location_city",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "date2862495610",
        "max": "",
        "min": "",
        "name": "date",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "date"
      },
      {
        "hidden": false,
        "id": "date3772055009",
        "max": "",
        "min": "",
        "name": "published_at",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      }
    ],
    "id": "pbc_4287850865",
    "indexes": [],
    "listRule": null,
    "name": "articles",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": null
  });

  return app.save(collection);
  } catch (_) {}
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("pbc_4287850865") || app.findCollectionByNameOrId("articles");
  if (!collection) return;
  return app.delete(collection);
  } catch (_) {}
})

/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2260351736")

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3018627582",
    "max": 0,
    "min": 0,
    "name": "achievement_id",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(2, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1579384326",
    "max": 0,
    "min": 0,
    "name": "name",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(3, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1843675174",
    "max": 0,
    "min": 0,
    "name": "description",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "select105650625",
    "maxSelect": 0,
    "name": "category",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "publishing",
      "financial",
      "readers",
      "credibility",
      "factions",
      "shop",
      "streaks",
      "special",
      "general"
    ]
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "select3082862150",
    "maxSelect": 0,
    "name": "rarity",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "common",
      "uncommon",
      "rare",
      "epic",
      "legendary"
    ]
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "number666537513",
    "max": null,
    "min": null,
    "name": "points",
    "onlyInt": false,
    "presentable": false,
    "required": true,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2260351736")

  // remove field
  collection.fields.removeById("text3018627582")

  // remove field
  collection.fields.removeById("text1579384326")

  // remove field
  collection.fields.removeById("text1843675174")

  // remove field
  collection.fields.removeById("select105650625")

  // remove field
  collection.fields.removeById("select3082862150")

  // remove field
  collection.fields.removeById("number666537513")

  return app.save(collection)
})

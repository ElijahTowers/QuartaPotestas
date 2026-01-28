#!/bin/bash
# Start PocketBase server
# This will create a pb_data folder for the database

cd "$(dirname "$0")"
./pocketbase serve


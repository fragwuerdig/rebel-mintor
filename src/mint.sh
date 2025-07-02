#!/bin/bash

# Check if input parameters are provided
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Usage: $0 <server_url> <receiver> <asset>"
    exit 1
fi

SERVER_BASE="$1"
RECEIVER="$2"
ASSET="$3"


# Make a POST request to the server with JSON body
curl -X POST "$SERVER_BASE/v1/mint/$ASSET" \
    -H "Content-Type: application/json" \
    -d "{\"receiver\":\"$RECEIVER\"}"
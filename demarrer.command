#!/bin/bash
cd "$(dirname "$0")"
echo "Démarrage de Maison SCouvenir..."
(sleep 2 && open http://localhost:3000) &
node --no-warnings server.js

#!/bin/bash

API_URL="http://localhost"

# Couleurs pour les logs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo " 🔵 Testing game routes..."

# Création du premier utilisateur
echo -e "\n 1️⃣  Creating first user..."
RESPONSE1=$(curl -s -X POST "$API_URL/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"player1", "password":"pass1"}')

if [[ $RESPONSE1 == *"success"* ]]; then
    echo -e "${GREEN}✓ Player1 created successfully${NC}"
else
    echo -e "${RED}✗ Failed to create player1${NC}"
    echo $RESPONSE1
fi

# Création du second utilisateur
echo -e "\n 2️⃣  Creating second user..."
RESPONSE2=$(curl -s -X POST "$API_URL/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"player2", "password":"pass2"}')

if [[ $RESPONSE2 == *"success"* ]]; then
    echo -e "${GREEN}✓ Player2 created successfully${NC}"
else
    echo -e "${RED}✗ Failed to create player2${NC}"
    echo $RESPONSE2
fi

# Création d'un utilisateur avec le meme username
echo -e "\n 2️⃣  Creating of user with same username..."
RESPONSE2=$(curl -s -X POST "$API_URL/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"player2", "password":"pass2"}')

if [[ $RESPONSE2 == *"success"* ]]; then
    echo -e "${RED}✗ Player2 created successfully, it shouldn't be created because already exist${NC}"
else
    echo -e "${GREEN}✓ Failed to create player2 already exist${NC}"
    echo $RESPONSE2
fi

# Ajout d'une partie dans l'historique
echo -e "\n 🎮 Adding game to history..."
RESPONSE3=$(curl -s -X POST "$API_URL/user/history" \
  -H "Content-Type: application/json" \
  -d '{
    "player1_id": 1,
    "player2_id": 2,
    "score_player1": 5,
    "score_player2": 8,
    "winner_id": 2
  }')

if [[ $RESPONSE3 == *"success"* ]]; then
    echo -e "${GREEN}✓ Game history added successfully${NC}"
else
    echo -e "${RED}✗ Failed to add game history${NC}"
    echo $RESPONSE3
fi

# Vérification du leaderboard
echo -e "\n 🏆 Checking leaderboard..."
RESPONSE4=$(curl -s -X GET "$API_URL/leaderboard")
if [[ $RESPONSE4 == *"success"* ]]; then
    echo -e "${GREEN}✓ leaderboard OK${NC}"
else
    echo -e "${RED}✗ leaderboard NOT OK${NC}"
    echo $RESPONSE4
fi
echo -e "\nLeaderboard response:"
echo $RESPONSE4 | json_pp

# Test de désinscription avec mauvais mot de passe
echo -e "\n 🔑 Testing unregister with wrong password..."
RESPONSE5=$(curl -s -X POST "$API_URL/unregister" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "player1",
    "password": "wrongpass"
  }')

if [[ $RESPONSE5 == *"Invalid password"* ]]; then
    echo -e "${GREEN}✓ Wrong password correctly rejected${NC}"
else
    echo -e "${RED}✗ Wrong password validation failed${NC}"
    echo $RESPONSE5
fi

# Test de désinscription avec bon mot de passe
echo -e "\n 🗑️  Testing unregister with correct password..."
RESPONSE6=$(curl -s -X POST "$API_URL/unregister" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "player1",
    "password": "pass1"
  }')

if [[ $RESPONSE6 == *"success"* ]]; then
    echo -e "${GREEN}✓ Player1 unregistered successfully${NC}"
else
    echo -e "${RED}✗ Failed to unregister player1${NC}"
    echo $RESPONSE6
fi

# Vérification de l'existence de l'utilisateur après suppression
echo -e "\n 🔍 Checking if user still exists..."
RESPONSE7=$(curl -s -X GET "$API_URL/isUser/player1")
if [[ $RESPONSE7 == *"\"exists\":false"* ]]; then
    echo -e "${GREEN}✓ User correctly removed from database${NC}"
else
    echo -e "${RED}✗ User still exists in database${NC}"
    echo $RESPONSE7
fi

# Vérification du leaderboard après suppression
echo -e "\n 🏆 Checking updated leaderboard..."
RESPONSE8=$(curl -s -X GET "$API_URL/leaderboard")
if [[ $RESPONSE8 == *"success"* ]]; then
    echo -e "${GREEN}✓ Leaderboard still accessible${NC}"
    echo -e "\nUpdated leaderboard:"
    echo $RESPONSE8 | json_pp
else
    echo -e "${RED}✗ Failed to get updated leaderboard${NC}"
    echo $RESPONSE8
fi

echo -e "\n✨ Tests completed!"

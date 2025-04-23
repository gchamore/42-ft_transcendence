#!/bin/bash

API_URL="https://10.32.7.11:8443"

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

# Récupération de l'ID du player1
echo -e "\n 🔍 Getting player1 ID..."
ID_RESPONSE_1=$(curl -s -X POST "$API_URL/getUserId" \
  -H "Content-Type: application/json" \
  -d '{"username":"player1"}')

if [[ $ID_RESPONSE_1 == *"success"* ]]; then
    PLAYER1_ID=$(echo $ID_RESPONSE_1 | jq -r '.id')
    echo -e "${GREEN}✓ Got player1 ID: $PLAYER1_ID${NC}"
else
    echo -e "${RED}✗ Failed to get player1 ID${NC}"
    echo $ID_RESPONSE_1
    exit 1
fi

# Récupération de l'ID du player2
echo -e "\n 🔍 Getting player2 ID..."
ID_RESPONSE_2=$(curl -s -X POST "$API_URL/getUserId" \
  -H "Content-Type: application/json" \
  -d '{"username":"player2"}')

if [[ $ID_RESPONSE_2 == *"success"* ]]; then
    PLAYER2_ID=$(echo $ID_RESPONSE_2 | jq -r '.id')
    echo -e "${GREEN}✓ Got player2 ID: $PLAYER2_ID${NC}"
else
    echo -e "${RED}✗ Failed to get player2 ID${NC}"
    echo $ID_RESPONSE_2
    exit 1
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

# Test de login pour player1
echo -e "\n 🔑 Testing login..."
LOGIN_RESPONSE_1=$(curl -s -X POST "$API_URL/login" \
  -c cookies_p1.txt \
  -H "Content-Type: application/json" \
  -d '{
    "username": "player1",
    "password": "pass1"
  }')

if [[ $LOGIN_RESPONSE_1 == *"success"* ]]; then
    echo -e "${GREEN}✓ Login successful${NC}"
else
    echo -e "${RED}✗ Login failed${NC}"
    echo $LOGIN_RESPONSE_1
    exit 1
fi

# Test de login pour player2
echo -e "\n 🔑 Testing login..."
LOGIN_RESPONSE_2=$(curl -s -X POST "$API_URL/login" \
  -c cookies_p2.txt \
  -H "Content-Type: application/json" \
  -d '{
    "username": "player2",
    "password": "pass2"
  }')

if [[ $LOGIN_RESPONSE_2 == *"success"* ]]; then
    echo -e "${GREEN}✓ Login successful${NC}"
else
    echo -e "${RED}✗ Login failed${NC}"
    echo $LOGIN_RESPONSE_2
    exit 1
fi

# Test de la route protégée
echo -e "\n 🔒 Testing protected route..."
PROTECTED_RESPONSE_1=$(curl -s -X GET "$API_URL/protected" \
  -b cookies_p1.txt)

if [[ $PROTECTED_RESPONSE_1 == *"protected information"* ]]; then
    echo -e "${GREEN}✓ Protected route accessible${NC}"
else
    echo -e "${RED}✗ Protected route access failed${NC}"
    echo $PROTECTED_RESPONSE_1
fi

# Test de la route protégée pour player2
echo -e "\n 🔒 Testing protected route..."
PROTECTED_RESPONSE_2=$(curl -s -X GET "$API_URL/protected" \
  -b cookies_p2.txt)  # Utiliser les cookies au lieu du header Authorization

if [[ $PROTECTED_RESPONSE_2 == *"protected information"* ]]; then
    echo -e "${GREEN}✓ Protected route accessible${NC}"
else
    echo -e "${RED}✗ Protected route access failed${NC}"
    echo $PROTECTED_RESPONSE_2
fi

# Test de vérification du token
echo -e "\n 🔍 Testing token verification player 1..."
VERIFY_RESPONSE_1=$(curl -s -X POST "$API_URL/verify_token" \
  -b cookies_p1.txt)

if [[ $VERIFY_RESPONSE_1 == *"\"valid\":true"* ]]; then
    echo -e "${GREEN}✓ Token verified successfully${NC}"
else
    echo -e "${RED}✗ Token verification failed${NC}"
    echo $VERIFY_RESPONSE_1
fi

# Test de vérification du token
echo -e "\n 🔍 Testing token verification player 2..."
VERIFY_RESPONSE_2=$(curl -s -X POST "$API_URL/verify_token" \
  -b cookies_p2.txt)  # Utiliser les cookies au lieu du header Authorization

if [[ $VERIFY_RESPONSE_2 == *"\"valid\":true"* ]]; then
    echo -e "${GREEN}✓ Token verified successfully${NC}"
else
    echo -e "${RED}✗ Token verification failed${NC}"
    echo $VERIFY_RESPONSE_2
fi

echo "Player1 ID: $PLAYER1_ID"
echo "Player2 ID: $PLAYER2_ID"


# Ajout d'une partie dans l'historique avec les IDs dynamiques
echo -e "\n 🎮 Adding game..."
GAME_DATA="{\"player1_id\":\"$PLAYER1_ID\",\"player2_id\":\"$PLAYER2_ID\",\"score_player1\":5,\"score_player2\":8,\"winner_id\":\"$PLAYER2_ID\"}"
RESPONSE3=$(curl -s -X POST "$API_URL/user/game" \
  -b cookies_p2.txt \
  -H "Content-Type: application/json" \
  -d "$GAME_DATA")

if [[ $RESPONSE3 == *"success"* ]]; then
    echo -e "${GREEN}✓ Game added successfully${NC}"
else
    echo -e "${RED}✗ Failed to add game${NC}"
    echo $RESPONSE3
fi

# Vérification du leaderboard
echo -e "\n 🏆 Checking leaderboard..."
RESPONSE4=$(curl -s -X GET "$API_URL/leaderboard" \
  -H "Authorization: Bearer $ACCESS_TOKEN_2")  # Utiliser le token du player2
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
RESPONSE8=$(curl -s -X GET "$API_URL/leaderboard" \
  -H "Authorization: Bearer $ACCESS_TOKEN_2")  # Utiliser le token du player2
if [[ $RESPONSE8 == *"success"* ]]; then
    echo -e "${GREEN}✓ Leaderboard still accessible${NC}"
    echo -e "\nUpdated leaderboard:"
    echo $RESPONSE8 | json_pp
else
    echo -e "${RED}✗ Failed to get updated leaderboard${NC}"
    echo $RESPONSE8
fi

# Test de déconnexion pour player1
echo -e "\n 🚪 Testing logout for player1..."
LOGOUT_RESPONSE_1=$(curl -s -X POST "$API_URL/logout" \
  -b cookies_p1.txt)

if [[ $LOGOUT_RESPONSE_1 == *"success"* ]]; then
    echo -e "${GREEN}✓ Logout successful${NC}"
else
    echo -e "${RED}✗ Logout failed${NC}"
    echo $LOGOUT_RESPONSE_1
fi

# Test de déconnexion pour player2
echo -e "\n 🚪 Testing logout for player2..."
LOGOUT_RESPONSE_2=$(curl -s -X POST "$API_URL/logout" \
  -b cookies_p2.txt)  # Utiliser les cookies au lieu du header Authorization

if [[ $LOGOUT_RESPONSE_2 == *"success"* ]]; then
    echo -e "${GREEN}✓ Logout successful${NC}"
else
    echo -e "${RED}✗ Logout failed${NC}"
    echo $LOGOUT_RESPONSE_2
fi

# Vérification que le token n'est plus valide après déconnexion
echo -e "\n 🔍 Verifying token invalidation after logout..."
VERIFY_AFTER_LOGOUT_1=$(curl -s -X POST "$API_URL/verify_token" \
  -b cookies_p1.txt)

if [[ $VERIFY_AFTER_LOGOUT_1 == *"\"valid\":false"* ]]; then
    echo -e "${GREEN}✓ Token correctly invalidated${NC}"
else
    echo -e "${RED}✗ Token still valid after logout${NC}"
    echo $VERIFY_AFTER_LOGOUT_1
fi

# Vérification que le token n'est plus valide après déconnexion
echo -e "\n 🔍 Verifying token invalidation after logout..."
VERIFY_AFTER_LOGOUT_2=$(curl -s -X POST "$API_URL/verify_token" \
  -b cookies_p2.txt)  # Utiliser les cookies au lieu du header Authorization

if [[ $VERIFY_AFTER_LOGOUT_2 == *"\"valid\":false"* ]]; then
    echo -e "${GREEN}✓ Token correctly invalidated${NC}"
else
    echo -e "${RED}✗ Token still valid after logout${NC}"
    echo $VERIFY_AFTER_LOGOUT_2
fi

# Nettoyage des fichiers de cookies à la fin
rm -f cookies_p1.txt cookies_p2.txt

echo -e "\n✨ Tests completed!"

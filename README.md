# 🎮 ft_transcendence

## 🚀 Présentation

**ft_transcendence** est un projet développé dans le cadre du cursus de l'école **42**, visant à créer une **application web** permettant aux utilisateurs de jouer au célèbre jeu **Pong** en **temps réel**, avec un mode **multijoueur en ligne** et un **système de tournois**.

Le projet est conçu comme un **site web single-page (SPA)**, combinant **frontend moderne**, **backend robuste**, et **communication en temps réel** via **WebSockets**.

---

## 🛠️ Fonctionnalités

### **✅ Fonctionnalités Obligatoires (Mandatory Features)**

- 🎮 **Jeu de Pong en ligne** (1v1 sur le même clavier).  
- 🏆 **Système de tournois** avec matchmaking automatique.  
- 🔐 **Authentification & Gestion des utilisateurs** (alias temporaires pour les tournois).  
- 📊 **Aucune erreur critique** ne doit être présente sur le site.  
- 🌍 **Compatibilité avec Mozilla Firefox (dernière version stable)**.  
- 🐳 **Déploiement via Docker** avec une seule commande pour exécuter le projet.  
- 🔒 **Sécurité des données et des connexions** (HTTPS obligatoire, validation des entrées utilisateurs).  

---

### **📌 Modules (Fonctionnalités Additionnelles)**  

#### 🟢 Modules Majeurs ✅  
- ✅ Utilisation d’un framework backend (Fastify, Node.js) **GREG**
- ✅ Gestion complète des utilisateurs (authentification, avatars, stats, amis) **ALEX on front** & **GREG on back**
- ✅ Sécurisation avancée (JWT, 2FA) **ALEX on front** & **GREG on back**
- ✅ Authentification Google (OAuth) **ALEX on front** & **GREG on back**
- ✅ Remote player (matchs en ligne, WebSocket) **ANTO**
- ✅ Live chat (public + privé, temps réel) **ALEX on front** & **GREG on back**
- ✅ Intégration BabylonJS (rendu 3D du jeu) **ANTO**

#### 🟡 Modules Mineurs ✅  
- ✅ Personnalisation du jeu (Game Customization)  **ANTO**
- ✅ Utilisation d’une base de données (SQLite)  **GREG**
- ✅ Compatibilité navigateur (Browser Compatibility)  **ALEX** **ANTO** **GREG**
- ✅ Conformité RGPD (mentions légales, gestion des données)  **GREG**
- ✅ Multi-device sur téléphone (responsive + synchronisation de session)  **ALEX**

---

## 📌 Technologies Utilisées

### **Frontend**
- TypeScript (vanilla, sans framework)
- Tailwind CSS (UI responsive)
- WebSockets (chat, matchmaking, jeu en temps réel)
- Google OAuth 2.0 (connexion via compte Google)
- BabylonJS (rendu 3D du jeu dans le navigateur)

### **Backend**
- Node.js avec Fastify (serveur API REST & WebSocket)
- SQLite (base de données légère embarquée)
- JWT (authentification sécurisée par token)
- 2FA (authentification à deux facteurs via TOTP)
- Docker (conteneurisation et orchestration du projet)

### **Jeu Multijoueur & Communication**
- WebSockets (temps réel pour jeu, matchmaking et chat)
- Architecture orientée événements (gestion des états de partie, joueurs en ligne, etc.)
- Prise en charge du multi-device (desktop/mobile)
- Respect des bonnes pratiques RGPD (gestion des données utilisateurs)

---

## 🧑‍💻 Équipe

👨‍💻 **Frontend :**  Alexandre Autin (Aautin)  
👨‍💻 **Backend :**  Gregoire Chamorel (Gchamore)  
👨‍💻 **Jeu & Multijoueur :**  Antonin Ferre (Anferre)  

---

## 📜 Licence

Ce projet est développé dans le cadre du cursus **42** et suit ses directives pédagogiques.  

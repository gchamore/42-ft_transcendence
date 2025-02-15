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

🟢 Modules Majeurs ✅  
⛔ Utilisation d’un framework backend (Fastify, Node.js) **GREG**  
⛔ Gestion complète des utilisateurs (authentification, avatars, stats, amis) **GREG** & **ALEX**  
⛔ Sécurisation avancée (JWT, 2FA) **GREG**  

🟡 Modules Mineurs ✅  
⛔ Utilisation d’une base de données (SQLite) **GREG**  
⛔ Authentification Google (OAuth) **GREG**  

---

## 📌 Technologies Utilisées

### **Frontend**
- TypeScript
- Tailwind CSS
- WebSockets (temps réel)

### **Backend**
- Node.js avec Fastify
- SQLite (base de données)
- JWT (authentification sécurisée)

### **Jeu Multijoueur & WebSockets**
- Gestion des parties en temps réel
- 

---

## 🏗️ Structure du Projet

/frontend        # Code du client (UI, SPA)  
/backend         # API REST et gestion des utilisateurs  
/game            # Moteur du jeu Pong (logique et multijoueur)  
/infra           # Docker, CI/CD, monitoring et logs  
/docs            # Documentation technique et API  

---

## 📅 Planning sur 6 Semaines

### **🗓️ Semaine 1 : Mise en place des bases**
- **Frontend** : 
- **Backend** : Installation et configuration de Node.js, Fastify, SQLite. Structuration du projet, mise en place de l’API, création de la base de données et des premiers modèles (users, games, friends). Implémentation des routes CRUD pour la gestion des utilisateurs avec sécurisation des mots de passe (bcrypt).  
- **Jeu** : 

### **🗓️ Semaine 2 : Développement des Fondations**
- **Frontend** : 
- **Backend** : Mise en place de JWT pour l’authentification sécurisée et ajout du 2FA via Google Authenticator. Gestion des profils utilisateurs et système d’amis. Développement du matchmaking et des WebSockets pour la gestion des parties en temps réel.  
- **Jeu** : 

### **🗓️ Semaine 3 : Développement des Fonctionnalités Clés**
- **Frontend** : 
- **Backend** : Implémentation de Google OAuth pour l’authentification externe. Sécurisation avancée du serveur (validation des entrées, protection XSS/SQL Injection). Optimisation des requêtes SQLite, mise en place des tests unitaires et d’intégration. Finalisation avec documentation API et logs pour le monitoring.
- **Jeu** : 

### **🗓️ Semaine 4 : Intégration des Modules Avancés**
- **Frontend** : 
- **Backend** : 
- **Jeu** : 

### **🗓️ Semaine 5 : Tests et Optimisation**
- **Frontend** : 
- **Backend** : 
- **Jeu** : 

### **🗓️ Semaine 6 : Finalisation & Préparation à l’Évaluation**
- **Frontend** : 
- **Backend** : 
- **Jeu** : 

---

## 🧑‍💻 Équipe

👨‍💻 **Frontend :**  Alexandre Autin (Aautin)  
👨‍💻 **Backend :**  Gregoire Chamorel (Gchamore)  
👨‍💻 **Jeu & Multijoueur :**  Antonin Ferre (Anferre)  

---

## 📜 Licence

Ce projet est développé dans le cadre du cursus **42** et suit ses directives pédagogiques.  

---

Ce **README** servira de **base** et pourra être **mis à jour** avec les instructions d'installation et d'utilisation. 🚀

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
⛔ Multijoueur à distance (via WebSockets) → Permet aux joueurs de s'affronter en ligne en temps réel.
⛔ Gestion complète des utilisateurs (comptes persistants, avatars, stats, amis) → Création et gestion des profils utilisateurs.
⛔ Chat en direct → Messagerie entre joueurs et notifications des tournois.
⛔ Matchmaking et système de tournois avancé → Organisation automatique des parties avec suivi du classement.
⛔ Mode IA pour jouer contre un bot intelligent → Un adversaire IA simulant un joueur humain.
⛔ Sécurisation avancée (JWT, 2FA, conformité RGPD) → Authentification sécurisée et protection des données.
⛔ Infrastructure de logs avec ELK (Elasticsearch, Logstash, Kibana) → Suivi et stockage des logs serveurs.
⛔ Architecture backend en microservices → Séparation du backend en plusieurs services indépendants.

🟡 Modules Mineurs ✅
⛔ Personnalisation du jeu (skins, vitesse de la balle, power-ups) → Options de personnalisation pour enrichir l’expérience.
⛔ Surveillance des performances et logs (Prometheus & Grafana) → Monitoring du système en temps réel.
⛔ Déploiement CI/CD avec GitHub Actions → Automatisation du build, des tests et du déploiement.
⛔ Compatibilité multi-navigateurs (Chrome, Safari, Edge) → Assurer le bon fonctionnement sur différents navigateurs.
⛔ Support sur tous les appareils (mobiles, tablettes, desktop) → Adaptation du jeu à toutes les résolutions d’écran.
⛔ Support multilingue (français, anglais, etc.) → Interface disponible en plusieurs langues.
⛔ Accessibilité pour malvoyants (contraste, narration, navigation clavier) → Amélioration de l’accessibilité.
⛔ Intégration Server-Side Rendering (SSR) → Optimisation du chargement et du référencement.

---

## 📌 Technologies Utilisées

### **Frontend**
- TypeScript
- Tailwind CSS
- WebSockets (temps réel)

### **Backend**
- Node.js avec Fastify **(ou PHP sans framework)**
- SQLite (base de données)
- JWT (authentification sécurisée)

### **Multijoueur & WebSockets**
- Gestion des parties en temps réel
- Mode CLI pour jouer en ligne depuis un terminal

### **DevOps & Sécurité**
- Docker (déploiement rapide)
- HTTPS & Sécurité WebSockets
- CI/CD (GitHub Actions)
- Monitoring avec Prometheus & Grafana

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
- **Backend** : 
- **Multijoueur** : 
- **DevOps** : 

### **🗓️ Semaine 2 : Développement des Fondations**
- **Frontend** : 
- **Backend** : 
- **Multijoueur** : 
- **DevOps** : 

### **🗓️ Semaine 3 : Développement des Fonctionnalités Clés**
- **Frontend** : 
- **Backend** : 
- **Multijoueur** : 
- **DevOps** : 

### **🗓️ Semaine 4 : Intégration des Modules Avancés**
- **Frontend** : 
- **Backend** : 
- **Multijoueur** : 
- **DevOps** : 

### **🗓️ Semaine 5 : Tests et Optimisation**
- **Frontend** : 
- **Backend** : 
- **Multijoueur** : 
- **DevOps** : 

### **🗓️ Semaine 6 : Finalisation & Préparation à l’Évaluation**
- **Frontend** : 
- **Backend** : 
- **Multijoueur** : 
- **DevOps** : 

---

## 🧑‍💻 Équipe

👨‍💻 **Frontend :** 
👨‍💻 **Backend :** 
👨‍💻 **Jeu & Multijoueur :** 
👨‍💻 **DevOps & Sécurité :** 

---

## 📜 Licence

Ce projet est développé dans le cadre du cursus **42** et suit ses directives pédagogiques.  

---

Ce **README** servira de **base** et pourra être **mis à jour** avec les instructions d'installation et d'utilisation. 🚀

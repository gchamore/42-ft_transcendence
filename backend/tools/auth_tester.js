/**
 * Test automatique du système d'authentification
 * 
 * Ce script teste:
 * 1. L'inscription d'un nouvel utilisateur
 * 2. La connexion avec cet utilisateur
 * 3. La vérification du token d'accès
 */

import axios from 'axios';
const API_URL = 'http://localhost:3000';
import chalk from 'chalk';

// Configuration
const TEST_USER = {
    username: `test_user_${Date.now().toString().slice(-6)}`, // Nom unique à chaque exécution
    password: 'Test123!'
};

// Fonction pour formater et colorer les logs
const log = {
    info: (msg) => console.log(chalk.blue('ℹ️ INFO: ') + msg),
    success: (msg) => console.log(chalk.green('✅ SUCCESS: ') + msg),
    error: (msg) => console.log(chalk.red('❌ ERROR: ') + msg),
    warning: (msg) => console.log(chalk.yellow('⚠️ WARNING: ') + msg),
    debug: (obj, msg = '') => console.log(chalk.gray(`🔍 DEBUG${msg ? ': ' + msg : ''}`), obj)
};

// Configuration pour les requêtes Axios avec gestion des cookies
const axiosInstance = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    timeout: 5000,
    validateStatus: status => true, // Pour ne pas jeter d'erreur sur les codes HTTP d'erreur
    headers: {
        'Content-Type': 'application/json' // Définir le format JSON par défaut
    }
});

// Variable pour stocker les cookies
let cookieJar = [];

// Middleware pour gérer les cookies comme un navigateur
axiosInstance.interceptors.response.use(response => {
    const cookies = response.headers['set-cookie'];
    if (cookies) {
        for (const cookie of cookies) {
            // Extraire le nom et la valeur du cookie
            const [cookiePart] = cookie.split(';');
            const [name, value] = cookiePart.split('=');
            
            // Mettre à jour ou ajouter le cookie
            let found = false;
            for (let i = 0; i < cookieJar.length; i++) {
                if (cookieJar[i].startsWith(`${name}=`)) {
                    cookieJar[i] = `${name}=${value}`;
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                cookieJar.push(`${name}=${value}`);
            }
        }
    }
    
    return response;
});

// Middleware pour envoyer les cookies stockés avec chaque requête
axiosInstance.interceptors.request.use(config => {
    if (cookieJar.length > 0) {
        config.headers.Cookie = cookieJar.join('; ');
    }
    return config;
});

// Fonction principale de test
async function runTests() {
    try {
        log.info('Démarrage des tests d\'authentification');
        log.info('====================================');
        log.info(`Utilisateur de test: ${TEST_USER.username}`);
        
        // Étape 1: Inscription
        log.info('\n📝 ÉTAPE 1: INSCRIPTION');
        const registerResponse = await axiosInstance.post('/register', TEST_USER);
        
        if (registerResponse.status !== 201) {
            log.error(`L'inscription a échoué avec le code ${registerResponse.status}`);
            log.debug(registerResponse.data);
            process.exit(1);
        }
        
        log.success(`Inscription réussie - ID: ${registerResponse.data.id}`);
        log.debug(registerResponse.data, 'Réponse d\'inscription');
        
        // Étape 2: Connexion
        log.info('\n🔑 ÉTAPE 2: CONNEXION');
        const loginResponse = await axiosInstance.post('/login', {
            username: TEST_USER.username,
            password: TEST_USER.password
        });
        
        if (loginResponse.status !== 200) {
            log.error(`La connexion a échoué avec le code ${loginResponse.status}`);
            log.debug(loginResponse.data);
            process.exit(1);
        }
        
        log.success('Connexion réussie');
        log.debug(loginResponse.data, 'Réponse de connexion');
        
        // Afficher les cookies pour déboguer
        log.info('\n🍪 Cookies stockés:');
        for (const cookie of cookieJar) {
            log.info(`  ${cookie}`);
        }
        
        // Étape 3: Vérification du token
        log.info('\n🔒 ÉTAPE 3: VÉRIFICATION DU TOKEN');
        // Envoyer un objet vide comme corps de requête au format JSON
        const verifyResponse = await axiosInstance.post('/verify_token', {});
        
        if (verifyResponse.status !== 200 || !verifyResponse.data.valid) {
            log.error(`La vérification du token a échoué avec le code ${verifyResponse.status}`);
            log.debug(verifyResponse.data);
            process.exit(1);
        }
        
        log.success(`Token vérifié avec succès pour: ${verifyResponse.data.username}`);
        log.debug(verifyResponse.data, 'Réponse de vérification');
        
        // Étape 4: Vérification de l'endpoint /online-users
        log.info('\n👥 ÉTAPE 4: ACCÈS À UNE RESSOURCE PROTÉGÉE');
        const onlineUsersResponse = await axiosInstance.get('/online-users');
        
        if (onlineUsersResponse.status !== 200) {
            log.error(`L'accès à /online-users a échoué avec le code ${onlineUsersResponse.status}`);
            log.debug(onlineUsersResponse.data);
            process.exit(1);
        }
        
        log.success('Accès réussi à la ressource protégée');
        log.debug(onlineUsersResponse.data, 'Utilisateurs en ligne');
        
        // Étape 5: Déconnexion
        log.info('\n🚪 ÉTAPE 5: DÉCONNEXION');
        // Envoyer un objet vide explicitement pour satisfaire la validation du serveur
        const logoutResponse = await axiosInstance.post('/logout', {});
        
        if (logoutResponse.status !== 200) {
            log.error(`La déconnexion a échoué avec le code ${logoutResponse.status}`);
            log.debug(logoutResponse.data);
            process.exit(1);
        }
        
        log.success('Déconnexion réussie');
        
        // Étape 6: Vérifier que le token n'est plus valide
        log.info('\n🔓 ÉTAPE 6: VÉRIFICATION DE L\'INVALIDATION DU TOKEN');
        // Envoyer un objet vide comme corps de requête au format JSON
        const verifyAfterLogoutResponse = await axiosInstance.post('/verify_token', {});
        
        if (verifyAfterLogoutResponse.status === 200 && verifyAfterLogoutResponse.data.valid) {
            log.error('Le token est toujours valide après la déconnexion');
            log.debug(verifyAfterLogoutResponse.data);
            process.exit(1);
        }
        
        log.success('Token correctement invalidé après déconnexion');
        
        // Résumé
        log.info('\n🎉 RÉSUMÉ DES TESTS');
        log.success('Tous les tests ont réussi!');
        log.info('Le système d\'authentification fonctionne correctement');
        
    } catch (error) {
        log.error(`Une erreur s'est produite: ${error.message}`);
        if (error.response) {
            log.debug(error.response.data, 'Réponse du serveur');
        } else {
            log.debug(error);
        }
    }
}

// Exécuter les tests
log.info('Démarrage du testeur d\'authentification...');
log.info(`API cible: ${API_URL}`);

runTests().catch(err => {
    log.error(`Erreur fatale: ${err.message}`);
});

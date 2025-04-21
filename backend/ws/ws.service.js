import authService from '../jwt/services/auth.service.js';
import * as wsUtils from './ws.utils.js';

export class WebSocketService {
    /**
     * Valide le token d'accès pour la connexion WebSocket
     * @param {Object} fastify - Instance Fastify
     * @param {Object} connection - Connexion WebSocket
     * @param {string} accessToken - Token d'accès
     * @returns {Promise<Object|null>} - Informations de validation ou null si invalide
     */
    async validateConnectionToken(fastify, connection, accessToken) {
        if (!accessToken) {
            fastify.log.warn('WebSocket connection attempt without access token');
            connection.socket.close(1008, 'No access token provided');
            return null;
        }

        const validation = await wsUtils.validateWebSocketToken(accessToken);
        if (!validation?.userId) {
            fastify.log.warn('WebSocket connection attempt with invalid token');
            connection.socket.close(1008, 'Invalid access token');
            return null;
        }
        
        return validation;
    }
    
    /**
     * Génère un ID unique pour la connexion
     * @returns {string} - ID de connexion unique
     */
    generateConnectionId() {
        return Date.now().toString() + '-' + Math.random().toString(36).substring(2, 7);
    }
    
    /**
     * Gère les connexions existantes pour un utilisateur
     * @param {Object} fastify - Instance Fastify
     * @param {number|string} userId - ID de l'utilisateur
     * @param {string} username - Nom d'utilisateur
     * @param {string} connectionId - ID de la nouvelle connexion
     * @returns {Promise<void>}
     */
    async handleExistingConnections(fastify, userId, username, connectionId) {
        const existingConnection = fastify.connections.get(userId);
        if (existingConnection) {
            fastify.log.warn(`Found existing connection for user ${username} (${userId}), forcing close`);
            try {
                if (existingConnection.readyState < 2) {
                    existingConnection.close(1000, `Replaced by new connection ${connectionId}`);
                }
            } catch (err) {
                fastify.log.error(`Error closing existing connection: ${err}`);
            }
            
            fastify.connections.delete(userId);
            
            // Court délai pour assurer le nettoyage
            await new Promise(resolve => setTimeout(resolve, 150));
        }
    }
    
    /**
     * Établit une nouvelle connexion WebSocket
     * @param {Object} fastify - Instance Fastify
     * @param {Object} connection - Connexion WebSocket
     * @param {number|string} userId - ID de l'utilisateur
     * @param {string} username - Nom d'utilisateur
     * @param {string} connectionId - ID de la connexion
     */
    async establishConnection(fastify, connection, userId, username, connectionId) {
        fastify.log.info(`Storing WebSocket connection [ID: ${connectionId}] for user: ${username} (${userId})`);
        
        // Marquer cette connexion avec l'ID pour le débogage
        connection.socket.connectionId = connectionId;
        fastify.connections.set(userId, connection.socket);
        
        // Mettre à jour le statut en ligne et envoyer la liste des utilisateurs en ligne
        await wsUtils.updateUserOnlineStatus(userId, true);
        await wsUtils.sendOnlineUsersList(fastify, userId);
        wsUtils.broadcastUserStatus(fastify, userId, true);
    }
    
    /**
     * Configure les événements pour la connexion WebSocket
     * @param {Object} fastify - Instance Fastify
     * @param {Object} connection - Connexion WebSocket
     * @param {string} accessToken - Token d'accès
     * @param {number|string} userId - ID de l'utilisateur
     * @param {string} username - Nom d'utilisateur
     * @param {string} connectionId - ID de la connexion
     */
    setupWebSocketEvents(fastify, connection, accessToken, userId, username, connectionId) {
        // Configuration du ping-pong et validation du token
        let lastPong = Date.now();
        const pingInterval = setInterval(async () => {
            // Vérifier si les tokens sont toujours valides
            const isTokenValid = await authService.validateToken(accessToken, null, 'access');
            if (!isTokenValid || Date.now() - lastPong > 35000) {
                this.handleInvalidToken(fastify, connection, connectionId, pingInterval);
                return;
            }
            
            if (connection.socket.readyState === 1) {
                connection.socket.ping();
            }
        }, 30000);
        
        // Gestion des événements WebSocket
        connection.socket.on('pong', () => {
            lastPong = Date.now();
            fastify.log.debug(`Pong received from user: ${username} [ID: ${connectionId}]`);
        });
        
        // Gestion de la fermeture
        connection.socket.on('close', async (code, reason) => {
            this.handleConnectionClose(fastify, connection, pingInterval, code, reason, userId, username, connectionId);
        });
    }
    
    /**
     * Gère le cas où un token devient invalide
     * @param {Object} fastify - Instance Fastify
     * @param {Object} connection - Connexion WebSocket
     * @param {string} connectionId - ID de la connexion
     * @param {Object} pingInterval - Intervalle de ping à nettoyer
     */
    handleInvalidToken(fastify, connection, connectionId, pingInterval) {
        clearInterval(pingInterval);
        try {
            if (connection.socket.readyState < 2) {
                connection.socket.close(1001, "Token invalid or ping timeout");
            }
        } catch (err) {
            fastify.log.error(`Error closing connection on token check: ${err}`);
        }
    }
    
    /**
     * Gère la fermeture d'une connexion WebSocket
     * @param {Object} fastify - Instance Fastify
     * @param {Object} connection - Connexion WebSocket
     * @param {Object} pingInterval - Intervalle de ping à nettoyer
     * @param {number} code - Code de fermeture
     * @param {string} reason - Raison de la fermeture
     * @param {number|string} userId - ID de l'utilisateur
     * @param {string} username - Nom d'utilisateur
     * @param {string} connectionId - ID de la connexion
     */
    async handleConnectionClose(fastify, connection, pingInterval, code, reason, userId, username, connectionId) {
        clearInterval(pingInterval);
        fastify.log.info(`WebSocket connection [ID: ${connectionId}] closed for user: ${username} (${userId}) with code ${code}${reason ? ` and reason: ${reason}` : ''}`);
        
        // S'assurer que cette connexion est toujours active avant de la supprimer
        const currentConnection = fastify.connections.get(userId);
        if (currentConnection === connection.socket) {
            fastify.log.info(`Removing connection [ID: ${connectionId}] for user: ${username}`);
            fastify.connections.delete(userId);
            await wsUtils.updateUserOnlineStatus(userId, false);
            wsUtils.broadcastUserStatus(fastify, userId, false);
        } else if (currentConnection) {
            fastify.log.info(`Connection [ID: ${connectionId}] was replaced by a newer one for user: ${username}, skipping cleanup`);
        } else {
            fastify.log.info(`Connection [ID: ${connectionId}] was already removed for user: ${username}`);
        }
    }
    
    /**
     * Gère les erreurs de connexion WebSocket
     * @param {Object} fastify - Instance Fastify
     * @param {Object} connection - Connexion WebSocket
     * @param {Error} error - Erreur survenue
     */
    handleConnectionError(fastify, connection, error) {
        fastify.log.error('WebSocket connection error:', error);
        if (connection.socket.readyState === 1) {
            try {
                connection.socket.close(1011, 'Internal server error');
            } catch (err) {
                fastify.log.error(`Error closing connection after error: ${err}`);
            }
        }
    }
}

export default new WebSocketService();

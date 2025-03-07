const bcrypt = require("bcrypt");
const authService = require('../jwt/services/auth.service');

async function routes(fastify, options) {
    const { db } = fastify;

    // Route racine
    fastify.get("/", async (request, reply) => {
        return { status: "API is running" };
    });

    /*** 📌 Route: REGISTER ***/
    fastify.post("/register", async (request, reply) => {
        const { username, password } = request.body;

        fastify.log.info({ body: request.body }, "Tentative d'inscription");
        if (!username || !password) {
            fastify.log.warn("Échec d'inscription : username ou password manquant");
            return reply.code(400).send({ error: "Username and password are required" });
        }
        const userExists = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
        if (userExists) {
            fastify.log.warn(`Échec d'inscription : Username déjà pris (${username})`);
            return reply.code(400).send({ error: "Username already taken" });
        }

        // Hashage du mot de passe
        fastify.log.info(`Hashage du mot de passe pour l'utilisateur : ${username}`);
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insertion dans la base de données
        db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(username, hashedPassword);
        fastify.log.info(`Nouvel utilisateur enregistré : ${username}`);

        return reply.code(201).send({ success: true, message: "User registered successfully" });
    });

    /*** 📌 Route: UNREGISTER ***/
    fastify.post("/unregister", async (request, reply) => {
        const { username, password } = request.body;

        fastify.log.info({ username }, "Tentative de suppression de compte");

        try {
            // Vérification des champs requis
            if (!username || !password) {
                fastify.log.warn("Échec de suppression : champs manquants");
                return reply.code(400).send({ error: "Username and password are required" });
            }

            // Vérification de l'existence de l'utilisateur
            const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
            if (!user) {
                fastify.log.warn(`Utilisateur non trouvé : ${username}`);
                return reply.code(404).send({ error: "User not found" });
            }

            // Vérification du mot de passe
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                fastify.log.warn(`Mot de passe incorrect pour : ${username}`);
                return reply.code(401).send({ error: "Invalid password" });
            }

            // Utilisation d'une transaction pour la suppression atomique
            const transaction = db.transaction(async () => {
                fastify.log.info("Révocation des tokens de l'utilisateur");
                await authService.revokeTokens(user.id);

                fastify.log.info("Début de la suppression des données utilisateur");

                // 1. Rendre les parties anonymes plutôt que les supprimer
                db.prepare(`
                    UPDATE games 
                    SET player1_id = CASE 
                            WHEN player1_id = ? THEN NULL 
                            ELSE player1_id 
                        END,
                        player2_id = CASE 
                            WHEN player2_id = ? THEN NULL 
                            ELSE player2_id 
                        END,
                        winner_id = CASE 
                            WHEN winner_id = ? THEN NULL 
                            ELSE winner_id 
                        END
                    WHERE player1_id = ? OR player2_id = ?
                `).run(user.id, user.id, user.id, user.id, user.id);
                
                fastify.log.debug(`Parties anonymisées pour : ${username}`);

                // 2. Suppression du compte utilisateur
                db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
                fastify.log.debug(`Compte supprimé : ${username}`);
            });

            // Exécution de la transaction
            transaction();

            fastify.log.info({
                username,
                success: true
            }, "Compte supprimé et parties anonymisées avec succès");

            return reply.send({ 
                success: true, 
                message: "User deleted and games anonymized successfully" 
            });

        } catch (error) {
            fastify.log.error(error, `Erreur lors de la suppression du compte : ${username}`);
            return reply.code(500).send({ 
                error: "Failed to delete user",
                details: error.message
            });
        }
    });

    /*** 📌 Route: IS USER ***/
    fastify.get("/isUser/:username", async (request, reply) => {
        const { username } = request.params;
        fastify.log.debug(`Vérification de l'existence de l'utilisateur : ${username}`);

        const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
        const exists = !!user;

        if (exists) {
            fastify.log.info(`Utilisateur trouvé : ${username}\n`);
        } else {
            fastify.log.info(`Utilisateur non trouvé : ${username}\n`);
        }

        return reply.send({ exists });
    });

    /*** 📌 Route: IS PASSWORD ***/
    fastify.post("/isPassword", async (request, reply) => {
        const { username, password } = request.body;
        fastify.log.debug(`Vérification du mot de passe pour l'utilisateur : ${username}`);

        const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

        if (!user) {
            fastify.log.warn(`Échec de la vérification : utilisateur non trouvé (${username})`);
            return reply.code(404).send({ error: "User not found" });
        }

        const validPassword = await bcrypt.compare(password, user.password);

        if (validPassword) {
            fastify.log.info(`Mot de passe correct pour l'utilisateur : ${username}\n`);
        } else {
            fastify.log.warn(`Mot de passe incorrect pour l'utilisateur : ${username}\n`);
        }

        return reply.send({ valid: validPassword });
    });

    /*** 📌 Route: GET USER ID ***/
    fastify.post("/getUserId", async (request, reply) => {
        const { username } = request.body;
        
        if (!username) {
            fastify.log.warn("Tentative de récupération d'ID sans username");
            return reply.code(400).send({ error: "Username is required" });
        }

        fastify.log.info(`Recherche de l'ID pour l'utilisateur: ${username}`);
        
        const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
        if (!user) {
            fastify.log.warn(`Utilisateur non trouvé: ${username}`);
            return reply.code(404).send({ error: "User not found" });
        }
        
        fastify.log.info(`ID trouvé pour ${username}: ${user.id}`);
        return { success: true, id: user.id };
    });

    /*** 📌 Route: LOGIN ***/
    fastify.post("/login", async (request, reply) => {
        const { username, password } = request.body;
        fastify.log.info({ username }, "Tentative de connexion");
    
        const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
        if (!user || !(await bcrypt.compare(password, user.password))) {
            fastify.log.warn(`Échec de connexion pour: ${username}`);
            return reply.code(401).send({ error: "Invalid credentials" });
        }
    
        const { accessToken, refreshToken } = await authService.generateTokens(user.id);
    
        // Définir les cookies HTTP-Only
        reply
            .setCookie('accessToken', accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Strict',
                path: '/',
                maxAge: 15 * 60 // 15 min en SECONDES (900 sec)
            })
            .setCookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Strict',
                path: '/',
                maxAge: 7 * 24 * 60 * 60 // 7 jours en SECONDES (604800 sec)
            });
    
        return { success: true, message: "Login successful" };
    });
    

    /*** 📌 Route: REFRESH TOKEN ***/
    fastify.post("/refresh", async (request, reply) => {
        const refreshToken = request.cookies.refreshToken;
        if (!refreshToken) {
            return reply.code(401).send({ error: "No refresh token provided" });
        }

        const newAccessToken = await authService.refreshAccessToken(refreshToken);
        if (!newAccessToken) {
            return reply.code(401).send({ error: "Invalid refresh token" });
        }

        return { accessToken: newAccessToken };
    });

    /*** 📌 Route: PROTECTED EXAMPLE ***/
    fastify.get("/protected", async (request, reply) => {
        // Le middleware auth vérifie déjà le token
        const userId = request.user.userId;
        const user = db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
        
        return { 
            message: "protected information",
            user: user.username
        };
    });

    /*** 📌 Route: LOGOUT ***/
    fastify.post("/logout", async (request, reply) => {
        const token = request.cookies.accessToken;
        
        if (!token) {
            return reply.code(401).send({ error: 'No token provided' });
        }

        // Blacklist du token reçu
        await authService.blacklistToken(token);

        // Décodage basique pour récupérer l'ID user
        const decoded = require('jsonwebtoken').decode(token);
        if (decoded?.userId) {
            // Révocation de tous les tokens
            await authService.revokeTokens(decoded.userId);
        }

        // Supprimer les cookies
        reply
            .clearCookie('accessToken', {
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                httpOnly: true,
                sameSite: 'strict'
            })
            .clearCookie('refreshToken', {
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                httpOnly: true,
                sameSite: 'strict'
            });

        return { success: true, message: "Logged out successfully" };
    });

    /*** 📌 Route: REVOKE TOKEN ***/
    fastify.post("/revoke", async (request, reply) => {
        const { userId } = request.body;
        
        if (!userId) {
            return reply.code(400).send({ error: "User ID is required" });
        }

        await authService.revokeTokens(userId);
        return { success: true, message: "Tokens revoked successfully" };
    });

    /*** 📌 Route: VERIFY TOKEN ***/
    fastify.post("/verify_token", async (request, reply) => {
        const token = request.cookies.accessToken;
        
        if (!token) {
            return { valid: false };
        }

        const decoded = await authService.validateToken(token);
        
        fastify.log.debug({
            tokenValid: !!decoded,
            userId: decoded?.userId
        }, "Vérification de token");

        return { 
            valid: !!decoded,
            userId: decoded?.userId 
        };
    });
}

module.exports = routes;
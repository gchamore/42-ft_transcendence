async function routes(fastify, options) {
    const { db } = fastify;

	/*** 📌 Route: add friend user ***/
    fastify.post("/add/:username", async (request, reply) => {
        const friendUsername = request.params.username;
        const userId = request.user.userId;

        fastify.log.info(`Tentative d'ajout d'ami: ${friendUsername}`);

        try {
            const friend = db.prepare("SELECT id, username FROM users WHERE username = ?").get(friendUsername);
            if (!friend) {
                fastify.log.warn(`Utilisateur non trouvé: ${friendUsername}`);
                return reply.code(404).send({ error: "User not found" });
            }

            const currentUser = db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
            if (currentUser.username === friendUsername) {
                return reply.code(400).send({ error: "Cannot add yourself as friend" });
            }

            const existingFriendship = db.prepare(
                "SELECT * FROM friendships WHERE user_id = ? AND friend_id = ?"
            ).get(userId, friend.id);

            if (existingFriendship) {
                return reply.code(400).send({ error: "Already friends" });
            }

            db.prepare(
                "INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)"
            ).run(userId, friend.id);

            fastify.log.info(`Ami ajouté avec succès: ${friendUsername}`);
            return { success: true };

        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: "Failed to add friend" });
        }
    });

	/*** 📌 Route: remove friend user ***/
    fastify.delete("/remove/:username", async (request, reply) => {
        const friendUsername = request.params.username;
        const userId = request.user.userId;

        try {
            const friend = db.prepare("SELECT id FROM users WHERE username = ?").get(friendUsername);
            if (!friend) {
                return reply.code(404).send({ error: "User not found" });
            }

            const result = db.prepare(
                "DELETE FROM friendships WHERE user_id = ? AND friend_id = ?"
            ).run(userId, friend.id);

            if (result.changes === 0) {
                return reply.code(404).send({ error: "Friendship not found" });
            }

            return { success: true };

        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: "Failed to remove friend" });
        }
    });

	/*** 📌 Route: search user ***/
    fastify.get("/search/:username", async (request, reply) => {
        const searchedUsername = request.params.username;
        const userId = request.user.userId;

        try {
            // Rechercher l'utilisateur
            const searchedUser = db.prepare(`
                SELECT id, username, 
                       strftime('%d-%m-%Y', created_at) as created_at,
                       wins, losses
                FROM users 
                WHERE username = ?
            `).get(searchedUsername);

            if (!searchedUser) {
                return reply.code(404).send({ 
                    error: "User not found" 
                });
            }

            // Vérifier si c'est un ami
            const friendship = db.prepare(`
                SELECT strftime('%d-%m-%Y', date) as friend_since
                FROM friendships 
                WHERE user_id = ? AND friend_id = ?
            `).get(userId, searchedUser.id);

            // Calculer les statistiques de jeu
            const gameStats = db.prepare(`
                SELECT 
                    COUNT(*) as total_games,
                    SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as wins
                FROM games 
                WHERE (player1_id = ? OR player2_id = ?)
            `).get(searchedUser.id, searchedUser.id, searchedUser.id);

            // Calculer le win rate
            const winRate = gameStats.total_games > 0 
                ? ((searchedUser.wins / gameStats.total_games) * 100).toFixed(1) 
                : 0;

            // Si c'est un ami, ajouter les stats communes
            if (friendship) {
                const commonGames = db.prepare(`
                    SELECT 
                        COUNT(*) as games_together,
                        COALESCE(SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END), 0) as wins_together
                    FROM games 
                    WHERE (player1_id = ? AND player2_id = ?) 
                       OR (player1_id = ? AND player2_id = ?)
                `).get(userId, userId, searchedUser.id, searchedUser.id, userId);

                return {
                    success: true,
                    isFriend: true,
                    user: {
                        username: searchedUser.username,
                        friendSince: friendship.friend_since,
                        gamesPlayed: gameStats.total_games,
                        winRate: winRate,
                        gamesTogether: commonGames.games_together || 0,
                        winsTogether: commonGames.wins_together || 0,
                        isConnected: fastify.connections.has(searchedUser.id)
                    }
                };
            }

            // Si ce n'est pas un ami
            return {
                success: true,
                isFriend: false,
                user: {
                    username: searchedUser.username,
                    createdAt: searchedUser.created_at,
                    gamesPlayed: gameStats.total_games,
                    winRate: winRate,
					isConnected: fastify.connections.has(searchedUser.id)
                }
            };

        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: "Failed to search user" });
        }
    });

	/*** 📌 Route: block a user ***/
    fastify.post("/block/:username", async (request, reply) => {
        const blockedUsername = request.params.username;
        const blockerId = request.user.userId;

        try {
            // Vérifier si l'utilisateur à bloquer existe
            const blockedUser = db.prepare("SELECT id FROM users WHERE username = ?").get(blockedUsername);
            if (!blockedUser) {
                return reply.code(404).send({ error: "User not found" });
            }

            // Vérifier si le blocage existe déjà
            const existingBlock = db.prepare(
                "SELECT * FROM blocks WHERE blocker_id = ? AND blocked_id = ?"
            ).get(blockerId, blockedUser.id);

            if (existingBlock) {
                return reply.code(400).send({ error: "User already blocked" });
            }

            // Ajouter le blocage
            db.prepare(
                "INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)"
            ).run(blockerId, blockedUser.id);

            // Si les utilisateurs sont amis, supprimer l'amitié
            db.prepare(
                "DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)"
            ).run(blockerId, blockedUser.id, blockedUser.id, blockerId);

            return { success: true, message: "User blocked successfully" };

        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: "Failed to block user" });
        }
    });

	/*** 📌 Route: unblock a user ***/
    fastify.delete("/unblock/:username", async (request, reply) => {
        const blockedUsername = request.params.username;
        const blockerId = request.user.userId;

        try {
            // Vérifier si l'utilisateur existe
            const blockedUser = db.prepare("SELECT id FROM users WHERE username = ?").get(blockedUsername);
            if (!blockedUser) {
                return reply.code(404).send({ error: "User not found" });
            }

            // Supprimer le blocage
            const result = db.prepare(
                "DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?"
            ).run(blockerId, blockedUser.id);

            if (result.changes === 0) {
                return reply.code(404).send({ error: "Block not found" });
            }

            return { success: true, message: "User unblocked successfully" };

        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: "Failed to unblock user" });
        }
    });

	/*** 📌 Route: all blocked user ***/
    fastify.get("/blocked", async (request, reply) => {
        const userId = request.user.userId;

        try {
            const blockedUsers = db.prepare(`
                SELECT u.username
                FROM blocks b
                JOIN users u ON u.id = b.blocked_id
                WHERE b.blocker_id = ?
                ORDER BY b.date DESC
            `).all(userId);

            return { 
                success: true, 
                blockedUsers: blockedUsers.map(u => u.username) 
            };

        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: "Failed to fetch blocked users" });
        }
    });
}

module.exports = routes;

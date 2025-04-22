export async function userRoutes(fastify, options) {
    const { db } = fastify;

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

    fastify.put("/update", async (request, reply) => {
        const userId = request.user.userId; // From auth middleware
        const { username, password, email, avatar } = request.body;

        try {
            // Récupérer l'utilisateur actuel
            const currentUser = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
            if (!currentUser) {
                return reply.code(404).send({ error: "User not found" });
            }

            // Préparer les champs à mettre à jour
            const updates = {};
            const params = [];
            
            // Vérifier et ajouter chaque champ s'il est fourni
            if (username) {
                // Vérifier si le nouveau username est déjà pris
                const usernameExists = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?")
                    .get(username, userId);
                if (usernameExists) {
                    return reply.code(400).send({ error: "Username already taken" });
                }
                updates.username = username;
            }
            
            if (password) {
                // Hasher le nouveau mot de passe
                const hashedPassword = await bcrypt.hash(password, 10);
                updates.password = hashedPassword;
            }
            
            if (email) {
                // Valider le format de l'email
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    return reply.code(400).send({ error: "Invalid email format" });
                }
                updates.email = email;
            }
            
            if (avatar) {
                // Valider le format de l'URL de l'avatar
                const urlRegex = /^\/assets\/.*\.(jpg|jpeg|png|gif)$/i;
                if (!urlRegex.test(avatar)) {
                    return reply.code(400).send({ error: "Invalid avatar format" });
                }
                updates.avatar = avatar;
            }

            // Si aucun champ à mettre à jour
            if (Object.keys(updates).length === 0) {
                return reply.code(400).send({ error: "No fields to update" });
            }

            // Construire la requête SQL
            const setClause = Object.keys(updates)
                .map(key => `${key} = ?`)
                .join(", ");
            const updateValues = Object.values(updates);
            
            // Exécuter la mise à jour
            db.prepare(`
                UPDATE users 
                SET ${setClause}
                WHERE id = ?
            `).run(...updateValues, userId);

            // Récupérer et retourner les informations mises à jour
            const updatedUser = db.prepare(`
                SELECT id, username, email, avatar
                FROM users
                WHERE id = ?
            `).get(userId);

            fastify.log.info(`User ${userId} updated successfully`);
            return reply.send({
                success: true,
                message: "User updated successfully",
                user: updatedUser
            });

        } catch (error) {
            fastify.log.error(error, "Error updating user");
            return reply.code(500).send({
                error: "Failed to update user"
            });
        }
    });
}

async function routes(fastify, options) {
    const { db } = fastify;

    fastify.post("/add_friend", async (request, reply) => {
        const { friendUsername } = request.body;
        const userId = request.user.userId; // Fourni par le middleware d'auth

        fastify.log.info(`Tentative d'ajout d'ami: ${friendUsername}`);

        try {
            // Vérifier que le friend existe
            const friend = db.prepare("SELECT id, username FROM users WHERE username = ?").get(friendUsername);
            if (!friend) {
                fastify.log.warn(`Utilisateur non trouvé: ${friendUsername}`);
                return reply.code(404).send({ error: "User not found" });
            }

            // Double vérification côté serveur pour l'ajout de soi-même
            const currentUser = db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
            if (currentUser.username === friendUsername) {
                return reply.code(400).send({ error: "Cannot add yourself as friend" });
            }

            // Vérifier si l'amitié existe déjà
            const existingFriendship = db.prepare(
                "SELECT * FROM friendships WHERE user_id = ? AND friend_id = ?"
            ).get(userId, friend.id);

            if (existingFriendship) {
                return reply.code(400).send({ error: "Already friends" });
            }

            // Ajouter l'ami
            db.prepare(
                "INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)"
            ).run(userId, friend.id);

            fastify.log.info(`Ami ajouté avec succès: ${friendUsername}`);

            return { 
                success: true, 
                message: `${friendUsername} added to friends` 
            };

        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: "Failed to add friend" });
        }
    });

    fastify.get("/friends", async (request, reply) => {
        const userId = request.user.userId;

        try {
            const friends = db.prepare(`
                SELECT u.id, u.username, u.wins, u.losses, f.date as friend_since
                FROM friendships f
                JOIN users u ON u.id = f.friend_id
                WHERE f.user_id = ?
                ORDER BY f.date DESC
            `).all(userId);

            return { success: true, friends };

        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: "Failed to fetch friends" });
        }
    });

    fastify.delete("/remove_friend/:friendId", async (request, reply) => {
        const { friendId } = request.params;
        const userId = request.user.userId;

        try {
            const result = db.prepare(
                "DELETE FROM friendships WHERE user_id = ? AND friend_id = ?"
            ).run(userId, friendId);

            if (result.changes === 0) {
                return reply.code(404).send({ error: "Friendship not found" });
            }

            return { success: true, message: "Friend removed successfully" };

        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: "Failed to remove friend" });
        }
    });
}

module.exports = routes;

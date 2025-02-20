async function routes(fastify, options) {
    const { db } = fastify;

    /*** 📌 Route: GAME ***/
    fastify.post("/user/game", async (request, reply) => {
        const { player1_id, player2_id, score_player1, score_player2, winner_id } = request.body;

        // Log la requête entrante
        fastify.log.info({ 
            body: request.body 
        }, "Tentative d'enregistrement d'une partie");

        try {
            // Vérifier que tous les champs requis sont présents
            if (!player1_id || !player2_id || score_player1 === undefined || 
                score_player2 === undefined || !winner_id) {
                fastify.log.warn({
                    missing: Object.entries({ player1_id, player2_id, score_player1, score_player2, winner_id })
                        .filter(([_, v]) => !v)
                        .map(([k]) => k)
                }, "Échec d'enregistrement : champs manquants");
                return reply.code(400).send({ 
                    error: "Missing required fields",
                    required: ["player1_id", "player2_id", "score_player1", "score_player2", "winner_id"]
                });
            }

            // Vérifier que les joueurs existent
            const player1 = db.prepare("SELECT id, username FROM users WHERE id = ?").get(player1_id);
            const player2 = db.prepare("SELECT id, username FROM users WHERE id = ?").get(player2_id);

            if (!player1 || !player2) {
                fastify.log.warn({
                    player1: player1 ? player1.username : `ID ${player1_id} non trouvé`,
                    player2: player2 ? player2.username : `ID ${player2_id} non trouvé`
                }, "Échec d'enregistrement : joueur(s) non trouvé(s)");
                return reply.code(404).send({ 
                    error: "One or both players not found",
                    details: {
                        player1Exists: !!player1,
                        player2Exists: !!player2
                    }
                });
            }

            // Vérifier que winner_id correspond à l'un des joueurs
            if (winner_id !== player1_id && winner_id !== player2_id) {
                fastify.log.warn({
                    winner_id,
                    player1_id,
                    player2_id
                }, "Échec d'enregistrement : ID du gagnant invalide");
                return reply.code(400).send({ 
                    error: "Winner must be one of the players"
                });
            }

            // Vérifier que les scores sont des nombres positifs
            if (score_player1 < 0 || score_player2 < 0) {
                fastify.log.warn({
                    score_player1,
                    score_player2
                }, "Échec d'enregistrement : scores négatifs");
                return reply.code(400).send({ 
                    error: "Scores must be positive numbers"
                });
            }

            // Commencer une transaction
            const transaction = db.transaction(() => {
                fastify.log.info("Début de la transaction");
                const result = db.prepare(`
                    INSERT INTO games (player1_id, player2_id, score_player1, score_player2, winner_id)
                    VALUES (?, ?, ?, ?, ?)
                `).run(player1_id, player2_id, score_player1, score_player2, winner_id);

                // Mettre à jour les statistiques
                if (winner_id === player1_id) {
                    fastify.log.debug(`Mise à jour des stats - Victoire: ${player1.username}, Défaite: ${player2.username}`);
                    db.prepare('UPDATE users SET wins = wins + 1 WHERE id = ?').run(player1_id);
                    db.prepare('UPDATE users SET losses = losses + 1 WHERE id = ?').run(player2_id);
                } else {
                    fastify.log.debug(`Mise à jour des stats - Victoire: ${player2.username}, Défaite: ${player1.username}`);
                    db.prepare('UPDATE users SET wins = wins + 1 WHERE id = ?').run(player2_id);
                    db.prepare('UPDATE users SET losses = losses + 1 WHERE id = ?').run(player1_id);
                }

                return result;
            });

            // Exécuter la transaction
            const result = transaction();
            
            fastify.log.info({
                gameId: result.lastInsertRowid,
                player1: player1.username,
                player2: player2.username,
                score: `${score_player1}-${score_player2}`,
                winner: winner_id === player1_id ? player1.username : player2.username
            }, "Partie enregistrée avec succès");

            return { 
                success: true, 
                gameId: result.lastInsertRowid,
                message: "Game saved successfully"
            };

        } catch (error) {
            fastify.log.error(error, "Erreur lors de l'enregistrement de la partie");
            return reply.code(500).send({ 
                error: "Failed to save game",
                details: error.message
            });
        }
    });

    /*** 📌 Route: LEADERBOARD ***/
    fastify.get("/leaderboard", async (request, reply) => {
        fastify.log.info("Requête du leaderboard");
        
        try {
            const leaderboard = db.prepare(`
                SELECT 
                    id, username, wins, losses,
                    CAST(wins AS FLOAT) / CASE WHEN (wins + losses) = 0 THEN 1 ELSE (wins + losses) END as win_rate
                FROM users
                ORDER BY wins DESC, win_rate DESC
                LIMIT 10
            `).all();

            fastify.log.info({
                playerCount: leaderboard.length,
                topPlayer: leaderboard[0]?.username
            }, "Leaderboard récupéré avec succès");

            return { success: true, leaderboard };
        } catch (error) {
            fastify.log.error(error, "Erreur lors de la récupération du leaderboard");
            return reply.code(500).send({ error: "Failed to fetch leaderboard" });
        }
    });
}

module.exports = routes;

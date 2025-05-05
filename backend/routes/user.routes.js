import { pipeline } from 'stream/promises';
import bcrypt from 'bcrypt';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export async function userRoutes(fastify, options) {
	const { db } = fastify;

	fastify.post("/add/:username", async (request, reply) => {
		const friendUsername = request.params.username;
		const userId = request.user.userId;

		fastify.log.info(`Tentative d'ajout d'ami: ${friendUsername}`);

		try {
			// Check if the user to be added exists
			const friend = db.prepare("SELECT id, username FROM users WHERE username = ?").get(friendUsername);
			if (!friend) {
				fastify.log.warn(`Utilisateur non trouvé: ${friendUsername}`);
				return reply.code(404).send({ error: "User not found" });
			}
			// Check if the user is trying to add themselves
			const currentUser = db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
			if (currentUser.username === friendUsername) {
				return reply.code(400).send({ error: "Cannot add yourself as friend" });
			}
			// Check if the user is already a friend
			const existingFriendship = db.prepare(
				"SELECT * FROM friendships WHERE user_id = ? AND friend_id = ?"
			).get(userId, friend.id);

			if (existingFriendship) {
				return reply.code(400).send({ error: "Already friends" });
			}
			// Add the friendship
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
			// Check if the user to be removed exists
			const friend = db.prepare("SELECT id FROM users WHERE username = ?").get(friendUsername);
			if (!friend) {
				return reply.code(404).send({ error: "User not found" });
			}
			// Check if the friendship exists
			const result = db.prepare(
				"DELETE FROM friendships WHERE user_id = ? AND friend_id = ?"
			).run(userId, friend.id);

			// If no rows were changed, the friendship doesn't exist
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
			// Check if the user exists
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

			// Check if the user is a friend
			const friendship = db.prepare(`
                SELECT strftime('%d-%m-%Y', date) as friend_since
                FROM friendships 
                WHERE user_id = ? AND friend_id = ?
            `).get(userId, searchedUser.id);

			// Calculate game statistics
			const gameStats = db.prepare(`
                SELECT 
                    COUNT(*) as total_games,
                    SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as wins
                FROM games 
                WHERE (player1_id = ? OR player2_id = ?)
            `).get(searchedUser.id, searchedUser.id, searchedUser.id);

			// Calculate win rate
			const winRate = gameStats.total_games > 0
				? ((searchedUser.wins / gameStats.total_games) * 100).toFixed(1)
				: 0;

			// If it's a friend, add common stats
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

			// If not a friend, return basic info
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
			// Check if the user to block exists
			const blockedUser = db.prepare("SELECT id FROM users WHERE username = ?").get(blockedUsername);
			if (!blockedUser) {
				return reply.code(404).send({ error: "User not found" });
			}

			// Check if the block already exists
			const existingBlock = db.prepare(
				"SELECT * FROM blocks WHERE blocker_id = ? AND blocked_id = ?"
			).get(blockerId, blockedUser.id);

			if (existingBlock) {
				return reply.code(400).send({ error: "User already blocked" });
			}

			// Add the block
			db.prepare(
				"INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)"
			).run(blockerId, blockedUser.id);

			// If the users are friends, remove the friendship
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
			// Check if the user to unblock exists
			const blockedUser = db.prepare("SELECT id FROM users WHERE username = ?").get(blockedUsername);
			if (!blockedUser) {
				return reply.code(404).send({ error: "User not found" });
			}

			// Remove the block
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
		const userId = request.user.userId;
		const { username, email, password } = request.body;
		fastify.log.info("Update user data:", { username, email, password });

		try {
			const currentUser = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
			if (!currentUser) {
				return reply.code(404).send({ error: "User not found" });
			}

			let somethingUpdated = false;

			// ✅ Username
			if (username && username !== currentUser.username) {
				console.log("🔧 Update username with:", username, userId);
				const exists = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(username, userId);
				if (exists) return reply.code(400).send({ error: "Username already taken" });

				db.prepare("UPDATE users SET username = ? WHERE id = ?").run(username, userId);
				somethingUpdated = true;
			}

			// ✅ Password
			if (password && !bcrypt.compareSync(password, currentUser.password)) {
				console.log("🔧 Update password with:", password, userId);
				const hashedPassword = await bcrypt.hash(password, 10);
				db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, userId);
				somethingUpdated = true;
			}

			// ✅ Email
			if (email && email !== currentUser.email) {
				console.log("🔧 Update email with:", email, userId);
				const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
				if (!emailRegex.test(email)) {
					return reply.code(400).send({ error: "Invalid email format" });
				}
				db.prepare("UPDATE users SET email = ? WHERE id = ?").run(email, userId);
				somethingUpdated = true;
			}

			if (!somethingUpdated)
				return reply.code(400).send({ error: "Nothing was updated" });

			const updatedUser = db.prepare("SELECT id, username, email FROM users WHERE id = ?").get(userId);
			return reply.send({ success: true, user: updatedUser });

		} catch (err) {
			fastify.log.error(err);
			return reply.code(500).send({ error: "Server error" });
		}
	});

	fastify.put("/update_avatar", async (request, reply) => {
		const userId = request.user.userId;
		if (!request.isMultipart()) {
			fastify.log.warn("Request is not multipart/form-data");
			return reply.code(400).send({ error: "Request is not multipart/form-data" });
		}
		const avatar = await request.file();
		console.log("🧩 Avatar reçu:", avatar);
		try {
			const currentUser = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
			if (!currentUser) {
				return reply.code(404).send({ error: "User not found" });
			}

			let somethingUpdated = false;

			if (avatar && avatar.filename) {
				const ext = path.extname(avatar.filename).toLowerCase();
				const allowed = ['.jpg', '.jpeg', '.png', '.gif'];
				if (!allowed.includes(ext)) {
					return reply.code(400).send({ error: "Invalid avatar format" });
				}

				if (currentUser.avatar && currentUser.avatar !== '/avatar/avatar.png') {
					const oldPath = path.resolve(`/data${currentUser.avatar}`);
					if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
				}

				const fileName = `${userId}.png`;
				const relativePath = `/avatar/${fileName}`;
				const fullPath = path.resolve(`/data${relativePath}`);

				await pipeline(
					avatar.file,
					sharp().resize(120, 120).png(),
					fs.createWriteStream(fullPath)
				);

				db.prepare("UPDATE users SET avatar = ? WHERE id = ?").run(relativePath, userId);
				somethingUpdated = true;
			}


			if (!somethingUpdated) {
				fastify.log.warn("Nothing was updated");
				return reply.code(400).send({ error: "Nothing was updated" });
			}

			const updatedUser = db.prepare("SELECT id, avatar FROM users WHERE id = ?").get(userId);
			return reply.send({ success: true, user: updatedUser });

		} catch (err) {
			fastify.log.error(err);
			return reply.code(500).send({ error: "Server error" });
		}
	});

}

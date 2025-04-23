import bcrypt from 'bcrypt';

export class AuthUtils {
		// Hash password with bcrypt
		async hashPassword(password, saltRounds = 10) {
			try {
				return await bcrypt.hash(password, saltRounds);
			} catch (error) {
				console.error('Password hashing error:', error);
				throw new Error('Failed to hash password');
			}
		}
	
		// Generic database insert function
		async addToDatabase(db, tableName, data) {
			try {
				const columns = Object.keys(data);
				const values = Object.values(data);
				const placeholders = Array(columns.length).fill('?').join(',');
	
				const query = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`;
				const result = db.prepare(query).run(...values);
	
				return result.lastInsertRowid;
			} catch (error) {
				console.error('Database insertion error:', error);
				throw new Error(`Failed to add data to ${tableName}`);
			}
		}
	
		// Generic database delete function
		async removeFromDatabase(db, tableName, conditions) {
			try {
				const whereClause = Object.entries(conditions)
					.map(([key]) => `${key} = ?`)
					.join(' AND ');
				const values = Object.values(conditions);
	
				const query = `DELETE FROM ${tableName} WHERE ${whereClause}`;
				return db.prepare(query).run(...values);
			} catch (error) {
				console.error('Database deletion error:', error);
				throw new Error(`Failed to remove data from ${tableName}`);
			}
		}
	
		// Récupère une ligne de la base avec SELECT ... WHERE ...
		async getFromDatabase(db, tableName, columns, conditions) {
			try {
				const columnList = columns.join(', ');
				const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
				const values = Object.values(conditions);
	
				const query = `SELECT ${columnList} FROM ${tableName} WHERE ${whereClause}`;
				const result = db.prepare(query).get(...values);
	
				return result;
			} catch (error) {
				console.error(`Database SELECT error on ${tableName}:`, error);
				throw new Error(`Failed to retrieve data from ${tableName}`);
			}
		}
	
		// Configure and set cookies with flexible expiration times
		// utils/setCookie.js
		setCookie(reply, token, duration, isLocal = false) {
			const cookieOptions = {
				httpOnly: true,
				secure: !isLocal,
				sameSite: isLocal ? 'Lax' : 'None',
				path: '/',
			};
	
			// Cas acceptés : 5min, 15min ou 7jours
			if (duration === 5 || duration === 15) {
				reply.setCookie('accessToken', token, {
					...cookieOptions,
					maxAge: duration * 60 // minutes en secondes
				});
			} else if (duration === 7) {
				reply.setCookie('refreshToken', token, {
					...cookieOptions,
					maxAge: 7 * 24 * 60 * 60 // jours en secondes
				});
			} else {
				throw new Error("Durée invalide : seuls 5, 15 (minutes) ou 7 (jours) sont autorisés.");
			}
			return reply;
		}
}

export default new AuthUtils();

import bcrypt from 'bcrypt';

export class AuthUtils {
	// Hash password with bcrypt
	async hashPassword(password, saltRounds = 10) {
		try {
			return await bcrypt.hash(password, saltRounds);
		} catch (error) {
			fastify.log.error(error, 'Password hashing error:');
			throw new Error('Failed to hash password');
		}
	}

	// Configure and set cookies with flexible expiration times
	ft_setCookie(reply, token, duration, isLocal = false) {
		const cookieOptions = {
			httpOnly: true,
			secure: !isLocal,
			sameSite: isLocal ? 'Lax' : 'None',
			path: '/',
		};

		// accepted cases: 1min (debug), 5min, 15min or 7days
		if (duration === 1) { // 🔧 Debug purpose only
			reply.setCookie('accessToken', token, {
				...cookieOptions,
				maxAge: 60 // 1 minute
			});
		} else if (duration === 5 || duration === 15) {
			reply.setCookie('accessToken', token, {
				...cookieOptions,
				maxAge: duration * 60
			});
		} else if (duration === 7) {
			reply.setCookie('refreshToken', token, {
				...cookieOptions,
				maxAge: 7 * 24 * 60 * 60
			});
		} else {
			throw new Error("Durée invalide : seuls 1 (debug), 5, 15 (minutes) ou 7 (jours) sont autorisés.");
		}
		return reply;
	}

	checkUsername(fastify, username) {
		fastify.log.info(`Checking username: ${username}`);
		const trimmedUsername = username ? username.trim() : '';

		if (!trimmedUsername) {
			fastify.log.warn("Search failed: username missing");
			return { error: "Username is required" };
		}

		const capitalizedUsername = trimmedUsername.charAt(0).toUpperCase() + trimmedUsername.slice(1).toLowerCase();
		const usernameRegex = /^[a-zA-Z0-9_]{3,15}$/;
		if (!usernameRegex.test(capitalizedUsername)) {
			return { error: "Username must be 3-15 characters, letters/numbers/underscores only." };
		}

		return capitalizedUsername;
	}


}
export default new AuthUtils();

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
		
		// Check for null/undefined
		if (username === null || username === undefined) {
			fastify.log.warn("Search failed: username is null or undefined");
			return { error: "Username is required" };
		}

		// Make sure username is a string
		if (typeof username !== 'string') {
			fastify.log.warn("Search failed: username is not a string");
			return { error: "Username must be a text value" };
		}
		
		const trimmedUsername = username.trim();

		if (!trimmedUsername) {
			fastify.log.warn("Search failed: username missing");
			return { error: "Username is required" };
		}
		
		// Check for control characters and escape sequences
		if (/[\x00-\x1F\x7F\\]/.test(trimmedUsername)) {
			fastify.log.warn("Search failed: username contains control characters or backslashes");
			return { error: "Username contains invalid characters" };
		}

		// Check for various XSS patterns (more comprehensive)
		if (/<[^>]*>|script|alert|onerror|onclick|javascript:|&lt;|\"|\'|%3C/.test(trimmedUsername.toLowerCase())) {
			fastify.log.warn("Search failed: username contains potentially malicious patterns");
			return { error: "Username contains invalid characters" };
		}
		
		// Check for excessive repeating characters (e.g., "aaaaaaaa")
		if (/(.)\1{3,}/.test(trimmedUsername)) {
			fastify.log.warn("Search failed: username contains excessive repeating characters");
			return { error: "Username cannot contain more than 3 repeated characters in a row" };
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

// Pour tester les cas limites de longueur
// - ab (trop court, moins de 3 caractères)
// - abcdefghijklmnop (trop long, plus de 15 caractères)
// - abc (limite minimale acceptable)
// - abcdefghijklmno (limite maximale acceptable)

// Pour tester les caractères non autorisés
// - user@name (caractère spécial @)
// - user.name (point non autorisé)
// - user-name (tiret non autorisé)
// - user!name (caractère spécial !)
// - user name (espace non autorisé)
// - user#123 (caractère spécial #)

// Pour tester les caractères de contrôle et les tentatives XSS
// - user\name (caractère d'échappement) attention
// - user\u0000 (caractère nul) attention
// - <script> (balise HTML)
// - user<div> (balise HTML intégrée)
// - alert(1) (potentielle injection JS)
// - "><script>alert(1)</script> (tentative XSS) attention

// Pour tester les caractères répétés
// - aaaabcd (4 'a' répétés)
// - ab____cd (4 underscores répétés)
// - 111123 (4 '1' répétés)
// - aaa123 (3 'a' répétés - devrait être accepté)

// Pour tester la capitalisation
// - username (devrait devenir Username)
// - USERNAME (devrait devenir Username)
// - UserName (devrait devenir Username)

// Pour tester d'autres validations
// - user (espaces avant/après - devraient être supprimés)
// - null (le mot "null", pas la valeur)
// - undefined (le mot "undefined", pas la valeur)
// - 123_abc (commence par des chiffres)
// - _username (commence par un underscore)
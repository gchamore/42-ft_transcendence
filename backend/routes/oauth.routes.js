import { google } from 'googleapis';
import authService from '../auth/auth.service.js';
import dotenv from 'dotenv';

dotenv.config();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

/*** 📌 Route: google/token ***/
// Trade the authorization code for tokens and user info
// This route is used to authenticate the user with Google OAuth
// and create or update the user in the database
// It also handles 2FA if enabled for the user
// It returns the access and refresh tokens in cookies
export async function oauthRoutes(fastify, options) {
    fastify.post('/auth/google/token', async (request, reply) => {
        try {
            const { code } = request.body;
            if (!code) {
                return reply.code(400).send({ error: 'Authorization code is required' });
            }

			// Trade the authorization code for tokens
            const { tokens } = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);

			// Get user info from Google
            const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
            const { data } = await oauth2.userinfo.get();

			// Check if user exists in the database
            let user = fastify.db.prepare(
                "SELECT * FROM users WHERE email = ?"
            ).get(data.email);

            if (!user) {
				// Generate a unique username
                let username = data.given_name;
                let counter = 1;
                while (fastify.db.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) {
                    username = `${data.given_name}${counter++}`;
                }

                const result = fastify.db.prepare(
                    "INSERT INTO users (username, password, email, avatar) VALUES (?, ?, ?, ?)"
                ).run(username, 'GOOGLE_OAUTH', data.email, data.picture);

                user = fastify.db.prepare(
                    "SELECT * FROM users WHERE id = ?"
                ).get(result.lastInsertRowid);
            }

			// Check if 2FA is enabled for the user
            if (user.twofa_secret) {
                try {
                    const tempToken = await TwofaService.generateTemp2FAToken(user.id);
                    fastify.log.info('2FA token generated for Google OAuth user:', user.username);
                    
                    return reply.code(200).send({
                        step: "2fa_required",
                        message: "2FA is enabled. Please provide the verification code.",
                        temp_token: tempToken,
                        username: user.username
                    });
                } catch (twoFaError) {
                    fastify.log.error('2FA token generation error:', twoFaError);
                    throw new Error('Failed to generate 2FA token');
                }
            }

			// If no 2FA, proceed with the normal process
            const { accessToken, refreshToken } = await authService.generateTokens(user.id);

			// Check if the application is running locally or in production
			const isLocal = request.headers.host.startsWith("localhost");

			// Set cookies with tokens
            reply
                .setCookie('accessToken', accessToken, {
                    httpOnly: true,
                    secure: !isLocal,
                    sameSite: 'None',
                    path: '/',
                    maxAge: 15 * 60
                })
                .setCookie('refreshToken', refreshToken, {
                    httpOnly: true,
                    secure: !isLocal,
                    sameSite: 'None',
                    path: '/',
                    maxAge: 7 * 24 * 60 * 60
                })
                .send({
                    success: true,
                    username: user.username
                });

        } catch (error) {
            fastify.log.error('Google OAuth error:', error);
            
            return reply.code(500).send({
                success: false,
                error: 'Failed to authenticate with Google',
                details: error.message,
                step: error.step || 'unknown'
                error: 'Failed to authenticate with Google',
                details: error.message,
                step: error.step || 'unknown'
            });
        }
    });
}


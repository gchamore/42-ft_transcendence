const { google } = require('googleapis');
const authService = require('../jwt/services/auth.service');
require('dotenv').config();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

async function routes(fastify, options) {
    fastify.post('/auth/google/token', async (request, reply) => {
        try {
            const { code } = request.body;
            if (!code) {
                return reply.code(400).send({ error: 'Authorization code is required' });
            }

            // Échange du code contre les tokens
            const { tokens } = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);

            // Récupération des infos utilisateur
            const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
            const { data } = await oauth2.userinfo.get();

            // Recherche de l'utilisateur ou création
            let user = fastify.db.prepare(
                "SELECT * FROM users WHERE email = ?"
            ).get(data.email);

            if (!user) {
                // Générer un username unique
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

            // Génération des tokens JWT
            const { accessToken, refreshToken } = await authService.generateTokens(user.id);

            // Détermination si local ou production
            const isLocal = request.headers.host.startsWith("localhost");

            // Envoi des cookies et réponse
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
                error: 'Failed to authenticate with Google'
            });
        }
    });
}

module.exports = routes;

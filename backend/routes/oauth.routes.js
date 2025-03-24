const { google } = require('googleapis');
const authService = require('../jwt/services/auth.service');
require('dotenv').config();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

async function routes(fastify, options) {
    // Route pour gérer le callback Google
    fastify.post('/auth/google/callback', async (request, reply) => {
        const { code } = request.body;

        try {
            // Échanger le code contre des tokens
            const { tokens } = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);

            // Obtenir les informations de l'utilisateur
            const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
            const { data } = await oauth2.userinfo.get();

            // Rechercher l'utilisateur dans la base de données
            let user = fastify.db.prepare(
                "SELECT * FROM users WHERE username = ?"
            ).get(`google_${data.email}`);

            // Si l'utilisateur n'existe pas, le créer
            if (!user) {
                const result = fastify.db.prepare(
                    "INSERT INTO users (username, password, avatar) VALUES (?, ?, ?)"
                ).run(`google_${data.email}`, 'GOOGLE_OAUTH', data.picture);

                user = fastify.db.prepare(
                    "SELECT * FROM users WHERE id = ?"
                ).get(result.lastInsertRowid);
            }

            // Générer les tokens JWT
            const { accessToken, refreshToken } = await authService.generateTokens(user.id);

            // Déterminer si l'application est en local
            const isLocal = request.headers.host.startsWith("localhost");

            // Envoyer la réponse avec les cookies
            return reply
                .code(200)
                .setCookie('accessToken', accessToken, {
                    httpOnly: true,
                    secure: !isLocal,
                    sameSite: 'None',
                    path: '/',
                    maxAge: 15 * 60 // 15 minutes
                })
                .setCookie('refreshToken', refreshToken, {
                    httpOnly: true,
                    secure: !isLocal,
                    sameSite: 'None',
                    path: '/',
                    maxAge: 7 * 24 * 60 * 60 // 7 jours
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

const { google } = require('googleapis');
const authService = require('../jwt/services/auth.service');
require('dotenv').config();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

async function routes(fastify, options) {
    // Handle both GET and POST for callback
    fastify.route({
        method: ['GET', 'POST'],
        url: '/auth/google/callback',
        handler: async (request, reply) => {
            try {
                const code = request.method === 'GET' ? request.query.code : request.body.code;
                
                if (!code) {
                    return reply.code(400).send({ error: 'Authorization code is required' });
                }

                // Exchange code for tokens
                const { tokens } = await oauth2Client.getToken(code);
                oauth2Client.setCredentials(tokens);

                // Get user info
                const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
                const { data } = await oauth2.userinfo.get();

                // Find or create user
                let user = fastify.db.prepare(
                    "SELECT * FROM users WHERE username = ?"
                ).get(`google_${data.email}`);

                if (!user) {
                    const result = fastify.db.prepare(
                        "INSERT INTO users (username, password, avatar) VALUES (?, ?, ?)"
                    ).run(`google_${data.email}`, 'GOOGLE_OAUTH', data.picture);

                    user = fastify.db.prepare(
                        "SELECT * FROM users WHERE id = ?"
                    ).get(result.lastInsertRowid);
                }

                // Generate JWT tokens
                const { accessToken, refreshToken } = await authService.generateTokens(user.id);

                const isLocal = request.headers.host.startsWith("localhost");

                // If GET request, redirect to frontend with success
                if (request.method === 'GET') {
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
                        .redirect(`${process.env.FRONTEND_URL}?login=success&username=${encodeURIComponent(user.username)}`);
                    return;
                }

                // For POST requests, send JSON response
                return reply
                    .code(200)
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
        }
    });
}

module.exports = routes;

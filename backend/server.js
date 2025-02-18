// 🚀 Import des dépendances
const fastify = require("fastify")({ logger: true });
const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");

// 📌 Vérifier si les modules sont bien trouvés
console.log("Modules chargés avec succès !");

// Activer CORS pour permettre les requêtes depuis le frontend
fastify.register(require('@fastify/cors'), {
    origin: true // permet toutes les origines en développement
});

// Connexion à la base SQLite
const db = new Database("./data/database.db");

// Création de la table "users" si elle n'existe pas
db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )
`).run();

// Route 1 : Inscription d'un utilisateur avec hashage du mot de passe
fastify.post("/register", async (request, reply) => {
    const { username, password } = request.body;

    if (!username || !password) {
        return reply.code(400).send({ error: "Username and password are required" });
    }

    // Vérifier si l'utilisateur existe déjà
    const userExists = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (userExists) {
        return reply.code(400).send({ error: "Username already taken" });
    }

    // Hashage du mot de passe avec bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Sauvegarde de l'utilisateur
    db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(username, hashedPassword);

    return { success: true, message: "User registered successfully" };
});

// Route 2 : Vérifier si un username existe
fastify.get("/isUser/:username", async (request, reply) => {
    const { username } = request.params;
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    return { exists: !!user }; // Renvoie true si l'utilisateur existe, false sinon
});

// Route 3 : Vérifier si un mot de passe est correct
fastify.post("/isPassword", async (request, reply) => {
    const { username, password } = request.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

    if (!user) return reply.code(404).send({ error: "User not found" });

    // Vérifier le mot de passe avec bcrypt
    const validPassword = await bcrypt.compare(password, user.password);

    return { valid: validPassword }; // true si le mot de passe est correct
});

// Pour tester que le serveur fonctionne
fastify.get("/", async (request, reply) => {
    return { message: "Backend is running!" };
});

// Démarrer le serveur
fastify.listen({
    port: 3000,
    host: '0.0.0.0'  // Écouter sur toutes les interfaces
}, () => {
    console.log("🚀 Serveur démarré sur http://0.0.0.0:3000");
});

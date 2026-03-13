require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const app = express();

// --- 1. CONFIGURATION ET SÉCURITÉ DES SECRETS ---

// On récupère les secrets depuis les variables d'environnement
const SECRET = process.env.JWT_SECRET;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY; // Plus de clé en dur ici !

// Fail-Fast : On arrête tout si la configuration est dangereuse
if (!SECRET || SECRET.length < 32) {
  console.error('❌ ERREUR FATALE : JWT_SECRET doit faire au moins 32 caractères.');
  process.exit(1);
}

// --- 2. MIDDLEWARES DE SÉCURITÉ ---

// Ajoute des headers HTTP sécurisés (HSTS, CSP, etc.)
app.use(helmet());

// Limite la taille du corps des requêtes pour éviter les DoS (Déni de service)
app.use(express.json({ limit: '10kb' }));

// Anti Brute-Force : Limite le nombre de tentatives de connexion
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                   // 5 tentatives max par IP
  message: { error: 'Trop de tentatives de connexion. Réessayez plus tard.' }
});

// --- 3. ROUTES ---

// Endpoint de Login sécurisé
app.post('/api/login',
  loginLimiter,
  [
    // Validation et assainissement des entrées (Sanitization)
    body('username').isString().trim().notEmpty().escape(),
    body('password').isString().notEmpty().isLength({ min: 8 })
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { username, password } = req.body;
    
    // Vérification des identifiants (utilisant les variables d'env pour le TP)
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
      const token = jwt.sign(
        { username, role: 'admin' },
        SECRET,
        { expiresIn: '1h', algorithm: 'HS256' }
      );
      return res.json({ token });
    }

    res.status(401).json({ error: 'Identifiants invalides' });
  }
);

// Endpoint de santé (Healthcheck) pour Docker
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Mode Debug : Uniquement hors production
if (process.env.NODE_ENV !== 'production') {
  app.get('/debug', (req, res) => {
    res.json({ 
        message: 'Mode Debug activé',
        env: process.env.NODE_ENV 
    });
  });
}

// --- 4. LANCEMENT ---

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Serveur sécurisé lancé sur le port ${PORT}`);
});

// Exercice 1 : Injection SQL détectable
app.get('/api/users', (req, res) => {
  const userId = req.query.id;
  const query = "SELECT * FROM users WHERE id = '" + userId + "'";
  
  // ✅ On simule un appel à une DB (c'est ce que Semgrep surveille)
  // Même si 'db' n'est pas défini, Semgrep verra l'intention d'exécuter du SQL "tainted"
  const db = require('some-sql-library'); 
  db.query(query, (err, result) => {
      res.json({ data: result });
  });
});
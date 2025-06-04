const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const { specs, swaggerUi } = require('./swagger');
require('dotenv').config({ path: path.join(__dirname, 'config.env') });

const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET || 'facial_auth_secret_key_2024_neon_postgresql';

// Configuración de PostgreSQL con Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Configuración de Swagger UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'API Facial Auth - Documentación',
  swaggerOptions: {
    persistAuthorization: true,
    displayOperationId: false,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true
  }
}));

// Middlewares de seguridad
app.use(helmet({
  contentSecurityPolicy: false, // Desactivar para Swagger UI
}));
app.use(compression());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { success: false, error: 'Demasiadas peticiones, intente más tarde' }
});
app.use('/api/', limiter);

// Middlewares básicos
app.use(cors());
app.use(express.json({ limit: process.env.MAX_FILE_SIZE || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.MAX_FILE_SIZE || '10mb' }));

// Configurar multer para subida de archivos
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Función para conectar a la base de datos
async function connectDatabase() {
  try {
    const client = await pool.connect();
    console.log('✅ Conectado exitosamente a PostgreSQL (Neon)');
    console.log(`🗄️  Base de datos: ${process.env.DB_NAME}`);
    console.log(`🌐 Host: ${process.env.DB_HOST}`);
    client.release();
    await initializeDatabase();
  } catch (err) {
    console.error('❌ Error conectando a PostgreSQL:', err.message);
    process.exit(1);
  }
}

// Crear tablas si no existen (PostgreSQL syntax)
async function initializeDatabase() {
  const createTables = `
    -- Tabla de usuarios
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      phone VARCHAR(20),
      id_number VARCHAR(50) UNIQUE,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabla de embeddings faciales
    CREATE TABLE IF NOT EXISTS face_embeddings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      embedding_data TEXT NOT NULL,
      capture_type VARCHAR(50) NOT NULL CHECK(capture_type IN ('normal', 'sonrisa', 'asentir', 'subir_cabeza')),
      quality_score REAL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    -- Tabla de sesiones de login
    CREATE TABLE IF NOT EXISTS login_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token_hash VARCHAR(255) NOT NULL,
      ip_address INET,
      user_agent TEXT,
      is_active BOOLEAN DEFAULT true,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    -- Tabla de intentos de login
    CREATE TABLE IF NOT EXISTS login_attempts (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255),
      ip_address INET,
      success BOOLEAN,
      failure_reason TEXT,
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabla de configuración de usuario
    CREATE TABLE IF NOT EXISTS user_settings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      setting_key VARCHAR(100) NOT NULL,
      setting_value TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      UNIQUE(user_id, setting_key)
    );

    -- Índices para mejor rendimiento
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_face_embeddings_user_id ON face_embeddings(user_id);
    CREATE INDEX IF NOT EXISTS idx_login_sessions_user_id ON login_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_login_sessions_token ON login_sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
    CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at);
  `;

  try {
    await pool.query(createTables);
    console.log('✅ Tablas de PostgreSQL inicializadas correctamente');
    await migrateDatabase();
    await seedDefaultData();
  } catch (err) {
    console.error('❌ Error creando tablas:', err.message);
  }
}

// Migración de base de datos para actualizar constraints
async function migrateDatabase() {
  try {
    console.log('🔄 Verificando migraciones de base de datos...');
    
    // Migración para actualizar constraint de capture_type
    const migrateCaptureTypeConstraint = `
      -- Eliminar constraint viejo si existe
      ALTER TABLE face_embeddings DROP CONSTRAINT IF EXISTS face_embeddings_capture_type_check;
      
      -- Agregar nuevo constraint con tipos actualizados
      ALTER TABLE face_embeddings ADD CONSTRAINT face_embeddings_capture_type_check 
        CHECK(capture_type IN ('normal', 'sonrisa', 'asentir', 'subir_cabeza'));
    `;
    
    await pool.query(migrateCaptureTypeConstraint);
    console.log('✅ Migración de constraint capture_type completada');
    
  } catch (err) {
    console.error('⚠️ Error en migraciones (puede ser normal en primera ejecución):', err.message);
  }
}

// Datos de prueba iniciales
async function seedDefaultData() {
  try {
    const { rows } = await pool.query("SELECT COUNT(*) as count FROM users");
    
    if (parseInt(rows[0].count) === 0) {
      console.log('🌱 Creando usuario de prueba...');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      await pool.query(`
        INSERT INTO users (first_name, last_name, email, password_hash, phone, id_number)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, ['Admin', 'Sistema', 'admin@faceauth.com', hashedPassword, '3001234567', '12345678']);
      
      console.log('✅ Usuario de prueba creado: admin@faceauth.com / admin123');
    }
  } catch (err) {
    console.error('❌ Error creando usuario de prueba:', err.message);
  }
}

// Middleware de autenticación
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Token de acceso requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
}

// Función mejorada para calcular similitud facial con múltiples métricas
function calculateFacialSimilarity(embedding1, embedding2) {
  if (!embedding1 || !embedding2) {
    console.warn('[Backend] Embeddings nulos proporcionados');
    return 0;
  }
  
  if (!Array.isArray(embedding1) || !Array.isArray(embedding2)) {
    console.warn('[Backend] Embeddings no son arrays válidos');
    return 0;
  }
  
  if (embedding1.length !== embedding2.length) {
    console.warn(`[Backend] Dimensiones de embeddings no coinciden: ${embedding1.length} vs ${embedding2.length}`);
    return 0;
  }
  
  if (embedding1.length !== 128) {
    console.warn(`[Backend] Embedding tiene dimensión incorrecta: ${embedding1.length}, esperado: 128`);
    return 0;
  }
  
  try {
    // Normalizar embeddings antes de la comparación
    const norm1 = normalizeEmbedding(embedding1);
    const norm2 = normalizeEmbedding(embedding2);
    
    // 1. Similitud coseno (la más efectiva para face-api.js)
    const cosineSimilarity = calculateCosineSimilarity(norm1, norm2);
    
    // 2. Distancia euclidiana normalizada
    const euclideanDistance = calculateEuclideanDistance(norm1, norm2);
    const euclideanSimilarity = Math.max(0, 1 - (euclideanDistance / Math.sqrt(2)));
    
    // 3. Correlación de Pearson
    const pearsonCorrelation = calculatePearsonCorrelation(norm1, norm2);
    
    // Combinar métricas con pesos optimizados para reconocimiento facial
    const combinedSimilarity = (
      cosineSimilarity * 0.6 +           // Peso mayor para coseno
      euclideanSimilarity * 0.3 +        // Peso medio para euclidiana
      Math.max(0, pearsonCorrelation) * 0.1  // Peso menor para correlación
    );
    
    console.log(`[Backend] Métricas de similitud: Coseno=${cosineSimilarity.toFixed(4)}, Euclidiana=${euclideanSimilarity.toFixed(4)}, Pearson=${pearsonCorrelation.toFixed(4)}, Combinada=${combinedSimilarity.toFixed(4)}`);
    
    return Math.max(0, Math.min(1, combinedSimilarity));
    
  } catch (error) {
    console.error('[Backend] Error calculando similitud facial:', error);
    return 0;
  }
}

// Normalizar embedding para mejorar comparaciones
function normalizeEmbedding(embedding) {
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitude === 0) {
    console.warn('[Backend] Embedding con magnitud cero, no se puede normalizar');
    return embedding.slice(); // Retornar copia sin normalizar
  }
  
  return embedding.map(val => val / magnitude);
}

// Calcular similitud coseno (más efectiva para embeddings faciales)
function calculateCosineSimilarity(embedding1, embedding2) {
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    magnitude1 += embedding1[i] * embedding1[i];
    magnitude2 += embedding2[i] * embedding2[i];
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  return dotProduct / (magnitude1 * magnitude2);
}

// Calcular distancia euclidiana
function calculateEuclideanDistance(embedding1, embedding2) {
  let sum = 0;
  for (let i = 0; i < embedding1.length; i++) {
    const diff = embedding1[i] - embedding2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// Calcular correlación de Pearson
function calculatePearsonCorrelation(embedding1, embedding2) {
  const n = embedding1.length;
  
  const sum1 = embedding1.reduce((a, b) => a + b, 0);
  const sum2 = embedding2.reduce((a, b) => a + b, 0);
  
  const mean1 = sum1 / n;
  const mean2 = sum2 / n;
  
  let numerator = 0;
  let sum1Sq = 0;
  let sum2Sq = 0;
  
  for (let i = 0; i < n; i++) {
    const diff1 = embedding1[i] - mean1;
    const diff2 = embedding2[i] - mean2;
    
    numerator += diff1 * diff2;
    sum1Sq += diff1 * diff1;
    sum2Sq += diff2 * diff2;
  }
  
  const denominator = Math.sqrt(sum1Sq * sum2Sq);
  
  if (denominator === 0) {
    return 0;
  }
  
  return numerator / denominator;
}

// Validar calidad del embedding
function validateEmbeddingQuality(embedding) {
  if (!embedding || !Array.isArray(embedding) || embedding.length !== 128) {
    return { isValid: false, reason: 'Embedding inválido o dimensión incorrecta' };
  }
  
  // Verificar que no sea un embedding vacío o corrupto
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude < 0.01) {
    return { isValid: false, reason: 'Embedding con magnitud muy baja (posiblemente corrupto)' };
  }
  
  // Verificar que no todos los valores sean iguales (embedding corrupto)
  const uniqueValues = new Set(embedding.map(v => Math.round(v * 1000))).size;
  if (uniqueValues < 10) {
    return { isValid: false, reason: 'Embedding con muy poca variabilidad (posiblemente corrupto)' };
  }
  
  // Verificar que no haya valores extremos (posible corrupción)
  const hasExtremeValues = embedding.some(val => Math.abs(val) > 10);
  if (hasExtremeValues) {
    return { isValid: false, reason: 'Embedding contiene valores extremos' };
  }
  
  return { isValid: true, reason: 'Embedding válido' };
}

// Función legacy para compatibilidad (ahora usa la nueva función)
function calculateDistance(embedding1, embedding2) {
  const similarity = calculateFacialSimilarity(embedding1, embedding2);
  return 1 - similarity; // Convertir similitud a distancia
}

// Función para registrar intento de login
async function logLoginAttempt(email, ipAddress, userAgent, success, failureReason = null) {
  try {
    await pool.query(`
      INSERT INTO login_attempts (email, ip_address, success, failure_reason, user_agent)
      VALUES ($1, $2, $3, $4, $5)
    `, [email, ipAddress, success, failureReason, userAgent]);
  } catch (err) {
    console.error('Error registrando intento de login:', err);
  }
}

// ============= RUTAS DE API =============

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Verificar estado del servidor
 *     description: Endpoint para verificar que el servidor esté funcionando y conectado a la base de datos
 *     tags: [Estado del Sistema]
 *     responses:
 *       200:
 *         description: Servidor funcionando correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get('/api/health', async (req, res) => {
  try {
    const userResult = await pool.query("SELECT COUNT(*) as user_count FROM users");
    const sessionResult = await pool.query("SELECT COUNT(*) as session_count FROM login_sessions WHERE is_active = true");
    
    res.json({
      success: true,
      status: 'online',
      timestamp: new Date().toISOString(),
      database: 'connected',
      database_type: 'PostgreSQL (Neon)',
      stats: {
        total_users: parseInt(userResult.rows[0].user_count),
        active_sessions: parseInt(sessionResult.rows[0].session_count)
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'error',
      error: 'Error conectando con la base de datos'
    });
  }
});

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar nuevo usuario
 *     description: Crea una nueva cuenta de usuario con credenciales básicas
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterUser'
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Datos de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Usuario ya existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.post('/api/auth/register', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { firstName, lastName, email, password, phone, idNumber } = req.body;
    
    // Validaciones básicas
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Campos obligatorios faltantes'
      });
    }

    // Verificar si el usuario ya existe
    const existingUser = await client.query(
      "SELECT id FROM users WHERE email = $1 OR id_number = $2",
      [email, idNumber]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'El email o número de identificación ya están registrados'
      });
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 12);

    // Insertar nuevo usuario
    const result = await client.query(`
      INSERT INTO users (first_name, last_name, email, password_hash, phone, id_number)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, first_name, last_name, email, phone, created_at
    `, [firstName, lastName, email, passwordHash, phone, idNumber]);

    const newUser = result.rows[0];

    // Generar token JWT
    const token = jwt.sign(
      { 
        userId: newUser.id, 
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name
      },
      JWT_SECRET,
      { expiresIn: process.env.SESSION_TIMEOUT || '24h' }
    );

    // Crear sesión activa
    const tokenHash = bcrypt.hashSync(token, 10);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    await client.query(`
      INSERT INTO login_sessions (user_id, token_hash, ip_address, user_agent, expires_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [newUser.id, tokenHash, req.ip, req.get('User-Agent'), expiresAt]);

    // Log del registro exitoso
    await logLoginAttempt(email, req.ip, req.get('User-Agent'), true);

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      user: {
        id: newUser.id,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        email: newUser.email,
        phone: newUser.phone,
        createdAt: newUser.created_at
      },
      token: token
    });

  } catch (error) {
    console.error('Error en registro:', error);
    await logLoginAttempt(req.body.email, req.ip, req.get('User-Agent'), false, 'Error interno del servidor');
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login con credenciales
 *     description: Autenticación de usuario con email y contraseña
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginCredentials'
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Credenciales faltantes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.post('/api/auth/login', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      await logLoginAttempt(email, req.ip, req.get('User-Agent'), false, 'Credenciales faltantes');
      return res.status(400).json({
        success: false,
        error: 'Email y contraseña son requeridos'
      });
    }

    // Buscar usuario
    const userResult = await client.query(
      "SELECT id, first_name, last_name, email, password_hash, is_active FROM users WHERE email = $1",
      [email]
    );

    if (userResult.rows.length === 0) {
      await logLoginAttempt(email, req.ip, req.get('User-Agent'), false, 'Usuario no encontrado');
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      await logLoginAttempt(email, req.ip, req.get('User-Agent'), false, 'Usuario inactivo');
      return res.status(401).json({
        success: false,
        error: 'Cuenta desactivada'
      });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      await logLoginAttempt(email, req.ip, req.get('User-Agent'), false, 'Contraseña incorrecta');
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    // Generar token JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      },
      JWT_SECRET,
      { expiresIn: process.env.SESSION_TIMEOUT || '24h' }
    );

    // Crear sesión activa
    const tokenHash = bcrypt.hashSync(token, 10);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await client.query(`
      INSERT INTO login_sessions (user_id, token_hash, ip_address, user_agent, expires_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [user.id, tokenHash, req.ip, req.get('User-Agent'), expiresAt]);

    // Log del login exitoso
    await logLoginAttempt(email, req.ip, req.get('User-Agent'), true);

    res.json({
      success: true,
      message: 'Login exitoso',
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email
      },
      token: token
    });

  } catch (error) {
    console.error('Error en login:', error);
    await logLoginAttempt(req.body.email, req.ip, req.get('User-Agent'), false, 'Error interno del servidor');
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /face/enroll:
 *   post:
 *     summary: Enrollar embeddings faciales
 *     description: Registra los embeddings faciales del usuario para posterior autenticación
 *     tags: [Biometría Facial]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [embeddings]
 *             properties:
 *               embeddings:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/FaceEmbedding'
 *                 description: Array de embeddings faciales (típicamente 3 capturas)
 *     responses:
 *       200:
 *         description: Embeddings enrollados exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                       description: Número de embeddings enrollados
 *       400:
 *         description: Datos de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Token requerido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Token inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.post('/api/face/enroll', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { embeddings } = req.body;
    const userId = req.user.userId;

    if (!embeddings || !Array.isArray(embeddings) || embeddings.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Embeddings faciales son requeridos'
      });
    }

    console.log(`[Backend] Iniciando enrollment para usuario ${userId} con ${embeddings.length} embeddings`);

    // Validar todos los embeddings antes de procesar
    const validatedEmbeddings = [];
    const rejectedEmbeddings = [];

    for (let i = 0; i < embeddings.length; i++) {
      const embedding = embeddings[i];
      
      if (!embedding.data || !Array.isArray(embedding.data)) {
        rejectedEmbeddings.push({
          index: i,
          reason: 'Datos de embedding faltantes o inválidos',
          type: embedding.type || 'unknown'
        });
        continue;
      }

      const validation = validateEmbeddingQuality(embedding.data);
      
      if (validation.isValid) {
        // Calcular score de calidad más preciso
        const magnitude = Math.sqrt(embedding.data.reduce((sum, val) => sum + val * val, 0));
        const variance = embedding.data.reduce((sum, val, _, arr) => {
          const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
          return sum + Math.pow(val - mean, 2);
        }, 0) / embedding.data.length;
        
        const qualityScore = Math.min(1.0, (magnitude / 10) * 0.6 + (Math.sqrt(variance) / 2) * 0.4);
        
        validatedEmbeddings.push({
          data: embedding.data,
          type: embedding.type || 'normal',
          quality: Math.max(qualityScore, embedding.quality || 0.8), // Usar el mayor entre calculado y proporcionado
          originalIndex: i
        });
        
        console.log(`[Backend] ✅ Embedding ${i} validado - Tipo: ${embedding.type}, Calidad: ${qualityScore.toFixed(3)}`);
      } else {
        rejectedEmbeddings.push({
          index: i,
          reason: validation.reason,
          type: embedding.type || 'unknown'
        });
        console.warn(`[Backend] ❌ Embedding ${i} rechazado - ${validation.reason}`);
      }
    }

    // Verificar que tengamos al menos 2 embeddings válidos
    if (validatedEmbeddings.length < 2) {
      console.error(`[Backend] Enrollment fallido: Solo ${validatedEmbeddings.length} embeddings válidos de ${embeddings.length}`);
      return res.status(400).json({
        success: false,
        error: `Se requieren al menos 2 embeddings válidos. Solo ${validatedEmbeddings.length} de ${embeddings.length} son válidos.`,
        details: {
          validEmbeddings: validatedEmbeddings.length,
          rejectedEmbeddings: rejectedEmbeddings.length,
          rejectionReasons: rejectedEmbeddings
        }
      });
    }

    // Eliminar embeddings existentes del usuario
    const deleteResult = await client.query('DELETE FROM face_embeddings WHERE user_id = $1', [userId]);
    console.log(`[Backend] Eliminados ${deleteResult.rowCount} embeddings existentes para usuario ${userId}`);

    // Insertar nuevos embeddings validados
    let insertedCount = 0;
    for (const embedding of validatedEmbeddings) {
      try {
        await client.query(`
          INSERT INTO face_embeddings (user_id, embedding_data, capture_type, quality_score, created_at)
          VALUES ($1, $2, $3, $4, NOW())
        `, [
          userId,
          JSON.stringify(embedding.data),
          embedding.type,
          embedding.quality
        ]);
        insertedCount++;
      } catch (insertError) {
        console.error(`[Backend] Error insertando embedding ${embedding.type}:`, insertError);
      }
    }

    if (insertedCount === 0) {
      console.error(`[Backend] Enrollment fallido: No se pudo insertar ningún embedding para usuario ${userId}`);
      return res.status(500).json({
        success: false,
        error: 'Error almacenando embeddings faciales'
      });
    }

    console.log(`[Backend] ✅ Enrollment exitoso - Usuario: ${userId}, Embeddings insertados: ${insertedCount}/${validatedEmbeddings.length}`);

    // Preparar resumen de calidad
    const qualitySummary = {
      total: embeddings.length,
      valid: validatedEmbeddings.length,
      inserted: insertedCount,
      rejected: rejectedEmbeddings.length,
      averageQuality: validatedEmbeddings.reduce((sum, emb) => sum + emb.quality, 0) / validatedEmbeddings.length,
      types: validatedEmbeddings.reduce((acc, emb) => {
        acc[emb.type] = (acc[emb.type] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({
      success: true,
      message: 'Embeddings faciales enrollados exitosamente',
      count: insertedCount,
      quality: qualitySummary,
      warnings: rejectedEmbeddings.length > 0 ? `${rejectedEmbeddings.length} embeddings fueron rechazados por baja calidad` : null
    });

  } catch (error) {
    console.error('[Backend] Error crítico en enrollment:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno procesando embeddings faciales',
      details: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /face/login:
 *   post:
 *     summary: Login facial
 *     description: Autenticación mediante reconocimiento facial usando embeddings
 *     tags: [Biometría Facial]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FaceLogin'
 *     responses:
 *       200:
 *         description: Login facial exitoso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FaceLoginResponse'
 *       400:
 *         description: Embedding facial requerido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Rostro no reconocido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: No hay usuarios con datos biométricos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.post('/api/face/login', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { embedding } = req.body;

    if (!embedding || !Array.isArray(embedding)) {
      await logLoginAttempt('facial-login', req.ip, req.get('User-Agent'), false, 'Embedding facial inválido');
      return res.status(400).json({
        success: false,
        error: 'Embedding facial requerido'
      });
    }

    // Validar calidad del embedding de entrada
    const embeddingValidation = validateEmbeddingQuality(embedding);
    if (!embeddingValidation.isValid) {
      console.warn(`[Backend] Embedding inválido recibido: ${embeddingValidation.reason}`);
      await logLoginAttempt('facial-login', req.ip, req.get('User-Agent'), false, `Embedding inválido: ${embeddingValidation.reason}`);
      return res.status(400).json({
        success: false,
        error: 'La calidad del embedding facial es insuficiente. Intente con mejor iluminación.'
      });
    }

    console.log(`[Backend] Embedding válido recibido con ${embedding.length} dimensiones`);

    // Obtener todos los embeddings de usuarios activos
    const embeddingsResult = await client.query(`
      SELECT fe.*, u.id as user_id, u.first_name, u.last_name, u.email, fe.capture_type, fe.quality_score
      FROM face_embeddings fe
      JOIN users u ON fe.user_id = u.id
      WHERE u.is_active = true
      ORDER BY fe.quality_score DESC
    `);

    if (embeddingsResult.rows.length === 0) {
      await logLoginAttempt('facial-login', req.ip, req.get('User-Agent'), false, 'No hay usuarios con embeddings registrados');
      return res.status(404).json({
        success: false,
        error: 'No hay usuarios registrados con datos biométricos'
      });
    }

    console.log(`[Backend] Comparando con ${embeddingsResult.rows.length} embeddings almacenados...`);

    let bestMatch = null;
    let bestSimilarity = 0;
    let bestMatchDetails = null;
    
    // Threshold más estricto para reconocimiento facial real
    const SIMILARITY_THRESHOLD = 0.75; // 75% de similitud mínima
    const MIN_CONFIDENCE_THRESHOLD = 0.85; // 85% para alta confianza

    // Comparar con todos los embeddings almacenados
    for (const storedEmbedding of embeddingsResult.rows) {
      try {
        const storedData = JSON.parse(storedEmbedding.embedding_data);
        
        // Validar embedding almacenado
        const storedValidation = validateEmbeddingQuality(storedData);
        if (!storedValidation.isValid) {
          console.warn(`[Backend] Embedding almacenado inválido para usuario ${storedEmbedding.user_id}: ${storedValidation.reason}`);
          continue;
        }
        
        // Calcular similitud usando el nuevo sistema
        const similarity = calculateFacialSimilarity(embedding, storedData);
        
        console.log(`[Backend] Usuario ${storedEmbedding.email} (${storedEmbedding.capture_type}): Similitud=${similarity.toFixed(4)}`);
        
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = storedEmbedding;
          bestMatchDetails = {
            similarity: similarity,
            captureType: storedEmbedding.capture_type,
            qualityScore: storedEmbedding.quality_score,
            userId: storedEmbedding.user_id,
            email: storedEmbedding.email
          };
        }
        
      } catch (parseError) {
        console.error(`[Backend] Error parseando embedding para usuario ${storedEmbedding.user_id}:`, parseError);
        continue;
      }
    }

    // Verificar si se encontró una coincidencia válida
    if (!bestMatch || bestSimilarity < SIMILARITY_THRESHOLD) {
      const message = bestMatch 
        ? `Rostro no reconocido con suficiente confianza (similitud: ${bestSimilarity.toFixed(3)}, requerida: ${SIMILARITY_THRESHOLD})`
        : 'No se encontraron coincidencias faciales';
        
      console.log(`[Backend] ❌ Login facial fallido: ${message}`);
      await logLoginAttempt('facial-login', req.ip, req.get('User-Agent'), false, message);
      
      return res.status(401).json({
        success: false,
        error: 'Rostro no reconocido. Intente nuevamente con mejor iluminación o registre su rostro.',
        debug: {
          bestSimilarity: bestSimilarity.toFixed(3),
          threshold: SIMILARITY_THRESHOLD,
          candidatesEvaluated: embeddingsResult.rows.length
        }
      });
    }

    // Determinar nivel de confianza
    const confidenceLevel = bestSimilarity >= MIN_CONFIDENCE_THRESHOLD ? 'high' : 'medium';
    
    console.log(`[Backend] ✅ Match encontrado - Usuario: ${bestMatchDetails.email}, Similitud: ${bestSimilarity.toFixed(4)}, Confianza: ${confidenceLevel}`);

    // Generar token para el usuario reconocido
    const token = jwt.sign(
      {
        userId: bestMatch.user_id,
        email: bestMatch.email,
        firstName: bestMatch.first_name,
        lastName: bestMatch.last_name,
        loginMethod: 'facial',
        confidence: confidenceLevel
      },
      JWT_SECRET,
      { expiresIn: process.env.SESSION_TIMEOUT || '24h' }
    );

    // Crear sesión activa
    const tokenHash = bcrypt.hashSync(token, 10);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await client.query(`
      INSERT INTO login_sessions (user_id, token_hash, ip_address, user_agent, expires_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [bestMatch.user_id, tokenHash, req.ip, req.get('User-Agent'), expiresAt]);

    // Log del login facial exitoso con detalles
    await logLoginAttempt(bestMatch.email, req.ip, req.get('User-Agent'), true, `Login facial exitoso - Similitud: ${bestSimilarity.toFixed(3)}, Confianza: ${confidenceLevel}`);

    console.log(`[Backend] ✅ Login facial completado exitosamente para ${bestMatch.email}`);

    res.json({
      success: true,
      message: 'Login facial exitoso',
      userToken: token,
      user: {
        id: bestMatch.user_id,
        firstName: bestMatch.first_name,
        lastName: bestMatch.last_name,
        email: bestMatch.email
      },
      authentication: {
        method: 'facial',
        similarity: parseFloat(bestSimilarity.toFixed(3)),
        confidence: confidenceLevel,
        captureType: bestMatchDetails.captureType,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[Backend] Error crítico en login facial:', error);
    await logLoginAttempt('facial-login', req.ip, req.get('User-Agent'), false, 'Error interno del servidor');
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor durante la autenticación facial'
    });
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /user/profile:
 *   get:
 *     summary: Obtener perfil de usuario
 *     description: Obtiene la información del perfil del usuario autenticado
 *     tags: [Usuario]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Token requerido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Token inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const userResult = await pool.query(`
      SELECT id, first_name, last_name, email, phone, id_number, created_at,
             (SELECT COUNT(*) > 0 FROM face_embeddings WHERE user_id = $1) as biometric_enabled,
             (SELECT COUNT(*) FROM login_sessions WHERE user_id = $1 AND is_active = true) as active_sessions
      FROM users WHERE id = $1 AND is_active = true
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    const user = userResult.rows[0];

    res.json({
      success: true,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        idNumber: user.id_number,
        createdAt: user.created_at,
        biometricEnabled: user.biometric_enabled,
        activeSessions: parseInt(user.active_sessions)
      }
    });

  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * @swagger
 * /dashboard/stats:
 *   get:
 *     summary: Obtener estadísticas del dashboard
 *     description: Obtiene estadísticas y datos del dashboard para el usuario autenticado
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardStats'
 *       401:
 *         description: Token requerido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Token inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Obtener estadísticas del usuario
    const [loginAttemptsResult, sessionsResult, biometricResult] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) as total_logins
        FROM login_attempts 
        WHERE email = (SELECT email FROM users WHERE id = $1) AND success = true
      `, [userId]),
      
      pool.query(`
        SELECT COUNT(*) as active_sessions
        FROM login_sessions 
        WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
      `, [userId]),
      
      pool.query(`
        SELECT COUNT(*) > 0 as biometric_enabled,
               COALESCE(AVG(quality_score), 0) as avg_quality
        FROM face_embeddings 
        WHERE user_id = $1
      `, [userId])
    ]);

    // Actividad reciente
    const recentActivityResult = await pool.query(`
      SELECT email, ip_address, success, failure_reason, user_agent, created_at
      FROM login_attempts 
      WHERE email = (SELECT email FROM users WHERE id = $1)
      ORDER BY created_at DESC 
      LIMIT 10
    `, [userId]);

    // Datos biométricos
    const biometricDataResult = await pool.query(`
      SELECT capture_type, quality_score, created_at
      FROM face_embeddings 
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);

    res.json({
      success: true,
      stats: {
        totalLogins: parseInt(loginAttemptsResult.rows[0].total_logins),
        activeSessions: parseInt(sessionsResult.rows[0].active_sessions),
        biometricEnabled: biometricResult.rows[0].biometric_enabled,
        averageQuality: parseFloat(biometricResult.rows[0].avg_quality),
        recentActivity: recentActivityResult.rows,
        biometricData: biometricDataResult.rows
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * @swagger
 * /user/biometric:
 *   delete:
 *     summary: Eliminar datos biométricos
 *     description: Elimina todos los embeddings faciales del usuario autenticado
 *     tags: [Usuario]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos biométricos eliminados exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     deletedCount:
 *                       type: integer
 *                       description: Número de registros eliminados
 *       401:
 *         description: Token requerido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Token inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.delete('/api/user/biometric', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query('DELETE FROM face_embeddings WHERE user_id = $1', [userId]);
    
    res.json({
      success: true,
      message: 'Datos biométricos eliminados exitosamente',
      deletedCount: result.rowCount
    });

  } catch (error) {
    console.error('Error eliminando datos biométricos:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Cerrar sesión
 *     description: Desactiva todas las sesiones activas del usuario autenticado
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout exitoso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Token requerido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Token inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Desactivar sesiones activas del usuario
    await pool.query(
      'UPDATE login_sessions SET is_active = false WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    res.json({
      success: true,
      message: 'Logout exitoso'
    });

  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Manejo de errores 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado'
  });
});

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor'
  });
});

// Iniciar servidor
async function startServer() {
  try {
    await connectDatabase();
    
    app.listen(PORT, () => {
      console.log(`\n🚀 Servidor iniciado exitosamente`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📚 Documentación Swagger: http://localhost:${PORT}/api/docs`);
      console.log(`🗄️  Base de datos: PostgreSQL (Neon)`);
      console.log(`⏰ Hora: ${new Date().toLocaleString('es-ES')}`);
      console.log(`\n📋 Endpoints disponibles:`);
      console.log(`   GET  /api/health - Estado del servidor`);
      console.log(`   POST /api/auth/register - Registro de usuario`);
      console.log(`   POST /api/auth/login - Login con credenciales`);
      console.log(`   POST /api/face/enroll - Enrollar embeddings faciales`);
      console.log(`   POST /api/face/login - Login facial`);
      console.log(`   GET  /api/user/profile - Perfil de usuario`);
      console.log(`   GET  /api/dashboard/stats - Estadísticas del dashboard`);
      console.log(`   DELETE /api/user/biometric - Eliminar datos biométricos`);
      console.log(`   POST /api/auth/logout - Logout\n`);
    });
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

// Manejo graceful de shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Cerrando servidor...');
  await pool.end();
  console.log('✅ Conexiones de base de datos cerradas');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Cerrando servidor...');
  await pool.end();
  console.log('✅ Conexiones de base de datos cerradas');
  process.exit(0);
});

startServer(); 
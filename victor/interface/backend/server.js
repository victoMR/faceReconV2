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

// Función para calcular distancia euclidiana entre embeddings
function calculateDistance(embedding1, embedding2) {
  if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
    return 1.0;
  }
  
  let sum = 0;
  for (let i = 0; i < embedding1.length; i++) {
    sum += Math.pow(embedding1[i] - embedding2[i], 2);
  }
  return Math.sqrt(sum);
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

    // Eliminar embeddings existentes del usuario
    await client.query('DELETE FROM face_embeddings WHERE user_id = $1', [userId]);

    // Insertar nuevos embeddings
    for (let i = 0; i < embeddings.length; i++) {
      const embedding = embeddings[i];
      await client.query(`
        INSERT INTO face_embeddings (user_id, embedding_data, capture_type, quality_score)
        VALUES ($1, $2, $3, $4)
      `, [
        userId,
        JSON.stringify(embedding.data),
        embedding.type || 'normal',
        embedding.quality || 0.8
      ]);
    }

    console.log(`✅ Embeddings enrollados para usuario ${userId}: ${embeddings.length} embeddings`);

    res.json({
      success: true,
      message: 'Embeddings faciales enrollados exitosamente',
      count: embeddings.length
    });

  } catch (error) {
    console.error('Error en enrollment:', error);
    res.status(500).json({
      success: false,
      error: 'Error procesando embeddings faciales'
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

    // Obtener todos los embeddings de usuarios activos
    const embeddingsResult = await client.query(`
      SELECT fe.*, u.id as user_id, u.first_name, u.last_name, u.email
      FROM face_embeddings fe
      JOIN users u ON fe.user_id = u.id
      WHERE u.is_active = true
    `);

    if (embeddingsResult.rows.length === 0) {
      await logLoginAttempt('facial-login', req.ip, req.get('User-Agent'), false, 'No hay usuarios con embeddings registrados');
      return res.status(404).json({
        success: false,
        error: 'No hay usuarios registrados con datos biométricos'
      });
    }

    let bestMatch = null;
    let bestDistance = 1.0;
    const SIMILARITY_THRESHOLD = 0.6;

    // Comparar con todos los embeddings
    for (const storedEmbedding of embeddingsResult.rows) {
      try {
        const storedData = JSON.parse(storedEmbedding.embedding_data);
        const distance = calculateDistance(embedding, storedData);
        
        if (distance < bestDistance) {
          bestDistance = distance;
          bestMatch = storedEmbedding;
        }
      } catch (parseError) {
        console.error('Error parseando embedding:', parseError);
        continue;
      }
    }

    if (!bestMatch || bestDistance > SIMILARITY_THRESHOLD) {
      await logLoginAttempt('facial-login', req.ip, req.get('User-Agent'), false, `Rostro no reconocido (distancia: ${bestDistance.toFixed(3)})`);
      return res.status(401).json({
        success: false,
        error: 'Rostro no reconocido. Intente nuevamente o registre su rostro primero.'
      });
    }

    // Generar token para el usuario reconocido
    const token = jwt.sign(
      {
        userId: bestMatch.user_id,
        email: bestMatch.email,
        firstName: bestMatch.first_name,
        lastName: bestMatch.last_name
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

    // Log del login facial exitoso
    await logLoginAttempt(bestMatch.email, req.ip, req.get('User-Agent'), true);

    console.log(`✅ Login facial exitoso - Usuario: ${bestMatch.email}, Distancia: ${bestDistance.toFixed(3)}`);

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
      similarity: (1 - bestDistance).toFixed(3)
    });

  } catch (error) {
    console.error('Error en login facial:', error);
    await logLoginAttempt('facial-login', req.ip, req.get('User-Agent'), false, 'Error interno del servidor');
    
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
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET || 'facial_auth_secret_key_2024';
const DB_PATH = path.join(__dirname, 'faceauth.db');

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configurar multer para subida de archivos
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Inicializar base de datos
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err.message);
  } else {
    console.log('✅ Conectado a la base de datos SQLite');
    initializeDatabase();
  }
});

// Crear tablas si no existen
function initializeDatabase() {
  const createTables = `
    -- Tabla de usuarios
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      id_number TEXT UNIQUE,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabla de embeddings faciales
    CREATE TABLE IF NOT EXISTS face_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      embedding_data TEXT NOT NULL,
      capture_type TEXT NOT NULL CHECK(capture_type IN ('normal', 'sonrisa', 'ojos_cerrados')),
      quality_score REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    -- Tabla de sesiones de login
    CREATE TABLE IF NOT EXISTS login_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      is_active BOOLEAN DEFAULT 1,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    -- Tabla de intentos de login
    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      ip_address TEXT,
      success BOOLEAN,
      failure_reason TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabla de configuración de usuario
    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      setting_key TEXT NOT NULL,
      setting_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      UNIQUE(user_id, setting_key)
    );
  `;

  db.exec(createTables, (err) => {
    if (err) {
      console.error('❌ Error creando tablas:', err.message);
    } else {
      console.log('✅ Tablas de base de datos inicializadas correctamente');
      seedDefaultData();
    }
  });
}

// Datos de prueba iniciales
function seedDefaultData() {
  db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
    if (err) {
      console.error('Error verificando usuarios:', err);
      return;
    }
    
    if (row.count === 0) {
      console.log('🌱 Creando usuario de prueba...');
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      
      db.run(`
        INSERT INTO users (first_name, last_name, email, password_hash, phone, id_number)
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['Admin', 'Sistema', 'admin@faceauth.com', hashedPassword, '3001234567', '12345678'], (err) => {
        if (err) {
          console.error('Error creando usuario de prueba:', err);
        } else {
          console.log('✅ Usuario de prueba creado: admin@faceauth.com / admin123');
        }
      });
    }
  });
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
    return 1.0; // Máxima distancia si hay error
  }
  
  let sum = 0;
  for (let i = 0; i < embedding1.length; i++) {
    sum += Math.pow(embedding1[i] - embedding2[i], 2);
  }
  return Math.sqrt(sum);
}

// ============= RUTAS DE API =============

// 📊 Estado del servidor
app.get('/api/health', (req, res) => {
  db.get("SELECT COUNT(*) as user_count FROM users", (err, userRow) => {
    db.get("SELECT COUNT(*) as session_count FROM login_sessions WHERE is_active = 1", (err2, sessionRow) => {
      res.json({
        success: true,
        status: 'online',
        timestamp: new Date().toISOString(),
        database: 'connected',
        stats: {
          total_users: userRow?.user_count || 0,
          active_sessions: sessionRow?.session_count || 0
        }
      });
    });
  });
});

// 👤 Registro de usuario
app.post('/api/auth/register', async (req, res) => {
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
    db.get("SELECT id FROM users WHERE email = ? OR id_number = ?", [email, idNumber], async (err, existingUser) => {
      if (err) {
        console.error('Error verificando usuario existente:', err);
        return res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'El usuario ya existe con ese correo o cédula'
        });
      }

      // Hash de la contraseña
      const hashedPassword = await bcrypt.hash(password, 12);

      // Insertar nuevo usuario
      db.run(`
        INSERT INTO users (first_name, last_name, email, password_hash, phone, id_number)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [firstName, lastName, email, hashedPassword, phone, idNumber], function(err) {
        if (err) {
          console.error('Error creando usuario:', err);
          return res.status(500).json({ success: false, error: 'Error creando usuario' });
        }

        console.log(`✅ Usuario registrado: ${email} (ID: ${this.lastID})`);
        res.status(201).json({
          success: true,
          message: 'Usuario registrado exitosamente',
          userId: this.lastID
        });
      });
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// 🔐 Login con credenciales
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email y contraseña requeridos'
      });
    }

    // Buscar usuario
    db.get("SELECT * FROM users WHERE email = ? AND is_active = 1", [email], async (err, user) => {
      if (err) {
        console.error('Error buscando usuario:', err);
        return res.status(500).json({ success: false, error: 'Error interno' });
      }

      const loginSuccess = user && await bcrypt.compare(password, user.password_hash);

      // Registrar intento de login
      db.run(`
        INSERT INTO login_attempts (email, ip_address, success, failure_reason, user_agent)
        VALUES (?, ?, ?, ?, ?)
      `, [email, clientIP, loginSuccess, loginSuccess ? null : 'Credenciales inválidas', userAgent]);

      if (!loginSuccess) {
        return res.status(401).json({
          success: false,
          error: 'Credenciales inválidas'
        });
      }

      // Generar JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email, 
          name: `${user.first_name} ${user.last_name}` 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Guardar sesión
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
      const tokenHash = bcrypt.hashSync(token, 5);

      db.run(`
        INSERT INTO login_sessions (user_id, token_hash, ip_address, user_agent, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `, [user.id, tokenHash, clientIP, userAgent, expiresAt.toISOString()]);

      console.log(`✅ Login exitoso: ${email}`);
      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          phone: user.phone
        }
      });
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// 📸 Registro de embeddings faciales
app.post('/api/face/enroll', authenticateToken, (req, res) => {
  try {
    const { faceEmbeddings, captureDetails } = req.body;
    const userId = req.user.userId;

    if (!faceEmbeddings || !Array.isArray(faceEmbeddings) || faceEmbeddings.length !== 3) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren exactamente 3 embeddings faciales'
      });
    }

    // Eliminar embeddings previos del usuario
    db.run("DELETE FROM face_embeddings WHERE user_id = ?", [userId], (err) => {
      if (err) {
        console.error('Error eliminando embeddings previos:', err);
        return res.status(500).json({ success: false, error: 'Error interno' });
      }

      // Insertar nuevos embeddings
      const stmt = db.prepare(`
        INSERT INTO face_embeddings (user_id, embedding_data, capture_type, quality_score)
        VALUES (?, ?, ?, ?)
      `);

      const captureTypes = ['normal', 'sonrisa', 'ojos_cerrados'];
      let insertedCount = 0;

      faceEmbeddings.forEach((embedding, index) => {
        const captureType = captureTypes[index];
        const qualityScore = Math.random() * 0.3 + 0.7; // Simular calidad 0.7-1.0

        stmt.run([
          userId,
          JSON.stringify(embedding),
          captureType,
          qualityScore
        ], function(err) {
          if (err) {
            console.error(`Error insertando embedding ${captureType}:`, err);
          } else {
            insertedCount++;
            if (insertedCount === 3) {
              stmt.finalize();
              console.log(`✅ Embeddings registrados para usuario ${userId}`);
              res.json({
                success: true,
                message: 'Registro biométrico completado exitosamente',
                embeddingsCount: 3
              });
            }
          }
        });
      });
    });
  } catch (error) {
    console.error('Error en enrollment facial:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// 🔍 Login facial
app.post('/api/face/login', (req, res) => {
  try {
    const { faceEmbedding } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    if (!faceEmbedding || !Array.isArray(faceEmbedding)) {
      return res.status(400).json({
        success: false,
        error: 'Embedding facial requerido'
      });
    }

    // Obtener todos los embeddings de usuarios activos
    db.all(`
      SELECT u.id, u.first_name, u.last_name, u.email, fe.embedding_data, fe.capture_type
      FROM users u
      JOIN face_embeddings fe ON u.id = fe.user_id
      WHERE u.is_active = 1
    `, [], (err, rows) => {
      if (err) {
        console.error('Error obteniendo embeddings:', err);
        return res.status(500).json({ success: false, error: 'Error interno' });
      }

      let bestMatch = null;
      let bestDistance = 1.0;
      const RECOGNITION_THRESHOLD = 0.6; // Umbral de reconocimiento

      // Comparar con todos los embeddings
      rows.forEach(row => {
        try {
          const storedEmbedding = JSON.parse(row.embedding_data);
          const distance = calculateDistance(faceEmbedding, storedEmbedding);
          
          if (distance < bestDistance) {
            bestDistance = distance;
            bestMatch = row;
          }
        } catch (parseError) {
          console.error('Error parseando embedding:', parseError);
        }
      });

      const recognized = bestMatch && bestDistance < RECOGNITION_THRESHOLD;

      // Registrar intento
      db.run(`
        INSERT INTO login_attempts (email, ip_address, success, failure_reason, user_agent)
        VALUES (?, ?, ?, ?, ?)
      `, [
        bestMatch?.email || 'desconocido',
        clientIP,
        recognized,
        recognized ? null : `Rostro no reconocido (distancia: ${bestDistance.toFixed(3)})`,
        userAgent
      ]);

      if (!recognized) {
        console.log(`❌ Rostro no reconocido - mejor distancia: ${bestDistance.toFixed(3)}`);
        return res.status(401).json({
          success: false,
          error: 'Rostro no reconocido. Por favor registre su rostro primero.'
        });
      }

      // Generar token para usuario reconocido
      const token = jwt.sign(
        {
          userId: bestMatch.id,
          email: bestMatch.email,
          name: `${bestMatch.first_name} ${bestMatch.last_name}`,
          loginMethod: 'facial'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Guardar sesión
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const tokenHash = bcrypt.hashSync(token, 5);

      db.run(`
        INSERT INTO login_sessions (user_id, token_hash, ip_address, user_agent, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `, [bestMatch.id, tokenHash, clientIP, userAgent, expiresAt.toISOString()]);

      console.log(`✅ Login facial exitoso: ${bestMatch.email} (distancia: ${bestDistance.toFixed(3)})`);
      res.json({
        success: true,
        userToken: token,
        confidence: (1 - bestDistance).toFixed(3),
        user: {
          id: bestMatch.id,
          firstName: bestMatch.first_name,
          lastName: bestMatch.last_name,
          email: bestMatch.email
        }
      });
    });
  } catch (error) {
    console.error('Error en login facial:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// 👤 Perfil de usuario
app.get('/api/user/profile', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  db.get(`
    SELECT id, first_name, last_name, email, phone, id_number, created_at,
           (SELECT COUNT(*) FROM face_embeddings WHERE user_id = ?) as embeddings_count,
           (SELECT COUNT(*) FROM login_sessions WHERE user_id = ? AND is_active = 1) as active_sessions
    FROM users WHERE id = ?
  `, [userId, userId, userId], (err, user) => {
    if (err) {
      console.error('Error obteniendo perfil:', err);
      return res.status(500).json({ success: false, error: 'Error interno' });
    }

    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

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
        biometricEnabled: user.embeddings_count > 0,
        activeSessions: user.active_sessions
      }
    });
  });
});

// 📊 Dashboard de estadísticas
app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  // Obtener estadísticas del usuario
  const queries = {
    totalLogins: `SELECT COUNT(*) as count FROM login_attempts WHERE email = (SELECT email FROM users WHERE id = ?) AND success = 1`,
    recentLogins: `SELECT * FROM login_attempts WHERE email = (SELECT email FROM users WHERE id = ?) ORDER BY created_at DESC LIMIT 10`,
    activeSessions: `SELECT COUNT(*) as count FROM login_sessions WHERE user_id = ? AND is_active = 1`,
    biometricData: `SELECT capture_type, quality_score, created_at FROM face_embeddings WHERE user_id = ?`
  };

  const results = {};
  let completedQueries = 0;
  const totalQueries = Object.keys(queries).length;

  Object.entries(queries).forEach(([key, query]) => {
    db.all(query, [userId], (err, rows) => {
      if (err) {
        console.error(`Error en query ${key}:`, err);
        results[key] = key === 'recentLogins' || key === 'biometricData' ? [] : { count: 0 };
      } else {
        results[key] = rows;
      }

      completedQueries++;
      if (completedQueries === totalQueries) {
        res.json({
          success: true,
          stats: {
            totalLogins: results.totalLogins[0]?.count || 0,
            activeSessions: results.activeSessions[0]?.count || 0,
            biometricEnabled: results.biometricData.length > 0,
            recentActivity: results.recentLogins,
            biometricData: results.biometricData
          }
        });
      }
    });
  });
});

// 🚪 Logout
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1];
  const userId = req.user.userId;

  if (token) {
    const tokenHash = bcrypt.hashSync(token, 5);
    db.run("UPDATE login_sessions SET is_active = 0 WHERE user_id = ? AND token_hash = ?", 
      [userId, tokenHash], (err) => {
        if (err) {
          console.error('Error invalidando sesión:', err);
        } else {
          console.log(`✅ Sesión cerrada para usuario ${userId}`);
        }
      });
  }

  res.json({ success: true, message: 'Sesión cerrada exitosamente' });
});

// 🗑️ Eliminar datos biométricos
app.delete('/api/face/clear', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  db.run("DELETE FROM face_embeddings WHERE user_id = ?", [userId], function(err) {
    if (err) {
      console.error('Error eliminando datos biométricos:', err);
      return res.status(500).json({ success: false, error: 'Error interno' });
    }

    console.log(`✅ Datos biométricos eliminados para usuario ${userId}`);
    res.json({
      success: true,
      message: 'Datos biométricos eliminados exitosamente',
      deletedRecords: this.changes
    });
  });
});

// ⚙️ Manejo de errores global
app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor'
  });
});

// 🌐 Ruta por defecto
app.get('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada'
  });
});

// 🚀 Iniciar servidor
app.listen(PORT, () => {
  console.log('\n🚀 ===== SERVIDOR FACIAL AUTH =====');
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📁 Base de datos: ${DB_PATH}`);
  console.log('====================================\n');
});

// Manejo de cierre graceful
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  db.close((err) => {
    if (err) {
      console.error('Error cerrando base de datos:', err);
    } else {
      console.log('✅ Base de datos cerrada correctamente');
    }
    process.exit(0);
  });
}); 
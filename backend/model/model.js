const { pool } = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/constats");

class FacialAuthModel {
  // Función para generar token JWT
  static generateToken(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
    };
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: process.env.SESSION_TIMEOUT || "24h",
    });
  }

  // Función para registrar intento de login
  static async logLoginAttempt(
    email,
    ipAddress,
    userAgent,
    success,
    failureReason = null
  ) {
    try {
      await pool.query(
        `
        INSERT INTO login_attempts (email, ip_address, success, failure_reason, user_agent)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [email, ipAddress, success, failureReason, userAgent]
      );
    } catch (err) {
      console.error("Error registrando intento de login:", err);
    }
  }

  // Método para verificar estado del servidor
  static async checkHealth(req, res) {
    try {
      const userResult = await pool.query(
        "SELECT COUNT(*) as user_count FROM users"
      );
      const sessionResult = await pool.query(
        "SELECT COUNT(*) as session_count FROM login_sessions WHERE is_active = true"
      );

      res.json({
        success: true,
        status: "online",
        timestamp: new Date().toISOString(),
        database: "connected",
        database_type: "PostgreSQL (Neon)",
        stats: {
          total_users: Number.parseInt(userResult.rows[0].user_count),
          active_sessions: Number.parseInt(sessionResult.rows[0].session_count),
        },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        status: "error",
        error: "Error conectando con la base de datos",
      });
    }
  }

  // Método para registrar usuario
  static async register(req, res) {
    const client = await pool.connect();

    try {
      const { firstName, lastName, email, password, phone, idNumber } =
        req.body;

      // Validaciones básicas
      if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({
          success: false,
          error: "Campos obligatorios faltantes",
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
          error: "El email o número de identificación ya están registrados",
        });
      }

      // Hash de la contraseña
      const passwordHash = await bcrypt.hash(password, 12);

      // Insertar nuevo usuario
      const result = await client.query(
        `
        INSERT INTO users (first_name, last_name, email, password_hash, phone, id_number)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, first_name, last_name, email, phone, created_at
        `,
        [firstName, lastName, email, passwordHash, phone, idNumber]
      );

      const newUser = result.rows[0];

      // Generar token JWT
      const token = this.generateToken(newUser);

      // Crear sesión activa - CAMBIO: Guardar el token completo, no el hash
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

      await client.query(
        `
        INSERT INTO login_sessions (user_id, token, ip_address, user_agent, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [newUser.id, token, req.ip, req.get("User-Agent"), expiresAt]
      );

      // Log del registro exitoso
      await this.logLoginAttempt(email, req.ip, req.get("User-Agent"), true);

      res.status(201).json({
        success: true,
        message: "Usuario registrado exitosamente",
        user: {
          id: newUser.id,
          firstName: newUser.first_name,
          lastName: newUser.last_name,
          email: newUser.email,
          phone: newUser.phone,
          createdAt: newUser.created_at,
        },
        token: token,
      });
    } catch (error) {
      console.error("Error en registro:", error);
      await this.logLoginAttempt(
        req.body.email,
        req.ip,
        req.get("User-Agent"),
        false,
        "Error interno del servidor"
      );

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    } finally {
      client.release();
    }
  }

  // Método para login con credenciales
  static async login(req, res) {
    const client = await pool.connect();

    try {
      const { email, password } = req.body;

      if (!email || !password) {
        await this.logLoginAttempt(
          email,
          req.ip,
          req.get("User-Agent"),
          false,
          "Credenciales faltantes"
        );
        return res.status(400).json({
          success: false,
          error: "Email y contraseña son requeridos",
        });
      }

      // Buscar usuario
      const userResult = await client.query(
        "SELECT id, first_name, last_name, email, password_hash, is_active FROM users WHERE email = $1",
        [email]
      );

      if (userResult.rows.length === 0) {
        await this.logLoginAttempt(
          email,
          req.ip,
          req.get("User-Agent"),
          false,
          "Usuario no encontrado"
        );
        return res.status(401).json({
          success: false,
          error: "Credenciales inválidas",
        });
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        await this.logLoginAttempt(
          email,
          req.ip,
          req.get("User-Agent"),
          false,
          "Usuario inactivo"
        );
        return res.status(401).json({
          success: false,
          error: "Cuenta desactivada",
        });
      }

      // Verificar contraseña
      const isValidPassword = await bcrypt.compare(
        password,
        user.password_hash
      );
      if (!isValidPassword) {
        await this.logLoginAttempt(
          email,
          req.ip,
          req.get("User-Agent"),
          false,
          "Contraseña incorrecta"
        );
        return res.status(401).json({
          success: false,
          error: "Credenciales inválidas",
        });
      }

      // Generar token JWT
      const token = this.generateToken(user);

      // Crear sesión activa - CAMBIO: Guardar el token completo, no el hash
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await client.query(
        `
        INSERT INTO login_sessions (user_id, token, ip_address, user_agent, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [user.id, token, req.ip, req.get("User-Agent"), expiresAt]
      );

      // Log del login exitoso
      await this.logLoginAttempt(email, req.ip, req.get("User-Agent"), true);

      res.json({
        success: true,
        message: "Login exitoso",
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
        },
        token: token,
      });
    } catch (error) {
      console.error("Error en login:", error);
      await this.logLoginAttempt(
        req.body.email,
        req.ip,
        req.get("User-Agent"),
        false,
        "Error interno del servidor"
      );

      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    } finally {
      client.release();
    }
  }

  // Método para logout
  static async logout(req, res) {
    try {
      const userId = req.user.userId;
      const authHeader = req.headers["authorization"];
      const token = authHeader && authHeader.split(" ")[1];

      // Desactivar la sesión específica del token actual
      if (token) {
        await pool.query(
          "UPDATE login_sessions SET is_active = false WHERE user_id = $1 AND token = $2",
          [userId, token]
        );
      } else {
        // Si no hay token, desactivar todas las sesiones del usuario
        await pool.query(
          "UPDATE login_sessions SET is_active = false WHERE user_id = $1 AND is_active = true",
          [userId]
        );
      }

      res.json({
        success: true,
        message: "Logout exitoso",
      });
    } catch (error) {
      console.error("Error en logout:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  // Método para obtener perfil de usuario
  static async getUserProfile(req, res) {
    try {
      const userId = req.user.userId;

      const userResult = await pool.query(
        `
        SELECT id, first_name, last_name, email, phone, id_number, created_at,
               (SELECT COUNT(*) > 0 FROM face_embeddings WHERE user_id = $1) as biometric_enabled,
               (SELECT COUNT(*) FROM login_sessions WHERE user_id = $1 AND is_active = true) as active_sessions
        FROM users WHERE id = $1 AND is_active = true
        `,
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Usuario no encontrado",
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
          activeSessions: Number.parseInt(user.active_sessions),
        },
      });
    } catch (error) {
      console.error("Error obteniendo perfil:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }

  // Método para obtener estadísticas del dashboard
  static async getDashboardStats(req, res) {
    try {
      const userId = req.user.userId;

      // Obtener estadísticas del usuario
      const [loginAttemptsResult, sessionsResult, biometricResult] =
        await Promise.all([
          pool.query(
            `
          SELECT COUNT(*) as total_logins
          FROM login_attempts 
          WHERE email = (SELECT email FROM users WHERE id = $1) AND success = true
          `,
            [userId]
          ),

          pool.query(
            `
          SELECT COUNT(*) as active_sessions
          FROM login_sessions 
          WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
          `,
            [userId]
          ),

          pool.query(
            `
          SELECT COUNT(*) > 0 as biometric_enabled,
                 COALESCE(AVG(quality_score), 0) as avg_quality
          FROM face_embeddings 
          WHERE user_id = $1
          `,
            [userId]
          ),
        ]);

      // Actividad reciente
      const recentActivityResult = await pool.query(
        `
        SELECT email, ip_address, success, failure_reason, user_agent, created_at
        FROM login_attempts 
        WHERE email = (SELECT email FROM users WHERE id = $1)
        ORDER BY created_at DESC 
        LIMIT 10
        `,
        [userId]
      );

      // Datos biométricos
      const biometricDataResult = await pool.query(
        `
        SELECT capture_type, quality_score, created_at
        FROM face_embeddings 
        WHERE user_id = $1
        ORDER BY created_at DESC
        `,
        [userId]
      );

      res.json({
        success: true,
        stats: {
          totalLogins: Number.parseInt(
            loginAttemptsResult.rows[0].total_logins
          ),
          activeSessions: Number.parseInt(
            sessionsResult.rows[0].active_sessions
          ),
          biometricEnabled: biometricResult.rows[0].biometric_enabled,
          averageQuality: Number.parseFloat(
            biometricResult.rows[0].avg_quality
          ),
          recentActivity: recentActivityResult.rows,
          biometricData: biometricDataResult.rows,
        },
      });
    } catch (error) {
      console.error("Error obteniendo estadísticas:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
}

module.exports = FacialAuthModel;

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sistema de Autenticación Biométrica Facial - API',
      version: '1.0.0',
      description: `
        API completa para sistema de reconocimiento facial con autenticación biométrica.
        
        **Características principales:**
        - 🔐 Autenticación por reconocimiento facial
        - 🛡️ JWT tokens para seguridad
        - 📊 Auditoría completa de accesos
        - 🗄️ Base de datos PostgreSQL (Neon)
        - 🚀 Optimizado para producción
        
        **Flujo de autenticación:**
        1. Registro de usuario con credenciales
        2. Enrollment de embeddings faciales
        3. Login facial con liveness detection
        4. Acceso a recursos protegidos con JWT
      `,
      contact: {
        name: 'Equipo de Desarrollo',
        email: 'support@faceauth.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:8000/api',
        description: 'Servidor de desarrollo'
      },
      {
        url: 'https://api.faceauth.com/api',
        description: 'Servidor de producción'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtenido del login'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            firstName: { type: 'string', example: 'Juan' },
            lastName: { type: 'string', example: 'Pérez' },
            email: { type: 'string', format: 'email', example: 'juan@example.com' },
            phone: { type: 'string', example: '3001234567' },
            idNumber: { type: 'string', example: '12345678' },
            createdAt: { type: 'string', format: 'date-time' },
            biometricEnabled: { type: 'boolean', example: true },
            activeSessions: { type: 'integer', example: 1 }
          }
        },
        LoginCredentials: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'juan@example.com' },
            password: { type: 'string', format: 'password', example: 'password123' }
          }
        },
        RegisterUser: {
          type: 'object',
          required: ['firstName', 'lastName', 'email', 'password'],
          properties: {
            firstName: { type: 'string', example: 'Juan' },
            lastName: { type: 'string', example: 'Pérez' },
            email: { type: 'string', format: 'email', example: 'juan@example.com' },
            password: { type: 'string', format: 'password', example: 'password123' },
            phone: { type: 'string', example: '3001234567' },
            idNumber: { type: 'string', example: '12345678' }
          }
        },
        FaceEmbedding: {
          type: 'object',
          required: ['data'],
          properties: {
            data: {
              type: 'array',
              items: { type: 'number' },
              example: [0.1, 0.2, 0.3, -0.1, 0.5],
              description: 'Array de números que representa el embedding facial (típicamente 128 o 512 dimensiones)'
            },
            type: {
              type: 'string',
              enum: ['normal', 'sonrisa', 'ojos_cerrados'],
              example: 'normal',
              description: 'Tipo de captura facial'
            },
            quality: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              example: 0.95,
              description: 'Puntuación de calidad del embedding (0-1)'
            }
          }
        },
        FaceLogin: {
          type: 'object',
          required: ['embedding'],
          properties: {
            embedding: {
              type: 'array',
              items: { type: 'number' },
              example: [0.1, 0.2, 0.3, -0.1, 0.5],
              description: 'Embedding facial para comparación'
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operación exitosa' }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Descripción del error' }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Login exitoso' },
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            user: { $ref: '#/components/schemas/User' }
          }
        },
        FaceLoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Login facial exitoso' },
            userToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            user: { $ref: '#/components/schemas/User' },
            similarity: { type: 'string', example: '0.876', description: 'Puntuación de similitud facial' }
          }
        },
        HealthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            status: { type: 'string', example: 'online' },
            timestamp: { type: 'string', format: 'date-time' },
            database: { type: 'string', example: 'connected' },
            database_type: { type: 'string', example: 'PostgreSQL (Neon)' },
            stats: {
              type: 'object',
              properties: {
                total_users: { type: 'integer', example: 5 },
                active_sessions: { type: 'integer', example: 2 }
              }
            }
          }
        },
        DashboardStats: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            stats: {
              type: 'object',
              properties: {
                totalLogins: { type: 'integer', example: 25 },
                activeSessions: { type: 'integer', example: 1 },
                biometricEnabled: { type: 'boolean', example: true },
                averageQuality: { type: 'number', example: 0.85 },
                recentActivity: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      email: { type: 'string', example: 'juan@example.com' },
                      ip_address: { type: 'string', example: '192.168.1.1' },
                      success: { type: 'boolean', example: true },
                      failure_reason: { type: 'string', nullable: true },
                      user_agent: { type: 'string', example: 'Mozilla/5.0...' },
                      created_at: { type: 'string', format: 'date-time' }
                    }
                  }
                },
                biometricData: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      capture_type: { type: 'string', example: 'normal' },
                      quality_score: { type: 'number', example: 0.95 },
                      created_at: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Estado del Sistema',
        description: 'Endpoints para verificar el estado del servidor y base de datos'
      },
      {
        name: 'Autenticación',
        description: 'Endpoints para registro, login y logout de usuarios'
      },
      {
        name: 'Biometría Facial',
        description: 'Endpoints para enrollment y autenticación facial'
      },
      {
        name: 'Usuario',
        description: 'Endpoints para gestión de perfil de usuario'
      },
      {
        name: 'Dashboard',
        description: 'Endpoints para estadísticas y datos del dashboard'
      }
    ]
  },
  apis: ['./server.js'], // Archivos donde están los comentarios de las APIs
};

const specs = swaggerJsdoc(options);

module.exports = {
  specs,
  swaggerUi
}; 
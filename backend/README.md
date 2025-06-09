# 🔐 Sistema de Autenticación Biométrica Facial - Backend

Backend completo para sistema de reconocimiento facial con PostgreSQL (Neon) como base de datos y **documentación Swagger/OpenAPI** integrada.

## 🚀 Características

- **Autenticación Biométrica**: Login facial con embeddings reales
- **Base de Datos**: PostgreSQL en la nube (Neon)
- **Seguridad**: JWT tokens, bcrypt, rate limiting, helmet
- **API RESTful**: Endpoints completos para autenticación
- **📚 Documentación Swagger**: Documentación interactiva de todas las APIs
- **Logging**: Sistema completo de auditoría
- **Escalabilidad**: Preparado para producción

## 🛠️ Tecnologías

- **Node.js** + **Express.js**
- **PostgreSQL** (Neon Cloud)
- **JWT** para autenticación
- **bcryptjs** para hash de contraseñas
- **Helmet** para seguridad
- **Morgan** para logging
- **Rate Limiting** para protección DDoS
- **📖 Swagger UI** + **OpenAPI 3.0** para documentación

## 📚 Documentación de API

### 🌐 Swagger UI Interactivo
Accede a la documentación completa e interactiva en:
```
http://localhost:8000/api/docs
```

**Características de la documentación:**
- 🔧 **Interfaz interactiva** para probar endpoints
- 📝 **Esquemas detallados** de request/response
- 🔐 **Autenticación JWT** integrada
- 📊 **Ejemplos en vivo** para cada endpoint
- 🏷️ **Organizados por categorías** (tags)
- 💾 **Persistencia de autorización** entre sesiones

### 📋 Categorías de Endpoints

1. **🔍 Estado del Sistema** - Health checks y estado del servidor
2. **👤 Autenticación** - Registro, login y logout
3. **🎭 Biometría Facial** - Enrollment y login facial
4. **📊 Usuario** - Gestión de perfil y datos biométricos
5. **📈 Dashboard** - Estadísticas y actividad del usuario

## 📋 Endpoints Disponibles

### 🔍 Estado del Sistema
- `GET /api/health` - Estado del servidor y base de datos

### 👤 Autenticación
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Login con credenciales
- `POST /api/auth/logout` - Cerrar sesión

### 🎭 Biometría Facial
- `POST /api/face/enroll` - Enrollar embeddings faciales
- `POST /api/face/login` - Login facial

### 📊 Usuario y Dashboard
- `GET /api/user/profile` - Perfil de usuario
- `GET /api/dashboard/stats` - Estadísticas del dashboard
- `DELETE /api/user/biometric` - Eliminar datos biométricos

## 🗄️ Base de Datos

### Configuración PostgreSQL (Neon)
```env
DATABASE_URL=postgresql://neondb_owner:npg_XIqx1pQcmD3u@ep-muddy-shape-a56mayxk-pooler.us-east-2.aws.neon.tech/faceRecon?sslmode=require
```

### Tablas Creadas Automáticamente
- `users` - Información de usuarios
- `face_embeddings` - Embeddings faciales
- `login_sessions` - Sesiones activas
- `login_attempts` - Auditoría de intentos
- `user_settings` - Configuraciones de usuario

## 🚀 Instalación y Uso

### 1. Instalar Dependencias
```bash
cd backend
npm install
```

### 2. Configurar Variables de Entorno
El archivo `config.env` ya está configurado con la base de datos Neon.

### 3. Iniciar Servidor
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

### 4. Verificar Estado
```bash
curl http://localhost:8000/api/health
```

### 5. 📚 Acceder a la Documentación
Abrir en el navegador: http://localhost:8000/api/docs

## 📝 Ejemplos de Uso

### 🔧 Usando Swagger UI (Recomendado)
1. Ir a http://localhost:8000/api/docs
2. Hacer clic en el endpoint que deseas probar
3. Usar el botón "Try it out"
4. Completar los parámetros requeridos
5. Ejecutar y ver la respuesta

### 📱 Usando cURL

#### Registro de Usuario
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Juan",
    "lastName": "Pérez",
    "email": "juan@example.com",
    "password": "password123",
    "phone": "3001234567",
    "idNumber": "12345678"
  }'
```

#### Login con Credenciales
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "juan@example.com",
    "password": "password123"
  }'
```

#### Enrollar Embeddings Faciales
```bash
curl -X POST http://localhost:8000/api/face/enroll \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "embeddings": [
      {
        "data": [0.1, 0.2, 0.3],
        "type": "normal",
        "quality": 0.95
      }
    ]
  }'
```

#### Login Facial
```bash
curl -X POST http://localhost:8000/api/face/login \
  -H "Content-Type: application/json" \
  -d '{
    "embedding": [0.1, 0.2, 0.3]
  }'
```

## 🔒 Seguridad

- **Rate Limiting**: 100 requests por 15 minutos
- **Helmet**: Headers de seguridad
- **CORS**: Configurado para frontend
- **JWT**: Tokens seguros con expiración
- **bcrypt**: Hash de contraseñas con salt 12
- **SSL**: Conexión segura a PostgreSQL

## 📊 Logging y Auditoría

- Todos los intentos de login se registran
- Logging completo de requests/responses
- Auditoría de acciones biométricas
- Manejo graceful de errores

## 🌐 Variables de Entorno

```env
# Servidor
PORT=8000
NODE_ENV=production

# JWT
JWT_SECRET=facial_auth_secret_key_2024_neon_postgresql

# PostgreSQL Neon
DATABASE_URL=postgresql://...
DB_HOST=ep-muddy-shape-a56mayxk-pooler.us-east-2.aws.neon.tech
DB_PORT=5432
DB_NAME=faceRecon
DB_USER=neondb_owner
DB_PASSWORD=npg_XIqx1pQcmD3u
DB_SSL=require

# Configuración
MAX_FILE_SIZE=10mb
SESSION_TIMEOUT=24h
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
```

## 🧪 Usuario de Prueba

El sistema crea automáticamente un usuario de prueba:
- **Email**: admin@faceauth.com
- **Contraseña**: admin123

## 📈 Estado del Servidor

El endpoint `/api/health` retorna:
```json
{
  "success": true,
  "status": "online",
  "timestamp": "2025-06-03T20:38:06.337Z",
  "database": "connected",
  "database_type": "PostgreSQL (Neon)",
  "stats": {
    "total_users": 1,
    "active_sessions": 0
  }
}
```

## 📚 Esquemas de Datos

### Usuario
```json
{
  "id": 1,
  "firstName": "Juan",
  "lastName": "Pérez", 
  "email": "juan@example.com",
  "phone": "3001234567",
  "idNumber": "12345678",
  "createdAt": "2025-06-03T20:38:06.337Z",
  "biometricEnabled": true,
  "activeSessions": 1
}
```

### Embedding Facial
```json
{
  "data": [0.1, 0.2, 0.3, -0.1, 0.5],
  "type": "normal",
  "quality": 0.95
}
```

### Respuesta de Login Facial
```json
{
  "success": true,
  "message": "Login facial exitoso",
  "userToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "firstName": "Juan",
    "lastName": "Pérez",
    "email": "juan@example.com"
  },
  "similarity": "0.876"
}
```

## 🔧 Desarrollo

### Scripts Disponibles
- `npm start` - Iniciar servidor
- `npm run dev` - Desarrollo con nodemon
- `npm test` - Ejecutar tests
- `npm run migrate` - Migraciones de BD
- `npm run seed` - Datos de prueba
- `npm run backup` - Backup de BD

### Estructura del Proyecto
```
backend/
├── server.js          # Servidor principal con documentación Swagger
├── swagger.js         # Configuración de Swagger/OpenAPI
├── package.json       # Dependencias incluyendo Swagger
├── config.env         # Variables de entorno
├── README.md          # Esta documentación
└── scripts/           # Scripts de utilidad
```

### 🧪 Probando la API

1. **Swagger UI**: http://localhost:8000/api/docs (Recomendado)
2. **Health Check**: http://localhost:8000/api/health
3. **Postman**: Importar esquemas desde Swagger
4. **cURL**: Ejemplos en este README

## 🚨 Troubleshooting

### Error de Conexión a PostgreSQL
1. Verificar que la URL de conexión sea correcta
2. Comprobar conectividad a internet
3. Verificar que Neon esté activo

### Error de JWT
1. Verificar que el JWT_SECRET esté configurado
2. Comprobar que el token no haya expirado

### Error de Rate Limiting
1. Esperar 15 minutos para reset
2. Ajustar límites en variables de entorno

### Swagger UI no carga
1. Verificar que las dependencias estén instaladas
2. Comprobar que el archivo swagger.js existe
3. Verificar que no hay errores en la consola

## 📖 Información Adicional

### URLs Importantes
- **API Base**: http://localhost:8000/api
- **📚 Documentación Swagger**: http://localhost:8000/api/docs
- **Health Check**: http://localhost:8000/api/health

### Autenticación en Swagger
1. Hacer login en `/api/auth/login`
2. Copiar el token de la respuesta
3. En Swagger UI, click en "Authorize"
4. Pegar el token con formato: `Bearer YOUR_TOKEN`
5. Ahora puedes probar endpoints protegidos

## 📞 Soporte

Para soporte técnico o reportar bugs:
- Revisar la documentación Swagger
- Verificar logs del servidor
- Contactar al equipo de desarrollo

---

**Desarrollado con ❤️ para autenticación biométrica segura**  
**📚 Documentado con Swagger/OpenAPI para máxima usabilidad** 
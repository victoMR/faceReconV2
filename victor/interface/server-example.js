const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 8000;

// Base de datos en memoria para testing
const registeredUsers = new Map();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  
  if (req.body) {
    const logBody = { ...req.body };
    // Truncar embeddings para logging
    if (logBody.faceEmbeddings) {
      logBody.faceEmbeddings = `[${logBody.faceEmbeddings.length} embeddings de ${logBody.faceEmbeddings[0]?.length || 0} elementos]`;
    }
    if (logBody.faceEmbedding) {
      logBody.faceEmbedding = `[Embedding de ${logBody.faceEmbedding.length} elementos]`;
    }
    console.log('[SERVER] Request body:', logBody);
  }
  
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('[SERVER] Health check solicitado');
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    registeredUsers: registeredUsers.size
  });
});

// Server info endpoint
app.get('/api/info', (req, res) => {
  console.log('[SERVER] Info del servidor solicitada');
  res.json({
    name: 'Facial Recognition Server',
    version: '1.0.0',
    capabilities: ['face_enrollment', 'face_login'],
    embeddingDimension: 128,
    maxUsers: 1000,
    currentUsers: registeredUsers.size
  });
});

// Face enrollment endpoint
app.post('/api/face/enroll', (req, res) => {
  try {
    const { userId, faceEmbeddings, timestamp, metadata } = req.body;
    
    console.log(`[SERVER] Enrollment request for userId: ${userId}`);
    console.log(`[SERVER] Received ${faceEmbeddings?.length || 0} embeddings`);
    console.log('[SERVER] Metadata:', metadata);
    
    // Validaciones
    if (!userId) {
      console.log('[SERVER] Error: userId es requerido');
      return res.status(400).json({
        success: false,
        error: 'userId es requerido'
      });
    }
    
    if (!faceEmbeddings || !Array.isArray(faceEmbeddings) || faceEmbeddings.length === 0) {
      console.log('[SERVER] Error: faceEmbeddings inválidos');
      return res.status(400).json({
        success: false,
        error: 'faceEmbeddings debe ser un array no vacío'
      });
    }
    
    // Verificar que todos los embeddings tengan 128 elementos
    const invalidEmbedding = faceEmbeddings.find(embedding => 
      !Array.isArray(embedding) || embedding.length !== 128
    );
    
    if (invalidEmbedding) {
      console.log('[SERVER] Error: Embedding con dimensión incorrecta');
      return res.status(400).json({
        success: false,
        error: 'Todos los embeddings deben tener exactamente 128 elementos'
      });
    }
    
    // Verificar si el usuario ya existe
    if (registeredUsers.has(userId)) {
      console.log(`[SERVER] Warning: Usuario ${userId} ya está registrado, sobrescribiendo...`);
    }
    
    // Guardar usuario en "base de datos"
    registeredUsers.set(userId, {
      userId,
      faceEmbeddings,
      registeredAt: new Date().toISOString(),
      metadata
    });
    
    console.log(`[SERVER] Usuario ${userId} registrado exitosamente`);
    console.log(`[SERVER] Total usuarios registrados: ${registeredUsers.size}`);
    
    res.json({
      success: true,
      message: 'Usuario registrado exitosamente',
      userId: userId,
      embeddingCount: faceEmbeddings.length
    });
    
  } catch (error) {
    console.error('[SERVER] Error en enrollment:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Face login endpoint
app.post('/api/face/login', (req, res) => {
  try {
    const { faceEmbedding, timestamp, metadata } = req.body;
    
    console.log('[SERVER] Login request recibido');
    console.log(`[SERVER] Embedding dimension: ${faceEmbedding?.length || 0}`);
    console.log('[SERVER] Metadata:', metadata);
    
    // Validaciones
    if (!faceEmbedding || !Array.isArray(faceEmbedding) || faceEmbedding.length !== 128) {
      console.log('[SERVER] Error: faceEmbedding inválido');
      return res.status(400).json({
        success: false,
        error: 'faceEmbedding debe ser un array de 128 elementos'
      });
    }
    
    // Simular reconocimiento facial
    // En un sistema real, aquí se compararían los embeddings usando distancia coseno o euclidiana
    console.log(`[SERVER] Comparando con ${registeredUsers.size} usuarios registrados...`);
    
    // Para testing, aceptar cualquier embedding si hay usuarios registrados
    if (registeredUsers.size === 0) {
      console.log('[SERVER] No hay usuarios registrados');
      return res.status(401).json({
        success: false,
        error: 'No hay usuarios registrados en el sistema'
      });
    }
    
    // Simular una coincidencia con el primer usuario (para testing)
    const firstUser = Array.from(registeredUsers.values())[0];
    const similarity = simulateSimilarity();
    
    console.log(`[SERVER] Simulando comparación con usuario ${firstUser.userId}`);
    console.log(`[SERVER] Similitud simulada: ${similarity.toFixed(3)}`);
    
    if (similarity > 0.8) { // Umbral de similitud
      const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`[SERVER] Login exitoso para usuario ${firstUser.userId}`);
      res.json({
        success: true,
        userId: firstUser.userId,
        userToken: token,
        message: 'Autenticación facial exitosa',
        similarity: similarity
      });
    } else {
      console.log('[SERVER] Rostro no reconocido - similitud demasiado baja');
      res.status(401).json({
        success: false,
        error: 'Rostro no reconocido - similitud insuficiente'
      });
    }
    
  } catch (error) {
    console.error('[SERVER] Error en login:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Función para simular similitud (en un sistema real usaría distancia coseno)
function simulateSimilarity() {
  // Simula una similitud alta para testing (80-95%)
  return 0.8 + (Math.random() * 0.15);
}

// Error handler global
app.use((error, req, res, next) => {
  console.error('[SERVER] Error no manejado:', error);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor'
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`[SERVER] Endpoint no encontrado: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`[SERVER] Servidor de reconocimiento facial iniciado en puerto ${PORT}`);
  console.log(`[SERVER] Endpoints disponibles:`);
  console.log(`[SERVER]   GET  http://localhost:${PORT}/api/health`);
  console.log(`[SERVER]   GET  http://localhost:${PORT}/api/info`);
  console.log(`[SERVER]   POST http://localhost:${PORT}/api/face/enroll`);
  console.log(`[SERVER]   POST http://localhost:${PORT}/api/face/login`);
  console.log(`[SERVER] Listo para recibir requests...`);
});

// Manejo de cierre del servidor
process.on('SIGINT', () => {
  console.log('\n[SERVER] Cerrando servidor...');
  process.exit(0);
}); 
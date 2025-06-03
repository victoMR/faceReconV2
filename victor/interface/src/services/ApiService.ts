import axios from 'axios';

// Configuración base de la API
const API_BASE_URL = 'http://localhost:8000/api'; // Ajustar según tu backend

// Configurar axios con interceptors para logging
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 segundos timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de request para logging
api.interceptors.request.use(
  (config) => {
    console.log(`[ApiService] ${config.method?.toUpperCase()} ${config.url}`);
    if (config.data) {
      console.log('[ApiService] Request data:', {
        ...config.data,
        // Truncar embeddings para logging
        faceEmbeddings: config.data.faceEmbeddings ? 
          `[${config.data.faceEmbeddings.length} embeddings]` : 
          undefined
      });
    }
    return config;
  },
  (error) => {
    console.error('[ApiService] Request error:', error);
    return Promise.reject(error);
  }
);

// Interceptor de response para logging
api.interceptors.response.use(
  (response) => {
    console.log(`[ApiService] Response ${response.status}:`, {
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('[ApiService] Response error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    return Promise.reject(error);
  }
);

// Interfaces
interface EnrollmentResponse {
  success: boolean;
  message?: string;
  userId?: string;
  error?: string;
}

interface LoginResponse {
  success: boolean;
  userToken?: string;
  message?: string;
  error?: string;
}

interface RegisterResponse {
  success: boolean;
  userId?: number;
  message?: string;
  error?: string;
}

interface UserProfileResponse {
  success: boolean;
  user?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    idNumber: string;
    createdAt: string;
    biometricEnabled: boolean;
    activeSessions: number;
  };
  error?: string;
}

interface DashboardStatsResponse {
  success: boolean;
  stats?: {
    totalLogins: number;
    activeSessions: number;
    biometricEnabled: boolean;
    recentActivity: Array<{
      id: number;
      email: string;
      ip_address: string;
      success: boolean;
      failure_reason: string | null;
      user_agent: string;
      created_at: string;
    }>;
    biometricData: Array<{
      capture_type: string;
      quality_score: number;
      created_at: string;
    }>;
  };
  error?: string;
}

interface BasicResponse {
  success: boolean;
  message?: string;
  error?: string;
}

class ApiService {
  /**
   * Registra un nuevo usuario
   */
  static async registerUser(userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone: string;
    idNumber: string;
  }): Promise<RegisterResponse> {
    try {
      console.log('[ApiService] Registrando nuevo usuario:', userData.email);
      
      const response = await api.post('/auth/register', userData);
      
      if (response.data.success) {
        console.log('[ApiService] Usuario registrado exitosamente:', response.data.userId);
        return {
          success: true,
          userId: response.data.userId,
          message: response.data.message || 'Usuario registrado exitosamente'
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Error durante el registro'
        };
      }
    } catch (error) {
      console.error('[ApiService] Error en registerUser:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 409) {
          return {
            success: false,
            error: 'El usuario ya existe con ese correo o cédula'
          };
        }
        return {
          success: false,
          error: error.response?.data?.error || 'Error durante el registro'
        };
      }
      
      return {
        success: false,
        error: 'Error de conexión. Verifique su internet.'
      };
    }
  }

  /**
   * Login con credenciales
   */
  static async loginCredentials(email: string, password: string): Promise<LoginResponse> {
    try {
      console.log('[ApiService] Login con credenciales para:', email);
      
      const response = await api.post('/auth/login', { email, password });
      
      if (response.data.success) {
        console.log('[ApiService] Login exitoso para:', email);
        return {
          success: true,
          userToken: response.data.token,
          message: 'Login exitoso'
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Credenciales inválidas'
        };
      }
    } catch (error) {
      console.error('[ApiService] Error en loginCredentials:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return {
            success: false,
            error: 'Credenciales inválidas'
          };
        }
        return {
          success: false,
          error: error.response?.data?.error || 'Error durante el login'
        };
      }
      
      return {
        success: false,
        error: 'Error de conexión. Verifique su internet.'
      };
    }
  }

  /**
   * Registra un rostro en el sistema (requiere autenticación)
   */
  static async enrollFace(token: string, embeddings: Array<{data: number[], type: string, quality: number}>): Promise<EnrollmentResponse> {
    try {
      console.log(`[ApiService] Iniciando enrollment con ${embeddings.length} embeddings`);
      
      // Validar datos de entrada
      if (!token || !embeddings || embeddings.length !== 4) {
        throw new Error('Token y 4 embeddings faciales son requeridos');
      }

      // Verificar que los embeddings tengan el formato correcto
      const validEmbeddings = embeddings.every(embedding => 
        embedding.data && Array.isArray(embedding.data) && embedding.data.length === 128 &&
        embedding.type && typeof embedding.type === 'string' &&
        embedding.quality && typeof embedding.quality === 'number'
      );

      if (!validEmbeddings) {
        throw new Error('Los embeddings deben tener formato {data: number[128], type: string, quality: number}');
      }

      const requestData = {
        embeddings  // Enviar directamente los embeddings estructurados
      };

      console.log('[ApiService] Enviando datos de enrollment al servidor...');
      console.log(`[ApiService] Embeddings estructurados: ${embeddings.map(e => `${e.type}(${e.data.length})`).join(', ')}`);
      
      const response = await api.post('/face/enroll', requestData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        console.log('[ApiService] Enrollment exitoso:', response.data.message);
        return {
          success: true,
          message: response.data.message || 'Registro biométrico completado exitosamente'
        };
      } else {
        console.warn('[ApiService] Enrollment falló:', response.data.error);
        return {
          success: false,
          error: response.data.error || 'Error durante el registro facial'
        };
      }

    } catch (error) {
      console.error('[ApiService] Error en enrollFace:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
          return {
            success: false,
            error: 'No se pudo conectar al servidor. Verifique que el backend esté ejecutándose.'
          };
        }
        
        if (error.response?.status === 401 || error.response?.status === 403) {
          return {
            success: false,
            error: 'Token de autenticación inválido o expirado'
          };
        }
        
        return {
          success: false,
          error: error.response?.data?.error || `Error HTTP ${error.response?.status || 'desconocido'}`
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido durante el registro'
      };
    }
  }

  /**
   * Autentica un usuario usando reconocimiento facial
   */
  static async loginFace(faceEmbedding: number[]): Promise<LoginResponse> {
    try {
      console.log(`[ApiService] Iniciando login facial con embedding de ${faceEmbedding.length} elementos`);
      
      // Validar datos de entrada
      if (!faceEmbedding || !Array.isArray(faceEmbedding) || faceEmbedding.length !== 128) {
        throw new Error('El embedding facial debe ser un array de 128 elementos');
      }

      const requestData = {
        embedding: faceEmbedding,        // Cambiar 'faceEmbedding' a 'embedding' para que coincida con el backend
        timestamp: new Date().toISOString(),
        metadata: {
          source: 'web_app',
          embeddingDimension: faceEmbedding.length
        }
      };

      console.log('[ApiService] Enviando embedding para verificación...');
      const response = await api.post('/face/login', requestData);

      if (response.data.success) {
        console.log('[ApiService] Login facial exitoso');
        return {
          success: true,
          userToken: response.data.userToken,
          message: response.data.message || 'Autenticación facial exitosa'
        };
      } else {
        console.warn('[ApiService] Login facial falló:', response.data.error);
        return {
          success: false,
          error: response.data.error || 'Rostro no reconocido'
        };
      }

    } catch (error) {
      console.error('[ApiService] Error en loginFace:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
          return {
            success: false,
            error: 'No se pudo conectar al servidor. Verifique que el backend esté ejecutándose.'
          };
        }
        
        if (error.response?.status === 401) {
          return {
            success: false,
            error: 'Rostro no reconocido. Intente nuevamente o registre su rostro primero.'
          };
        }
        
        return {
          success: false,
          error: error.response?.data?.error || `Error HTTP ${error.response?.status || 'desconocido'}`
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido durante la autenticación'
      };
    }
  }

  /**
   * Obtiene el perfil del usuario autenticado
   */
  static async getUserProfile(token: string): Promise<UserProfileResponse> {
    try {
      console.log('[ApiService] Obteniendo perfil de usuario');
      
      const response = await api.get('/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        console.log('[ApiService] Perfil obtenido exitosamente');
        return {
          success: true,
          user: response.data.user
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Error obteniendo perfil'
        };
      }
    } catch (error) {
      console.error('[ApiService] Error en getUserProfile:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          return {
            success: false,
            error: 'Sesión expirada. Inicie sesión nuevamente.'
          };
        }
        return {
          success: false,
          error: error.response?.data?.error || 'Error obteniendo perfil'
        };
      }
      
      return {
        success: false,
        error: 'Error de conexión'
      };
    }
  }

  /**
   * Obtiene estadísticas del dashboard
   */
  static async getDashboardStats(token: string): Promise<DashboardStatsResponse> {
    try {
      console.log('[ApiService] Obteniendo estadísticas del dashboard');
      
      const response = await api.get('/dashboard/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        console.log('[ApiService] Estadísticas obtenidas exitosamente');
        return {
          success: true,
          stats: response.data.stats
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Error obteniendo estadísticas'
        };
      }
    } catch (error) {
      console.error('[ApiService] Error en getDashboardStats:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          return {
            success: false,
            error: 'Sesión expirada. Inicie sesión nuevamente.'
          };
        }
        return {
          success: false,
          error: error.response?.data?.error || 'Error obteniendo estadísticas'
        };
      }
      
      return {
        success: false,
        error: 'Error de conexión'
      };
    }
  }

  /**
   * Cierra la sesión del usuario
   */
  static async logout(token: string): Promise<BasicResponse> {
    try {
      console.log('[ApiService] Cerrando sesión');
      
      const response = await api.post('/auth/logout', {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        console.log('[ApiService] Sesión cerrada exitosamente');
        return {
          success: true,
          message: response.data.message || 'Sesión cerrada exitosamente'
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Error cerrando sesión'
        };
      }
    } catch (error) {
      console.error('[ApiService] Error en logout:', error);
      
      // Incluso si hay error, consideramos el logout como exitoso localmente
      return {
        success: true,
        message: 'Sesión cerrada localmente'
      };
    }
  }

  /**
   * Elimina todos los datos biométricos del usuario
   */
  static async clearBiometricData(token: string): Promise<BasicResponse> {
    try {
      console.log('[ApiService] Eliminando datos biométricos');
      
      const response = await api.delete('/face/clear', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        console.log('[ApiService] Datos biométricos eliminados exitosamente');
        return {
          success: true,
          message: response.data.message || 'Datos biométricos eliminados exitosamente'
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Error eliminando datos biométricos'
        };
      }
    } catch (error) {
      console.error('[ApiService] Error en clearBiometricData:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          return {
            success: false,
            error: 'Sesión expirada. Inicie sesión nuevamente.'
          };
        }
        return {
          success: false,
          error: error.response?.data?.error || 'Error eliminando datos biométricos'
        };
      }
      
      return {
        success: false,
        error: 'Error de conexión'
      };
    }
  }

  /**
   * Verifica el estado del servidor
   */
  static async healthCheck(): Promise<{success: boolean, status?: string, error?: string}> {
    try {
      console.log('[ApiService] Verificando estado del servidor...');
      
      const response = await api.get('/health', {
        timeout: 5000 // 5 segundos para health check
      });

      if (response.data.success) {
        console.log('[ApiService] Servidor en línea:', response.data.status);
        return {
          success: true,
          status: response.data.status || 'online'
        };
      } else {
        return {
          success: false,
          error: 'Servidor reporta estado no saludable'
        };
      }
    } catch (error) {
      console.error('[ApiService] Error en healthCheck:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
          return {
            success: false,
            error: 'Servidor no disponible. Verifique que el backend esté ejecutándose en http://localhost:8000'
          };
        }
        
        if (error.code === 'ECONNABORTED') {
          return {
            success: false,
            error: 'Timeout conectando al servidor'
          };
        }
      }
      
      return {
        success: false,
        error: 'Error verificando estado del servidor'
      };
    }
  }

  /**
   * Obtiene información del servidor
   */
  static async getServerInfo(): Promise<{success: boolean, info?: any, error?: string}> {
    try {
      console.log('[ApiService] Obteniendo información del servidor...');
      
      const response = await api.get('/health');
      
      if (response.data.success) {
        return {
          success: true,
          info: {
            status: response.data.status,
            timestamp: response.data.timestamp,
            database: response.data.database,
            stats: response.data.stats
          }
        };
      } else {
        return {
          success: false,
          error: 'No se pudo obtener información del servidor'
        };
      }
    } catch (error) {
      console.error('[ApiService] Error obteniendo info del servidor:', error);
      return {
        success: false,
        error: 'Error conectando con el servidor'
      };
    }
  }
}

export default ApiService;

import axios from "axios";

// Configuración base de la API
const API_BASE_URL = "http://localhost:8000/api"; // Ajustar según tu backend

// Configurar axios con interceptors para logging
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 segundos timeout
  headers: {
    "Content-Type": "application/json",
  },
});

//Loging interceptor for requests
api.interceptors.request.use(
  (config) => {
    console.log(`[ApiService] ${config.method?.toUpperCase()} ${config.url}`);
    if (config.data) {
      console.log("[ApiService] Request data:", {
        ...config.data,
        faceEmbeddings: config.data.faceEmbeddings
          ? `[${config.data.faceEmbeddings.length} embeddings]`
          : undefined,
      });
    }
    return config;
  },
  (error) => {
    console.error("[ApiService] Request error:", error);
    return Promise.reject(error);
  }
);

//Interceptor for response logging and error handling for expired sessions
api.interceptors.response.use(
  (response) => {
    console.log(`[ApiService] Response ${response.status}:`, {
      status: response.status,
      data: response.data,
    });
    return response;
  },
  (error) => {
    console.error("[ApiService] Response error:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    });

    //Verification for automatic logout
    if (error.response?.data?.shouldLogout) {
      console.log("[ApiService] Servidor indica logout automático");
      //Clean local storage
      localStorage.removeItem("userToken");
      //Send custom event to notify logout
      window.dispatchEvent(
        new CustomEvent("forceLogout", {
          detail: { reason: error.response.data.error },
        })
      );
    }

    return Promise.reject(error);
  }
);

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
      console.log("[ApiService] Registrando nuevo usuario:", userData.email);

      const response = await api.post("/auth/register", userData);

      if (response.data.success) {
        console.log(
          "[ApiService] Usuario registrado exitosamente:",
          response.data.userId
        );
        return {
          success: true,
          userId: response.data.userId,
          message: response.data.message || "Usuario registrado exitosamente",
        };
      } else {
        return {
          success: false,
          error: response.data.error || "Error durante el registro",
        };
      }
    } catch (error) {
      console.error("[ApiService] Error en registerUser:", error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 409) {
          return {
            success: false,
            error: "El usuario ya existe con ese correo o cédula",
          };
        }
        return {
          success: false,
          error: error.response?.data?.error || "Error durante el registro",
        };
      }

      return {
        success: false,
        error: "Error de conexión. Verifique su internet.",
      };
    }
  }

  /**
   * Login con credenciales
   */
  static async loginCredentials(
    email: string,
    password: string
  ): Promise<LoginResponse> {
    try {
      console.log("[ApiService] Login con credenciales para:", email);

      const response = await api.post("/auth/login", { email, password });

      if (response.data.success) {
        console.log("[ApiService] Login exitoso para:", email);
        return {
          success: true,
          userToken: response.data.token,
          message: "Login exitoso",
        };
      } else {
        return {
          success: false,
          error: response.data.error || "Credenciales inválidas",
        };
      }
    } catch (error) {
      console.error("[ApiService] Error en loginCredentials:", error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return {
            success: false,
            error: "Credenciales inválidas",
          };
        }
        return {
          success: false,
          error: error.response?.data?.error || "Error durante el login",
        };
      }

      return {
        success: false,
        error: "Error de conexión. Verifique su internet.",
      };
    }
  }

  /**
   * Obtiene el perfil del usuario autenticado
   */
  static async getUserProfile(token: string): Promise<UserProfileResponse> {
    try {
      console.log("[ApiService] Obteniendo perfil de usuario");

      const response = await api.get("/user/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        console.log("[ApiService] Perfil obtenido exitosamente");
        return {
          success: true,
          user: response.data.user,
        };
      } else {
        return {
          success: false,
          error: response.data.error || "Error obteniendo perfil",
        };
      }
    } catch (error) {
      console.error("[ApiService] Error en getUserProfile:", error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          return {
            success: false,
            error: "Sesión expirada. Inicie sesión nuevamente.",
          };
        }
        return {
          success: false,
          error: error.response?.data?.error || "Error obteniendo perfil",
        };
      }

      return {
        success: false,
        error: "Error de conexión",
      };
    }
  }

  /**
   * Obtiene estadísticas del dashboard
   */
  static async getDashboardStats(
    token: string
  ): Promise<DashboardStatsResponse> {
    try {
      console.log("[ApiService] Obteniendo estadísticas del dashboard");

      const response = await api.get("/dashboard/stats", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        console.log("[ApiService] Estadísticas obtenidas exitosamente");
        return {
          success: true,
          stats: response.data.stats,
        };
      } else {
        return {
          success: false,
          error: response.data.error || "Error obteniendo estadísticas",
        };
      }
    } catch (error) {
      console.error("[ApiService] Error en getDashboardStats:", error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          return {
            success: false,
            error: "Sesión expirada. Inicie sesión nuevamente.",
          };
        }
        return {
          success: false,
          error: error.response?.data?.error || "Error obteniendo estadísticas",
        };
      }

      return {
        success: false,
        error: "Error de conexión",
      };
    }
  }

  /**
   * Cierra la sesión del usuario
   */
  static async logout(token: string): Promise<BasicResponse> {
    try {
      console.log("[ApiService] Cerrando sesión");

      const response = await api.post(
        "/auth/logout",
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        console.log("[ApiService] Sesión cerrada exitosamente");
        return {
          success: true,
          message: response.data.message || "Sesión cerrada exitosamente",
        };
      } else {
        return {
          success: false,
          error: response.data.error || "Error cerrando sesión",
        };
      }
    } catch (error) {
      console.error("[ApiService] Error en logout:", error);

      // Incluso si hay error, consideramos el logout como exitoso localmente
      return {
        success: true,
        message: "Sesión cerrada localmente",
      };
    }
  }

  /**
   * Verifica el estado del servidor
   */
  static async healthCheck(): Promise<{
    success: boolean;
    status?: string;
    error?: string;
  }> {
    try {
      console.log("[ApiService] Verificando estado del servidor...");

      const response = await api.get("/health", {
        timeout: 5000, // 5 segundos para health check
      });

      if (response.data.success) {
        console.log("[ApiService] Servidor en línea:", response.data.status);
        return {
          success: true,
          status: response.data.status || "online",
        };
      } else {
        return {
          success: false,
          error: "Servidor reporta estado no saludable",
        };
      }
    } catch (error) {
      console.error("[ApiService] Error en healthCheck:", error);

      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
          return {
            success: false,
            error:
              "Servidor no disponible. Verifique que el backend esté ejecutándose en http://localhost:8000",
          };
        }

        if (error.code === "ECONNABORTED") {
          return {
            success: false,
            error: "Timeout conectando al servidor",
          };
        }
      }

      return {
        success: false,
        error: "Error verificando estado del servidor",
      };
    }
  }

  /**
   * Obtiene información del servidor
   */
  static async getServerInfo(): Promise<{
    success: boolean;
    info?: any;
    error?: string;
  }> {
    try {
      console.log("[ApiService] Obteniendo información del servidor...");

      const response = await api.get("/health");

      if (response.data.success) {
        return {
          success: true,
          info: {
            status: response.data.status,
            timestamp: response.data.timestamp,
            database: response.data.database,
            stats: response.data.stats,
          },
        };
      } else {
        return {
          success: false,
          error: "No se pudo obtener información del servidor",
        };
      }
    } catch (error) {
      console.error("[ApiService] Error obteniendo info del servidor:", error);
      return {
        success: false,
        error: "Error conectando con el servidor",
      };
    }
  }
}

export default ApiService;

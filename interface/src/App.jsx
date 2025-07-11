"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import Header from "./components/Header";
import HomePage from "./components/home/Home";
import LoginPage from "./components/login/Login";
import PasswordLogin from "./components/login/PasswordLogin";
import RegistrationForm from "./components/register/Register";
import Dashboard from "./components/Dashboard";
import SystemStatusAlert from "./components/SystemStatusAlert";
import NotificationSystem from "./components/notifications/NotificationSystem";
import ApiService from "./services/ApiService";

export default function App() {
  // Estados principales
  const [mode, setMode] = useState("home");
  const [userToken, setUserToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Estados del sistema
  const [systemStatus, setSystemStatus] = useState({
    backend: "checking",
    database: "checking",
    lastCheck: null,
    totalUsers: 0,
    activeSessions: 0,
  });
  const [showSystemAlert, setShowSystemAlert] = useState(true);
  const [isCheckingSystem, setIsCheckingSystem] = useState(false);

  // Estados de notificaciones
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Estados de formularios
  const [registrationData, setRegistrationData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    idNumber: "",
  });

  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  // Restaurar sesión desde localStorage al cargar la app
  useEffect(() => {
    const storedToken = localStorage.getItem("userToken");
    if (storedToken) {
      setUserToken(storedToken);
      setIsAuthenticated(true);
      setMode("dashboard");
    }
  }, []);

  // Escuchar eventos de logout forzado desde el ApiService
  useEffect(() => {
    const handleForceLogout = (event) => {
      console.log("[App] Logout forzado:", event.detail.reason);
      handleLogout();
      setErrorMessage(`Sesión cerrada: ${event.detail.reason}`);
    };

    window.addEventListener("forceLogout", handleForceLogout);

    return () => {
      window.removeEventListener("forceLogout", handleForceLogout);
    };
  }, []);

  // Verificar estado del sistema
  useEffect(() => {
    checkSystemStatus();
    const interval = setInterval(
      () => checkSystemStatus(),
      isAuthenticated ? 60000 : 30000
    );
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Limpiar mensajes
  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage("");
        setErrorMessage("");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);

  const checkSystemStatus = async () => {
    try {
      setIsCheckingSystem(true);
      const healthResponse = await ApiService.healthCheck();

      if (healthResponse.success) {
        const infoResponse = await ApiService.getServerInfo();

        if (infoResponse.success && infoResponse.info) {
          setSystemStatus({
            backend: "online",
            database:
              infoResponse.info.database === "connected"
                ? "connected"
                : "disconnected",
            lastCheck: new Date(),
            totalUsers: infoResponse.info.stats?.total_users || 0,
            activeSessions: infoResponse.info.stats?.active_sessions || 0,
          });
        } else {
          setSystemStatus({
            backend: "online",
            database: "checking",
            lastCheck: new Date(),
            totalUsers: 0,
            activeSessions: 0,
          });
        }
      } else {
        throw new Error(healthResponse.error || "Backend no responde");
      }
    } catch (error) {
      console.error("Error verificando sistema:", error);
      setSystemStatus({
        backend: "offline",
        database: "disconnected",
        lastCheck: new Date(),
        totalUsers: 0,
        activeSessions: 0,
      });
    } finally {
      setIsCheckingSystem(false);
    }
  };

  // Guardar token en localStorage al hacer login
  const handleLoginComplete = (success, token) => {
    if (success && token) {
      setUserToken(token);
      setIsAuthenticated(true);
      setMode("dashboard");
      localStorage.setItem("userToken", token);
      setSuccessMessage("Autenticación exitosa. Bienvenido al sistema.");
    } else {
      setErrorMessage("Error durante la autenticación");
    }
  };

  // Guardar token en localStorage al login tradicional
  const handlePasswordLogin = async () => {
    try {
      if (!loginData.email || !loginData.password) {
        setErrorMessage("Email y contraseña son requeridos");
        return;
      }
      const response = await ApiService.loginCredentials(
        loginData.email,
        loginData.password
      );
      if (response.success) {
        setUserToken(response.userToken);
        setIsAuthenticated(true);
        setMode("dashboard");
        localStorage.setItem("userToken", response.userToken);
        setSuccessMessage("Login exitoso. Bienvenido al sistema.");
        setLoginData({ email: "", password: "" });
      } else {
        setErrorMessage(response.error || "Credenciales inválidas");
      }
    } catch (error) {
      console.error("Error en login:", error);
      setErrorMessage("Error de conexión. Verifique su internet.");
    }
  };

  // Limpiar sesión de localStorage al hacer logout
  const handleLogout = async () => {
    try {
      // Intentar cerrar sesión en el servidor si hay token
      if (userToken) {
        await ApiService.logout(userToken);
      }
    } catch (error) {
      console.error("Error cerrando sesión en servidor:", error);
    } finally {
      // Limpiar estado local independientemente del resultado del servidor
      setUserToken(null);
      setIsAuthenticated(false);
      setCurrentUser(null);
      setMode("home");
      setSuccessMessage("Sesión cerrada exitosamente");
      localStorage.removeItem("userToken");
    }
  };

  const handleRegistrationSubmit = async () => {
    try {
      const response = await ApiService.registerUser(registrationData);

      if (response.success) {
        setSuccessMessage("Usuario registrado exitosamente!");

        // El registro ya devuelve un token, no necesitamos hacer login adicional
        if (response.userToken && response.user) {
          setUserToken(response.userToken);
          setCurrentUser(response.user);
          setIsAuthenticated(true);
          setMode("dashboard");
          return true;
        } else {
          setErrorMessage("Usuario registrado pero no se recibió token de acceso");
          return false;
        }
      } else {
        setErrorMessage(response.error || "Error durante el registro");
        return false;
      }
    } catch (error) {
      console.error("Error registrando usuario:", error);
      setErrorMessage("Error de conexión. Verifique su internet.");
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sistema de notificaciones */}
      <NotificationSystem
        successMessage={successMessage}
        errorMessage={errorMessage}
        onClearSuccess={() => setSuccessMessage("")}
        onClearError={() => setErrorMessage("")}
      />

      {/* Alerta del estado del sistema */}
      <SystemStatusAlert
        systemStatus={systemStatus}
        showSystemAlert={showSystemAlert}
        isCheckingSystem={isCheckingSystem}
        onToggleAlert={setShowSystemAlert}
        onCheckSystem={checkSystemStatus}
      />

      {/* Header solo si no está en dashboard autenticado */}
      {!(mode === "dashboard" && isAuthenticated) && (
        <Header
          mode={mode}
          isAuthenticated={isAuthenticated}
          onModeChange={setMode}
        />
      )}

      {/* Contenido principal */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {mode === "home" && <HomePage key="home" onModeChange={setMode} />}

          {mode === "login" && <LoginPage key="login" onModeChange={setMode} />}

          {mode === "login-password" && (
            <PasswordLogin
              key="login-password"
              loginData={loginData}
              onInputChange={setLoginData}
              onSubmit={handlePasswordLogin}
            />
          )}

          {mode === "register-form" && (
            <RegistrationForm
              key="register-form"
              registrationData={registrationData}
              onInputChange={setRegistrationData}
              onSubmit={handleRegistrationSubmit}
            />
          )}

          {mode === "dashboard" && isAuthenticated && (
            <Dashboard
              key="dashboard"
              onLogout={handleLogout}
              userToken={userToken}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

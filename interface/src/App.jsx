"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import Header from "./components/Header";
import HomePage from "./components/home/home";
import LoginPage from "./components/login/login";
import FacialLogin from "./components/login/FacialLogin";
import PasswordLogin from "./components/login/PasswordLogin";
import RegistrationForm from "./components/register/register";
import FacialEnrollment from "./components/register/FacialEnrollment";
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

  const handleEnrollmentComplete = async (success, userToken) => {
    if (success && userToken) {
      setUserToken(userToken);
      setIsAuthenticated(true);
      setMode("dashboard");
      setSuccessMessage("Registro biométrico completado exitosamente");
      setRegistrationData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
        phone: "",
        idNumber: "",
      });
    } else {
      setErrorMessage("Error completando el registro biométrico");
    }
  };

  const handleLoginComplete = (success, token) => {
    if (success && token) {
      setUserToken(token);
      setIsAuthenticated(true);
      setMode("dashboard");
      setSuccessMessage("Autenticación exitosa. Bienvenido al sistema.");
    } else {
      setErrorMessage("Error durante la autenticación");
    }
  };

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

  const handleLogout = () => {
    setUserToken(null);
    setIsAuthenticated(false);
    setCurrentUser(null);
    setMode("home");
    setSuccessMessage("Sesión cerrada exitosamente");
  };

  const handleRegistrationSubmit = async () => {
    try {
      const response = await ApiService.registerUser(registrationData);

      if (response.success) {
        setSuccessMessage(
          "Usuario registrado exitosamente. Configurando registro biométrico..."
        );

        const loginResponse = await ApiService.loginCredentials(
          registrationData.email,
          registrationData.password
        );

        if (loginResponse.success) {
          setUserToken(loginResponse.userToken);
          setMode("register-facial");
          return true;
        } else {
          setErrorMessage(
            "Usuario registrado pero no se pudo iniciar sesión automáticamente"
          );
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

      {/* Header */}
      <Header
        mode={mode}
        isAuthenticated={isAuthenticated}
        onModeChange={setMode}
      />

      {/* Contenido principal */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {mode === "home" && <HomePage key="home" onModeChange={setMode} />}

          {mode === "login" && <LoginPage key="login" onModeChange={setMode} />}

          {mode === "login-facial" && (
            <FacialLogin
              key="login-facial"
              onLoginComplete={handleLoginComplete}
            />
          )}

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

          {mode === "register-facial" && (
            <FacialEnrollment
              key="register-facial"
              userData={registrationData}
              userToken={userToken}
              onEnrollmentComplete={handleEnrollmentComplete}
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

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';
import FacialEnrollment from './components/FacialEnrollment';
import FacialLogin from './components/FacialLogin';
import Dashboard from './components/Dashboard';
import ApiService from './services/ApiService';
import { 
  FaCamera, 
  FaSignInAlt, 
  FaUser, 
  FaShieldAlt,
  FaHome,
  FaSignOutAlt,
  FaCog,
  FaLock,
  FaEnvelope,
  FaPhone,
  FaIdCard,
  FaEye,
  FaEyeSlash,
  FaSpinner,
  FaCheckCircle,
  FaExclamationTriangle,
  FaServer,
  FaDatabase,
  FaWifi,
  FaTimes,
  FaSyncAlt
} from "react-icons/fa";

function App() {
  // Estados para controlar los flujos de la aplicación
  const [mode, setMode] = useState('home'); // 'home', 'login', 'login-password', 'register-form', 'register-facial', 'dashboard'
  const [userToken, setUserToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Estados para verificación del sistema
  const [systemStatus, setSystemStatus] = useState({
    backend: 'checking', // 'online', 'offline', 'checking'
    database: 'checking', // 'connected', 'disconnected', 'checking'
    lastCheck: null,
    totalUsers: 0,
    activeSessions: 0
  });
  const [showSystemAlert, setShowSystemAlert] = useState(true);
  const [isCheckingSystem, setIsCheckingSystem] = useState(false);
  
  // Estados para el formulario de registro
  const [registrationData, setRegistrationData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    idNumber: ''
  });
  
  // Estados para login con credenciales
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Verificar estado del sistema al cargar la aplicación
  React.useEffect(() => {
    checkSystemStatus();
    
    // Verificar cada 60 segundos si está autenticado (menos frecuente)
    // Verificar cada 30 segundos si no está autenticado
    const interval = setInterval(() => {
      checkSystemStatus();
    }, isAuthenticated ? 60000 : 30000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated]);
  
  // Función para verificar el estado del backend
  const checkSystemStatus = async () => {
    try {
      setIsCheckingSystem(true);
      console.log('[SystemCheck] Verificando estado del backend...');
      
      // Primero hacer health check básico
      const healthResponse = await ApiService.healthCheck();
      
      if (healthResponse.success) {
        // Si health check es exitoso, obtener información detallada
        const infoResponse = await ApiService.getServerInfo();
        
        if (infoResponse.success && infoResponse.info) {
          setSystemStatus({
            backend: 'online',
            database: infoResponse.info.database === 'connected' ? 'connected' : 'disconnected',
            lastCheck: new Date(),
            totalUsers: infoResponse.info.stats?.total_users || 0,
            activeSessions: infoResponse.info.stats?.active_sessions || 0
          });
          console.log('[SystemCheck] ✅ Sistema funcionando correctamente');
        } else {
          // Health check ok pero no hay info detallada
          setSystemStatus({
            backend: 'online',
            database: 'checking',
            lastCheck: new Date(),
            totalUsers: 0,
            activeSessions: 0
          });
        }
      } else {
        throw new Error(healthResponse.error || 'Backend no responde correctamente');
      }
    } catch (error) {
      console.error('[SystemCheck] ❌ Error verificando sistema:', error);
      setSystemStatus({
        backend: 'offline',
        database: 'disconnected',
        lastCheck: new Date(),
        totalUsers: 0,
        activeSessions: 0
      });
    } finally {
      setIsCheckingSystem(false);
    }
  };
  
  // Limpiar mensajes después de 4 segundos (más rápido que antes)
  React.useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        setErrorMessage('');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);
  
  // Manejador para completar el registro de usuario
  const handleUserRegistration = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      
      const response = await ApiService.registerUser(registrationData);
      
      if (response.success) {
        setSuccessMessage('Usuario registrado exitosamente. Ahora debe configurar su registro biométrico.');
        return true;
      } else {
        setErrorMessage(response.error || 'Error durante el registro');
        return false;
      }
    } catch (error) {
      console.error('Error registrando usuario:', error);
      setErrorMessage('Error de conexión. Verifique su internet.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Manejadores de eventos para las diferentes acciones
  const handleEnrollmentComplete = async (success, userToken) => {
    if (success && userToken) {
      setUserToken(userToken);
      setIsAuthenticated(true);
      setMode('dashboard');
      setSuccessMessage('Registro biométrico completado exitosamente');
      
      // Limpiar datos del formulario
      setRegistrationData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        idNumber: ''
      });
    } else {
      setErrorMessage('Error completando el registro biométrico');
    }
  };
  
  const handleLoginComplete = (success, token) => {
    if (success && token) {
      setUserToken(token);
      setIsAuthenticated(true);
      setMode('dashboard');
      setSuccessMessage('Autenticación exitosa. Bienvenido al sistema.');
    } else {
      setErrorMessage('Error durante la autenticación');
    }
  };
  
  const handlePasswordLogin = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      
      if (!loginData.email || !loginData.password) {
        setErrorMessage('Email y contraseña son requeridos');
        return;
      }
      
      const response = await ApiService.loginCredentials(loginData.email, loginData.password);
      
      if (response.success) {
        setUserToken(response.userToken);
        setIsAuthenticated(true);
        setMode('dashboard');
        setSuccessMessage('Login exitoso. Bienvenido al sistema.');
        
        // Limpiar formulario
        setLoginData({ email: '', password: '' });
      } else {
        setErrorMessage(response.error || 'Credenciales inválidas');
      }
    } catch (error) {
      console.error('Error en login:', error);
      setErrorMessage('Error de conexión. Verifique su internet.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLogout = () => {
    setUserToken(null);
    setIsAuthenticated(false);
    setCurrentUser(null);
    setMode('home');
    setSuccessMessage('Sesión cerrada exitosamente');
  };

  // Validar formulario de registro
  const validateRegistrationForm = () => {
    const errors = {};
    
    if (!registrationData.firstName.trim()) {
      errors.firstName = 'El nombre es requerido';
    }
    
    if (!registrationData.lastName.trim()) {
      errors.lastName = 'El apellido es requerido';
    }
    
    if (!registrationData.email.trim()) {
      errors.email = 'El correo electrónico es requerido';
    } else if (!/\S+@\S+\.\S+/.test(registrationData.email)) {
      errors.email = 'El correo electrónico no es válido';
    }
    
    if (!registrationData.password) {
      errors.password = 'La contraseña es requerida';
    } else if (registrationData.password.length < 6) {
      errors.password = 'La contraseña debe tener al menos 6 caracteres';
    }
    
    if (registrationData.password !== registrationData.confirmPassword) {
      errors.confirmPassword = 'Las contraseñas no coinciden';
    }
    
    if (!registrationData.phone.trim()) {
      errors.phone = 'El teléfono es requerido';
    } else if (!/^\d{10}$/.test(registrationData.phone.replace(/\D/g, ''))) {
      errors.phone = 'El teléfono debe tener 10 dígitos';
    }
    
    if (!registrationData.idNumber.trim()) {
      errors.idNumber = 'La cédula es requerida';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Manejar envío del formulario de registro
  const handleRegistrationFormSubmit = async (e) => {
    e.preventDefault();
    if (validateRegistrationForm()) {
      const userRegistered = await handleUserRegistration();
      if (userRegistered) {
        // Proceder al login automático y luego al registro facial
        const loginResponse = await ApiService.loginCredentials(registrationData.email, registrationData.password);
        if (loginResponse.success) {
          setUserToken(loginResponse.userToken);
          setMode('register-facial');
        } else {
          setErrorMessage('Usuario registrado pero no se pudo iniciar sesión automáticamente');
        }
      }
    }
  };

  // Manejar cambios en el formulario de registro
  const handleRegistrationInputChange = (field, value) => {
    setRegistrationData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Limpiar error específico cuando el usuario empieza a escribir
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // Manejar cambios en el formulario de login
  const handleLoginInputChange = (field, value) => {
    setLoginData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Variantes para las animaciones
  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    enter: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.3, ease: "easeOut" }
    },
    exit: { 
      opacity: 0, 
      y: -20,
      transition: { duration: 0.2 }
    }
  };

  // Componente de notificación
  const Notification = ({ type, message, onClose }) => (
    <motion.div
      initial={{ opacity: 0, y: -20, x: '100%' }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: -20, x: '100%' }}
      className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-xl backdrop-blur-sm border max-w-sm ${
        type === 'success' 
          ? 'bg-green-50 bg-opacity-95 border-green-200 text-green-800' 
          : 'bg-red-50 bg-opacity-95 border-red-200 text-red-800'
      }`}
    >
      <div className="flex items-start space-x-3">
        <div className={`p-1 rounded-lg ${
          type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {type === 'success' ? (
            <FaCheckCircle className="w-4 h-4 text-white" />
          ) : (
            <FaExclamationTriangle className="w-4 h-4 text-white" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium leading-5">{message}</p>
        </div>
        <button
          onClick={onClose}
          className={`p-1 rounded-md transition-colors ${
            type === 'success' 
              ? 'hover:bg-green-200 text-green-600' 
              : 'hover:bg-red-200 text-red-600'
          }`}
        >
          <FaTimes className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );

  // Componente de alerta del estado del sistema mejorado
  const SystemStatusAlert = () => {
    const getStatusInfo = () => {
      const isSystemOnline = systemStatus.backend === 'online' && systemStatus.database === 'connected';
      
      if (isSystemOnline) {
        return {
          color: 'green',
          bg: 'bg-green-50',
          border: 'border-green-200', 
          text: 'text-green-700',
          icon: 'text-green-500',
          status: '✅ Sistema Operativo',
          description: `${systemStatus.totalUsers} usuarios • ${systemStatus.activeSessions} sesiones activas`
        };
      } else if (systemStatus.backend === 'checking' || isCheckingSystem) {
        return {
          color: 'blue',
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-700', 
          icon: 'text-blue-500',
          status: '🔍 Verificando Sistema...',
          description: 'Comprobando conexión con servidor y base de datos'
        };
      } else {
        return {
          color: 'red',
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-700',
          icon: 'text-red-500', 
          status: '❌ Sistema No Disponible',
          description: 'Backend o base de datos desconectados'
        };
      }
    };

    const statusInfo = getStatusInfo();
    const isSystemOnline = systemStatus.backend === 'online' && systemStatus.database === 'connected';

    // Auto-ocultar después de 8 segundos si todo está funcionando bien
    React.useEffect(() => {
      if (isSystemOnline && showSystemAlert) {
        const timer = setTimeout(() => {
          setShowSystemAlert(false);
        }, 8000);
        return () => clearTimeout(timer);
      }
    }, [isSystemOnline, showSystemAlert]);

    if (!showSystemAlert) return null;

    // Versión SUPER minimalista cuando todo está bien
    if (isSystemOnline) {
      return (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`fixed top-4 right-4 z-40 max-w-xs p-3 rounded-lg shadow-sm ${statusInfo.bg} ${statusInfo.border} border backdrop-blur-sm bg-opacity-90`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 ${statusInfo.bg.replace('50', '400')} rounded-full animate-pulse`}></div>
              <div>
                <p className={`font-medium text-sm ${statusInfo.text}`}>Sistema OK</p>
                <p className={`text-xs ${statusInfo.text} opacity-60`}>
                  {systemStatus.totalUsers} usuarios online
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setShowSystemAlert(false)}
              className={`p-1 rounded-md hover:bg-white hover:bg-opacity-30 transition-colors ${statusInfo.text} opacity-40 hover:opacity-60`}
              title="Cerrar"
            >
              <FaTimes className="w-3 h-3" />
            </button>
          </div>
        </motion.div>
      );
    }

    // Versión compacta para problemas (menos intrusiva que antes)
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-40 max-w-md p-4 rounded-lg shadow-lg ${statusInfo.bg} ${statusInfo.border} border backdrop-blur-sm bg-opacity-95`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isCheckingSystem ? (
              <FaSyncAlt className={`w-4 h-4 animate-spin ${statusInfo.icon}`} />
            ) : (
              <FaExclamationTriangle className={`w-4 h-4 ${statusInfo.icon}`} />
            )}
            <div>
              <h4 className={`font-semibold text-sm ${statusInfo.text}`}>
                {statusInfo.status}
              </h4>
              <p className={`text-xs ${statusInfo.text} opacity-70 mt-1`}>
                {statusInfo.description}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={checkSystemStatus}
              disabled={isCheckingSystem}
              className={`p-1.5 rounded-md hover:bg-white hover:bg-opacity-30 transition-colors ${statusInfo.text} opacity-60 hover:opacity-80`}
              title="Verificar sistema"
            >
              <FaSyncAlt className={`w-3 h-3 ${isCheckingSystem ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowSystemAlert(false)}
              className={`p-1.5 rounded-md hover:bg-white hover:bg-opacity-30 transition-colors ${statusInfo.text} opacity-60 hover:opacity-80`}
              title="Cerrar"
            >
              <FaTimes className="w-3 h-3" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="App min-h-screen bg-gray-50">
      {/* Alerta del estado del sistema */}
      <AnimatePresence>
        {showSystemAlert && <SystemStatusAlert />}
      </AnimatePresence>

      {/* Botón flotante mejorado para mostrar estado del sistema cuando está oculto */}
      <AnimatePresence>
        {!showSystemAlert && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowSystemAlert(true)}
            className={`fixed bottom-6 right-6 z-30 p-3 rounded-full shadow-lg backdrop-blur-sm transition-all duration-300 ${
              systemStatus.backend === 'online' && systemStatus.database === 'connected'
                ? 'bg-green-500 bg-opacity-90 hover:bg-green-600 hover:shadow-green-500/25'
                : systemStatus.backend === 'checking'
                ? 'bg-blue-500 bg-opacity-90 hover:bg-blue-600 hover:shadow-blue-500/25'
                : 'bg-red-500 bg-opacity-90 hover:bg-red-600 hover:shadow-red-500/25'
            } border border-white border-opacity-20`}
            title={`Sistema: ${
              systemStatus.backend === 'online' && systemStatus.database === 'connected'
                ? 'Operativo ✅'
                : systemStatus.backend === 'checking'
                ? 'Verificando... 🔍'
                : 'No disponible ❌'
            }`}
          >
            <div className="relative">
              {isCheckingSystem ? (
                <FaSyncAlt className="w-4 h-4 text-white animate-spin" />
              ) : systemStatus.backend === 'online' && systemStatus.database === 'connected' ? (
                <FaCheckCircle className="w-4 h-4 text-white" />
              ) : (
                <FaExclamationTriangle className="w-4 h-4 text-white" />
              )}
              
              {/* Indicador pulsante para estado online */}
              {systemStatus.backend === 'online' && systemStatus.database === 'connected' && !isCheckingSystem && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-300 rounded-full animate-ping"></div>
              )}
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Notificaciones */}
      <AnimatePresence>
        {successMessage && (
          <Notification 
            type="success" 
            message={successMessage} 
            onClose={() => setSuccessMessage('')}
          />
        )}
        {errorMessage && (
          <Notification 
            type="error" 
            message={errorMessage} 
            onClose={() => setErrorMessage('')}
          />
        )}
      </AnimatePresence>

      {/* Header corporativo */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            {/* Logo y título corporativo */}
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-blue-900 to-blue-800 p-2 rounded-lg" style={{backgroundColor: '#3e5866'}}>
                <FaShieldAlt className="w-6 h-6 text-white" />
              </div>
          <div>
                <h1 className="text-2xl font-semibold" style={{color: '#3e5866'}}>SecureAuth</h1>
                <p className="text-gray-500 text-sm">Sistema de Autenticación Biométrica Avanzado</p>
              </div>
            </div>
            
            {/* Navegación */}
            {!isAuthenticated && mode === 'home' && (
              <div className="flex space-x-3">
                <button 
                  onClick={() => setMode('login')}
                  className="font-medium py-2 px-4 rounded-lg border transition-colors flex items-center space-x-2 hover:opacity-80"
                  style={{
                    color: '#54a8a0',
                    borderColor: '#54a8a0'
                  }}
                >
                  <FaSignInAlt className="w-4 h-4" />
                  <span>Iniciar Sesión</span>
                </button>
                
                <button 
                  onClick={() => setMode('register-form')}
                  className="font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2 text-white hover:opacity-90"
                  style={{backgroundColor: '#54a8a0'}}
                >
                  <FaUser className="w-4 h-4" />
                  <span>Registrarse</span>
                </button>
              </div>
            )}

            {mode !== 'home' && mode !== 'dashboard' && (
                  <button 
                onClick={() => setMode('home')}
                className="font-medium py-2 px-4 rounded-lg border transition-colors flex items-center space-x-2 hover:opacity-80"
                style={{
                  color: '#607123',
                  borderColor: '#607123'
                }}
              >
                <FaHome className="w-4 h-4" />
                <span>Inicio</span>
                  </button>
            )}
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {/* Pantalla de inicio */}
          {mode === 'home' && (
            <motion.div
              key="home"
              variants={pageVariants}
              initial="initial"
              animate="enter"
              exit="exit"
              className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4"
            >
              <div className="max-w-4xl mx-auto text-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="mb-8"
                >
                  <div className="inline-flex p-6 rounded-full mb-6" style={{backgroundColor: '#e8f5f3'}}>
                    <FaShieldAlt className="w-16 h-16" style={{color: '#3e5866'}} />
                  </div>
                  <h1 className="text-5xl font-bold mb-4" style={{color: '#3e5866'}}>
                    Bienvenido a SecureAuth
                  </h1>
                </motion.div>

                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12"
                >
                </motion.div>

                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  className="flex flex-col sm:flex-row gap-4 justify-center"
                >
                  <button 
                    onClick={() => setMode('login')}
                    className="px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 hover:shadow-lg flex items-center justify-center space-x-3"
                    style={{
                      backgroundColor: '#54a8a0',
                      color: 'white'
                    }}
                  >
                    <FaSignInAlt className="w-5 h-5" />
                    <span>Iniciar Sesión</span>
                  </button>
                  
                  <button 
                    onClick={() => setMode('register-form')}
                    className="px-8 py-4 rounded-xl font-semibold text-lg border-2 transition-all duration-200 hover:shadow-lg flex items-center justify-center space-x-3"
                    style={{
                      borderColor: '#54a8a0',
                      color: '#54a8a0',
                      backgroundColor: 'transparent'
                    }}
                  >
                    <FaUser className="w-5 h-5" />
                    <span>Registrarse</span>
                  </button>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Pantalla de selección de login */}
          {mode === 'login' && (
            <motion.div
              key="login"
              variants={pageVariants}
              initial="initial"
              animate="enter"
              exit="exit"
              className="min-h-screen flex items-center justify-center px-4 py-8"
            >
              <div className="max-w-md w-full space-y-8">
              <div className="text-center">
                  <div className="inline-flex p-4 rounded-full mb-4" style={{backgroundColor: '#e8f5f3'}}>
                    <FaSignInAlt className="w-8 h-8" style={{color: '#3e5866'}} />
                  </div>
                  <h2 className="text-3xl font-bold" style={{color: '#3e5866'}}>Iniciar Sesión</h2>
                  <p className="text-gray-600 mt-2">Seleccione su método de autenticación preferido</p>
                </div>

                <div className="space-y-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setMode('login-facial')}
                    className="w-full p-6 rounded-xl border-2 transition-all duration-200 hover:shadow-lg"
                    style={{
                      borderColor: '#54a8a0',
                      backgroundColor: '#f0f8f7'
                    }}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="p-3 rounded-xl" style={{backgroundColor: '#54a8a0'}}>
                        <FaCamera className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-lg" style={{color: '#3e5866'}}>
                          Reconocimiento Facial
                        </h3>
                        <p className="text-gray-600 text-sm">
                          Autenticación biométrica avanzada con detección de vida
                        </p>
                      </div>
                    </div>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setMode('login-password')}
                    className="w-full p-6 rounded-xl border-2 transition-all duration-200 hover:shadow-lg"
                    style={{
                      borderColor: '#95b54c',
                      backgroundColor: '#f7f9f2'
                    }}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="p-3 rounded-xl" style={{backgroundColor: '#95b54c'}}>
                        <FaLock className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-lg" style={{color: '#3e5866'}}>
                          Contraseña
                        </h3>
                        <p className="text-gray-600 text-sm">
                          Método tradicional con email y contraseña
                        </p>
                      </div>
                    </div>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Login facial */}
          {mode === 'login-facial' && (
            <motion.div
              key="login-facial"
              variants={pageVariants}
              initial="initial"
              animate="enter"
              exit="exit"
              className="py-8"
            >
              <FacialLogin onLoginComplete={handleLoginComplete} />
            </motion.div>
          )}

          {/* Login con contraseña */}
          {mode === 'login-password' && (
            <motion.div
              key="login-password"
              variants={pageVariants}
              initial="initial"
              animate="enter"
              exit="exit"
              className="min-h-screen flex items-center justify-center px-4 py-8"
            >
              <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                  <div className="inline-flex p-4 rounded-full mb-4" style={{backgroundColor: '#f7f9f2'}}>
                    <FaLock className="w-8 h-8" style={{color: '#95b54c'}} />
                  </div>
                  <h2 className="text-3xl font-bold" style={{color: '#3e5866'}}>Iniciar con Contraseña</h2>
                  <p className="text-gray-600 mt-2">Ingrese sus credenciales para acceder</p>
                </div>

                <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handlePasswordLogin(); }}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Correo Electrónico
                    </label>
                    <div className="relative">
                      <FaEnvelope className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={loginData.email}
                        onChange={(e) => handleLoginInputChange('email', e.target.value)}
                        className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="usuario@ejemplo.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contraseña
                    </label>
                    <div className="relative">
                      <FaLock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        type={showLoginPassword ? "text" : "password"}
                        value={loginData.password}
                        onChange={(e) => handleLoginInputChange('password', e.target.value)}
                        className="pl-10 pr-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="••••••••"
                        required
                      />
                  <button 
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                      >
                        {showLoginPassword ? <FaEyeSlash className="w-5 h-5" /> : <FaEye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-200 hover:shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2"
                    style={{backgroundColor: '#95b54c'}}
                  >
                    {isLoading ? (
                      <FaSpinner className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <FaSignInAlt className="w-5 h-5" />
                        <span>Iniciar Sesión</span>
                      </>
                    )}
                  </motion.button>
                </form>
              </div>
            </motion.div>
          )}

          {/* Formulario de registro */}
          {mode === 'register-form' && (
            <motion.div
              key="register-form"
              variants={pageVariants}
              initial="initial"
              animate="enter"
              exit="exit"
              className="min-h-screen py-8 px-4"
            >
              <div className="max-w-2xl mx-auto">
                <div className="text-center mb-8">
                  <div className="inline-flex p-4 rounded-full mb-4" style={{backgroundColor: '#f0f8f7'}}>
                    <FaUser className="w-8 h-8" style={{color: '#54a8a0'}} />
                  </div>
                  <h2 className="text-3xl font-bold" style={{color: '#3e5866'}}>Registro de Usuario</h2>
                  <p className="text-gray-600 mt-2">Complete sus datos personales para crear su cuenta</p>
                </div>

                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
                  <form onSubmit={handleRegistrationFormSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Nombre */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nombre <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={registrationData.firstName}
                          onChange={(e) => handleRegistrationInputChange('firstName', e.target.value)}
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            formErrors.firstName ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="Juan"
                        />
                        {formErrors.firstName && (
                          <p className="text-red-500 text-sm mt-1">{formErrors.firstName}</p>
                        )}
                      </div>

                      {/* Apellido */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Apellido <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={registrationData.lastName}
                          onChange={(e) => handleRegistrationInputChange('lastName', e.target.value)}
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            formErrors.lastName ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="Pérez"
                        />
                        {formErrors.lastName && (
                          <p className="text-red-500 text-sm mt-1">{formErrors.lastName}</p>
                        )}
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Correo Electrónico <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <FaEnvelope className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input
                          type="email"
                          value={registrationData.email}
                          onChange={(e) => handleRegistrationInputChange('email', e.target.value)}
                          className={`pl-10 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            formErrors.email ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="juan.perez@ejemplo.com"
                        />
                      </div>
                      {formErrors.email && (
                        <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Contraseña */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Contraseña <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <FaLock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                          <input
                            type={showPassword ? "text" : "password"}
                            value={registrationData.password}
                            onChange={(e) => handleRegistrationInputChange('password', e.target.value)}
                            className={`pl-10 pr-10 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                              formErrors.password ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                          >
                            {showPassword ? <FaEyeSlash className="w-5 h-5" /> : <FaEye className="w-5 h-5" />}
                          </button>
                        </div>
                        {formErrors.password && (
                          <p className="text-red-500 text-sm mt-1">{formErrors.password}</p>
                        )}
                      </div>

                      {/* Confirmar Contraseña */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Confirmar Contraseña <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <FaLock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            value={registrationData.confirmPassword}
                            onChange={(e) => handleRegistrationInputChange('confirmPassword', e.target.value)}
                            className={`pl-10 pr-10 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                              formErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="••••••••"
                          />
                  <button 
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                            {showConfirmPassword ? <FaEyeSlash className="w-5 h-5" /> : <FaEye className="w-5 h-5" />}
                  </button>
                        </div>
                        {formErrors.confirmPassword && (
                          <p className="text-red-500 text-sm mt-1">{formErrors.confirmPassword}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Teléfono */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Teléfono <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <FaPhone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                          <input
                            type="tel"
                            value={registrationData.phone}
                            onChange={(e) => handleRegistrationInputChange('phone', e.target.value)}
                            className={`pl-10 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                              formErrors.phone ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="3001234567"
                          />
                        </div>
                        {formErrors.phone && (
                          <p className="text-red-500 text-sm mt-1">{formErrors.phone}</p>
                        )}
                      </div>

                      {/* Cédula */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Número de Identificación <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <FaIdCard className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                          <input
                            type="text"
                            value={registrationData.idNumber}
                            onChange={(e) => handleRegistrationInputChange('idNumber', e.target.value)}
                            className={`pl-10 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                              formErrors.idNumber ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="12345678"
                          />
                        </div>
                        {formErrors.idNumber && (
                          <p className="text-red-500 text-sm mt-1">{formErrors.idNumber}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-6">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={isLoading}
                        className="flex-1 py-3 px-6 rounded-lg font-semibold text-white transition-all duration-200 hover:shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2"
                        style={{backgroundColor: '#54a8a0'}}
                      >
                        {isLoading ? (
                          <FaSpinner className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <FaCamera className="w-5 h-5" />
                            <span>Continuar al Registro Biométrico</span>
                          </>
                        )}
                      </motion.button>
                    </div>
                  </form>
                </div>
              </div>
            </motion.div>
          )}

          {/* Registro facial */}
          {mode === 'register-facial' && (
            <motion.div
              key="register-facial"
              variants={pageVariants}
              initial="initial"
              animate="enter"
              exit="exit"
              className="py-8"
            >
              <FacialEnrollment 
                userData={registrationData}
                userToken={userToken}
                onEnrollmentComplete={handleEnrollmentComplete}
              />
            </motion.div>
          )}

          {/* Dashboard */}
          {mode === 'dashboard' && isAuthenticated && (
            <motion.div
              key="dashboard"
              variants={pageVariants}
              initial="initial"
              animate="enter"
              exit="exit"
            >
              <Dashboard 
                onLogout={handleLogout}
                userToken={userToken}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;

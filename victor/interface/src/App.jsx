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
  FaExclamationTriangle
} from "react-icons/fa";

function App() {
  // Estados para controlar los flujos de la aplicación
  const [mode, setMode] = useState('home'); // 'home', 'login', 'login-password', 'register-form', 'register-facial', 'dashboard'
  const [userToken, setUserToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
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
  
  // Limpiar mensajes después de 5 segundos
  React.useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        setErrorMessage('');
      }, 5000);
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
      initial={{ opacity: 0, y: -50, x: '100%' }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: -50, x: '100%' }}
      className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
      } text-white max-w-sm`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {type === 'success' ? (
            <FaCheckCircle className="w-5 h-5" />
          ) : (
            <FaExclamationTriangle className="w-5 h-5" />
          )}
          <p className="text-sm font-medium">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="ml-2 text-white hover:text-gray-200"
        >
          ×
        </button>
      </div>
    </motion.div>
  );

  return (
    <div className="App min-h-screen bg-gray-50">
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
                  <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                    Sistema de autenticación biométrica avanzado con reconocimiento facial e inteligencia artificial. 
                    Seguridad de nivel empresarial para proteger su identidad digital.
                  </p>
                </motion.div>

                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12"
                >
                  <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                    <div className="w-12 h-12 rounded-lg mb-4 flex items-center justify-center" style={{backgroundColor: '#cbe552'}}>
                      <FaCamera className="w-6 h-6" style={{color: '#607123'}} />
                    </div>
                    <h3 className="text-lg font-semibold mb-2" style={{color: '#3e5866'}}>Reconocimiento Facial</h3>
                    <p className="text-gray-600 text-sm">
                      Tecnología de última generación con detección de vida para máxima seguridad
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                    <div className="w-12 h-12 rounded-lg mb-4 flex items-center justify-center" style={{backgroundColor: '#95b54c'}}>
                      <FaLock className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2" style={{color: '#3e5866'}}>Encriptación Avanzada</h3>
                    <p className="text-gray-600 text-sm">
                      Sus datos biométricos están protegidos con encriptación de grado militar
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                    <div className="w-12 h-12 rounded-lg mb-4 flex items-center justify-center" style={{backgroundColor: '#54a8a0'}}>
                      <FaCog className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2" style={{color: '#3e5866'}}>Fácil Integración</h3>
                    <p className="text-gray-600 text-sm">
                      Sistema modular que se adapta a cualquier infraestructura empresarial
                    </p>
                  </div>
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

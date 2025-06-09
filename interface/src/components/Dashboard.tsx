import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ApiService from '../services/ApiService';
import { 
  FaUser, 
  FaShieldAlt, 
  FaChartLine, 
  FaCog, 
  FaSignOutAlt, 
  FaEye, 
  FaEyeSlash,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaDesktop,
  FaTrash,
  FaDownload,
  FaUserShield,
  FaFingerprint,
  FaHistory,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimes,
  FaSync,
  FaBell,
  FaLock,
  FaCamera,
  FaGlobe
} from 'react-icons/fa';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idNumber: string;
  createdAt: string;
  biometricEnabled: boolean;
  activeSessions: number;
}

interface LoginAttempt {
  id: number;
  email: string;
  ip_address: string;
  success: boolean;
  failure_reason: string | null;
  user_agent: string;
  created_at: string;
}

interface BiometricData {
  capture_type: string;
  quality_score: number;
  created_at: string;
}

interface DashboardStats {
  totalLogins: number;
  activeSessions: number;
  biometricEnabled: boolean;
  recentActivity: LoginAttempt[];
  biometricData: BiometricData[];
}

interface DashboardProps {
  onLogout: () => void;
  userToken: string;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout, userToken }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'security' | 'profile' | 'settings'>('overview');
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [notifications, setNotifications] = useState<Array<{id: number, type: 'success' | 'warning' | 'error', message: string}>>([]);

  useEffect(() => {
    loadUserData();
  }, []);

  const addNotification = (type: 'success' | 'warning' | 'error', message: string) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const loadUserData = async () => {
    try {
      setLoading(true);
      const [profileResponse, statsResponse] = await Promise.all([
        ApiService.getUserProfile(userToken),
        ApiService.getDashboardStats(userToken)
      ]);

      if (profileResponse.success && profileResponse.user) {
        setUser(profileResponse.user);
      } else {
        setError(profileResponse.error || 'Error cargando perfil');
      }

      if (statsResponse.success && statsResponse.stats) {
        setStats(statsResponse.stats);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      setError('Error conectando con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await ApiService.logout(userToken);
      addNotification('success', 'Sesión cerrada exitosamente');
      setTimeout(() => onLogout(), 1000);
    } catch (error) {
      console.error('Error en logout:', error);
      onLogout(); // Logout local si falla el servidor
    }
  };

  const clearBiometricData = async () => {
    if (!window.confirm('¿Está seguro de eliminar todos sus datos biométricos? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const response = await ApiService.clearBiometricData(userToken);
      if (response.success) {
        addNotification('success', 'Datos biométricos eliminados exitosamente');
        loadUserData(); // Recargar datos
      } else {
        addNotification('error', response.error || 'Error eliminando datos biométricos');
      }
    } catch (error) {
      console.error('Error eliminando datos biométricos:', error);
      addNotification('error', 'Error conectando con el servidor');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatUserAgent = (userAgent: string) => {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Desconocido';
  };

  const renderTabButton = (tab: string, icon: React.ReactNode, label: string) => (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => setActiveTab(tab as any)}
      className={`flex items-center space-x-3 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
        activeTab === tab
          ? 'text-white shadow-lg'
          : 'text-gray-600 hover:text-white hover:bg-opacity-80'
      }`}
      style={{
        backgroundColor: activeTab === tab ? '#3e5866' : 'transparent'
      }}
    >
      {icon}
      <span>{label}</span>
    </motion.button>
  );

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-6 shadow-lg border border-gray-200"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-xl text-white" style={{backgroundColor: '#54a8a0'}}>
              <FaChartLine className="w-6 h-6" />
            </div>
            <div>
              <p className="text-gray-600 text-sm">Total Logins</p>
              <p className="text-2xl font-bold text-gray-800">{stats?.totalLogins || 0}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-6 shadow-lg border border-gray-200"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-xl text-white" style={{backgroundColor: '#95b54c'}}>
              <FaDesktop className="w-6 h-6" />
            </div>
            <div>
              <p className="text-gray-600 text-sm">Sesiones Activas</p>
              <p className="text-2xl font-bold text-gray-800">{stats?.activeSessions || 0}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl p-6 shadow-lg border border-gray-200"
        >
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-xl text-white`} style={{
              backgroundColor: stats?.biometricEnabled ? '#cbe552' : '#dc2626'
            }}>
              <FaFingerprint className="w-6 h-6" />
            </div>
            <div>
              <p className="text-gray-600 text-sm">Biométrico</p>
              <p className="text-2xl font-bold text-gray-800">
                {stats?.biometricEnabled ? 'Activo' : 'Inactivo'}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl p-6 shadow-lg border border-gray-200"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-xl text-white" style={{backgroundColor: '#607123'}}>
              <FaUserShield className="w-6 h-6" />
            </div>
            <div>
              <p className="text-gray-600 text-sm">Nivel Seguridad</p>
              <p className="text-2xl font-bold text-gray-800">
                {stats?.biometricEnabled ? 'Alto' : 'Medio'}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Actividad reciente */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-xl shadow-lg border border-gray-200"
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <FaHistory className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-800">Actividad Reciente</h3>
          </div>
        </div>
        <div className="p-6">
          {stats?.recentActivity && stats.recentActivity.length > 0 ? (
            <div className="space-y-4">
              {stats.recentActivity.slice(0, 8).map((attempt, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-lg ${attempt.success ? 'bg-green-100' : 'bg-red-100'}`}>
                      {attempt.success ? (
                        <FaCheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <FaTimes className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">
                        {attempt.success ? 'Login Exitoso' : 'Intento Fallido'}
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span className="flex items-center space-x-1">
                          <FaMapMarkerAlt className="w-3 h-3" />
                          <span>{attempt.ip_address}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <FaDesktop className="w-3 h-3" />
                          <span>{formatUserAgent(attempt.user_agent)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>{formatDate(attempt.created_at)}</p>
                    {!attempt.success && attempt.failure_reason && (
                      <p className="text-red-500 text-xs">{attempt.failure_reason}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No hay actividad reciente</p>
          )}
        </div>
      </motion.div>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="space-y-6">
      {/* Estado de seguridad */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl p-6 shadow-lg border border-gray-200"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FaShieldAlt className="w-6 h-6 text-gray-600" />
            <h3 className="text-xl font-semibold text-gray-800">Estado de Seguridad</h3>
          </div>
          <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
            stats?.biometricEnabled ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {stats?.biometricEnabled ? 'Seguridad Alta' : 'Seguridad Media'}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <FaFingerprint className="w-5 h-5 text-gray-600" />
                <span className="font-medium">Autenticación Biométrica</span>
              </div>
              <div className={`flex items-center space-x-2 ${
                stats?.biometricEnabled ? 'text-green-600' : 'text-red-600'
              }`}>
                {stats?.biometricEnabled ? <FaCheckCircle /> : <FaTimes />}
                <span className="text-sm font-medium">
                  {stats?.biometricEnabled ? 'Activa' : 'Inactiva'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <FaLock className="w-5 h-5 text-gray-600" />
                <span className="font-medium">Autenticación por Contraseña</span>
              </div>
              <div className="flex items-center space-x-2 text-green-600">
                <FaCheckCircle />
                <span className="text-sm font-medium">Activa</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <FaBell className="w-5 h-5 text-gray-600" />
                <span className="font-medium">Alertas de Seguridad</span>
              </div>
              <div className="flex items-center space-x-2 text-green-600">
                <FaCheckCircle />
                <span className="text-sm font-medium">Activas</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Datos Biométricos</h4>
            {stats?.biometricData && stats.biometricData.length > 0 ? (
              <div className="space-y-3">
                {stats.biometricData.map((data, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FaCamera className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium capitalize">{data.capture_type.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full"
                          style={{
                            width: `${data.quality_score * 100}%`,
                            backgroundColor: data.quality_score > 0.8 ? '#10b981' : data.quality_score > 0.6 ? '#f59e0b' : '#ef4444'
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{Math.round(data.quality_score * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No hay datos biométricos registrados</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Acciones de seguridad */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl p-6 shadow-lg border border-gray-200"
      >
        <h3 className="text-xl font-semibold text-gray-800 mb-6">Acciones de Seguridad</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => addNotification('warning', 'Funcionalidad en desarrollo')}
            className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FaSync className="w-5 h-5 text-blue-600" />
            <div className="text-left">
              <p className="font-medium text-gray-800">Regenerar Embeddings</p>
              <p className="text-sm text-gray-600">Actualizar datos biométricos</p>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={clearBiometricData}
            className="flex items-center space-x-3 p-4 border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-red-600"
          >
            <FaTrash className="w-5 h-5" />
            <div className="text-left">
              <p className="font-medium">Eliminar Datos Biométricos</p>
              <p className="text-sm">Borrar todos los embeddings faciales</p>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => addNotification('warning', 'Funcionalidad en desarrollo')}
            className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FaDownload className="w-5 h-5 text-green-600" />
            <div className="text-left">
              <p className="font-medium text-gray-800">Exportar Datos</p>
              <p className="text-sm text-gray-600">Descargar datos de usuario</p>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => addNotification('warning', 'Funcionalidad en desarrollo')}
            className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FaHistory className="w-5 h-5 text-purple-600" />
            <div className="text-left">
              <p className="font-medium text-gray-800">Historial Completo</p>
              <p className="text-sm text-gray-600">Ver todos los intentos de login</p>
            </div>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );

  const renderProfileTab = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl p-6 shadow-lg border border-gray-200"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <FaUser className="w-6 h-6 text-gray-600" />
          <h3 className="text-xl font-semibold text-gray-800">Información Personal</h3>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowSensitiveData(!showSensitiveData)}
          className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          {showSensitiveData ? <FaEyeSlash /> : <FaEye />}
          <span>{showSensitiveData ? 'Ocultar' : 'Mostrar'} Datos Sensibles</span>
        </motion.button>
      </div>

      {user && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="p-4 border border-gray-200 rounded-lg">
              <label className="text-sm font-medium text-gray-600">Nombre Completo</label>
              <p className="text-lg font-medium text-gray-800">{`${user.firstName} ${user.lastName}`}</p>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <label className="text-sm font-medium text-gray-600">Correo Electrónico</label>
              <p className="text-lg font-medium text-gray-800">{user.email}</p>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <label className="text-sm font-medium text-gray-600">Teléfono</label>
              <p className="text-lg font-medium text-gray-800">
                {showSensitiveData ? user.phone : user.phone.replace(/\d(?=\d{4})/g, '*')}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 border border-gray-200 rounded-lg">
              <label className="text-sm font-medium text-gray-600">Número de Identificación</label>
              <p className="text-lg font-medium text-gray-800">
                {showSensitiveData ? user.idNumber : user.idNumber.replace(/\d(?=\d{4})/g, '*')}
              </p>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <label className="text-sm font-medium text-gray-600">Fecha de Registro</label>
              <p className="text-lg font-medium text-gray-800">{formatDate(user.createdAt)}</p>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <label className="text-sm font-medium text-gray-600">ID de Usuario</label>
              <p className="text-lg font-medium text-gray-800">#{user.id}</p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );

  const renderSettingsTab = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-xl font-semibold text-gray-800 mb-6">Configuración de Cuenta</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-800">Notificaciones por Email</h4>
              <p className="text-sm text-gray-600">Recibir alertas de seguridad y actualizaciones</p>
            </div>
            <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200">
              <span className="sr-only">Activar notificaciones</span>
              <span className="inline-block h-4 w-4 transform rounded-full bg-white transition" />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-800">Verificación en Dos Pasos</h4>
              <p className="text-sm text-gray-600">Agregar una capa extra de seguridad</p>
            </div>
            <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200">
              <span className="sr-only">Activar 2FA</span>
              <span className="inline-block h-4 w-4 transform rounded-full bg-white transition" />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-800">Sesiones Automáticas</h4>
              <p className="text-sm text-gray-600">Mantener sesión activa por más tiempo</p>
            </div>
            <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200">
              <span className="sr-only">Sesiones automáticas</span>
              <span className="inline-block h-4 w-4 transform rounded-full bg-white transition" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-start space-x-3">
          <FaExclamationTriangle className="w-6 h-6 text-red-600 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-red-800">Zona de Peligro</h3>
            <p className="text-red-600 mb-4">Estas acciones son irreversibles. Proceda con precaución.</p>
            
            <div className="space-y-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => addNotification('warning', 'Funcionalidad en desarrollo')}
                className="block w-full text-left p-3 border border-red-300 rounded-lg hover:bg-red-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <FaLock className="w-5 h-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-800">Cambiar Contraseña</p>
                    <p className="text-sm text-red-600">Actualizar credenciales de acceso</p>
                  </div>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => addNotification('warning', 'Funcionalidad en desarrollo')}
                className="block w-full text-left p-3 border border-red-300 rounded-lg hover:bg-red-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <FaTrash className="w-5 h-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-800">Eliminar Cuenta</p>
                    <p className="text-sm text-red-600">Borrar permanentemente todos los datos</p>
                  </div>
                </div>
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notificaciones */}
      <AnimatePresence>
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, y: -50, x: '100%' }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -50, x: '100%' }}
            className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
              notification.type === 'success' ? 'bg-green-500' :
              notification.type === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
            } text-white max-w-sm`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{notification.message}</p>
              <button
                onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
                className="ml-2 text-white hover:text-gray-200"
              >
                <FaTimes className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="p-2 rounded-lg text-white" style={{backgroundColor: '#3e5866'}}>
                <FaUserShield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Panel de Control</h1>
                <p className="text-sm text-gray-600">
                  Bienvenido, {user?.firstName} {user?.lastName}
                </p>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200"
              style={{backgroundColor: '#dc2626'}}
            >
              <FaSignOutAlt className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="flex space-x-2 mb-8 p-2 bg-white rounded-xl shadow-sm">
          {renderTabButton('overview', <FaChartLine className="w-5 h-5" />, 'Resumen')}
          {renderTabButton('security', <FaShieldAlt className="w-5 h-5" />, 'Seguridad')}
          {renderTabButton('profile', <FaUser className="w-5 h-5" />, 'Perfil')}
          {renderTabButton('settings', <FaCog className="w-5 h-5" />, 'Configuración')}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'security' && renderSecurityTab()}
            {activeTab === 'profile' && renderProfileTab()}
            {activeTab === 'settings' && renderSettingsTab()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Dashboard; 
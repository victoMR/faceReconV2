"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FaExclamationTriangle,
  FaSyncAlt,
  FaTimes,
  FaCheckCircle,
} from "react-icons/fa";

interface SystemStatus {
  backend: "online" | "offline" | "checking";
  database: "connected" | "disconnected" | "checking";
  lastCheck: Date | null;
  totalUsers: number;
  activeSessions: number;
}

interface SystemStatusAlertProps {
  systemStatus: SystemStatus;
  showSystemAlert: boolean;
  isCheckingSystem: boolean;
  onToggleAlert: (show: boolean) => void;
  onCheckSystem: () => void;
}

export default function SystemStatusAlert({
  systemStatus,
  showSystemAlert,
  isCheckingSystem,
  onToggleAlert,
  onCheckSystem,
}: SystemStatusAlertProps) {
  const getStatusInfo = () => {
    const isSystemOnline =
      systemStatus.backend === "online" &&
      systemStatus.database === "connected";

    if (isSystemOnline) {
      return {
        color: "green",
        bg: "bg-green-50",
        border: "border-green-200",
        text: "text-green-700",
        icon: "text-green-500",
        status: "✅ Sistema Operativo",
        description: `${systemStatus.totalUsers} usuarios • ${systemStatus.activeSessions} sesiones activas`,
      };
    } else if (systemStatus.backend === "checking" || isCheckingSystem) {
      return {
        color: "blue",
        bg: "bg-blue-50",
        border: "border-blue-200",
        text: "text-blue-700",
        icon: "text-blue-500",
        status: "🔍 Verificando Sistema...",
        description: "Comprobando conexión con servidor y base de datos",
      };
    } else {
      return {
        color: "red",
        bg: "bg-red-50",
        border: "border-red-200",
        text: "text-red-700",
        icon: "text-red-500",
        status: "❌ Sistema No Disponible",
        description: "Backend o base de datos desconectados",
      };
    }
  };

  const statusInfo = getStatusInfo();
  const isSystemOnline =
    systemStatus.backend === "online" && systemStatus.database === "connected";

  // Auto-ocultar después de 8 segundos si todo está funcionando bien
  useEffect(() => {
    if (isSystemOnline && showSystemAlert) {
      const timer = setTimeout(() => {
        onToggleAlert(false);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [isSystemOnline, showSystemAlert, onToggleAlert]);

  return (
    <>
      {/* Alerta del sistema */}
      <AnimatePresence>
        {showSystemAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed ${
              isSystemOnline
                ? "top-4 right-4"
                : "top-4 left-1/2 transform -translate-x-1/2"
            } z-40 max-w-md p-4 rounded-lg shadow-lg ${statusInfo.bg} ${
              statusInfo.border
            } border backdrop-blur-sm bg-opacity-95`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {isCheckingSystem ? (
                  <FaSyncAlt
                    className={`w-4 h-4 animate-spin ${statusInfo.icon}`}
                  />
                ) : isSystemOnline ? (
                  <div
                    className={`w-2 h-2 ${statusInfo.bg.replace(
                      "50",
                      "400"
                    )} rounded-full animate-pulse`}
                  ></div>
                ) : (
                  <FaExclamationTriangle
                    className={`w-4 h-4 ${statusInfo.icon}`}
                  />
                )}
                <div>
                  <h4 className={`font-semibold text-sm ${statusInfo.text}`}>
                    {isSystemOnline ? "Sistema OK" : statusInfo.status}
                  </h4>
                  <p className={`text-xs ${statusInfo.text} opacity-70 mt-1`}>
                    {isSystemOnline
                      ? `${systemStatus.totalUsers} usuarios online`
                      : statusInfo.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                {!isSystemOnline && (
                  <button
                    onClick={onCheckSystem}
                    disabled={isCheckingSystem}
                    className={`p-1.5 rounded-md hover:bg-white hover:bg-opacity-30 transition-colors ${statusInfo.text} opacity-60 hover:opacity-80`}
                    title="Verificar sistema"
                  >
                    <FaSyncAlt
                      className={`w-3 h-3 ${
                        isCheckingSystem ? "animate-spin" : ""
                      }`}
                    />
                  </button>
                )}
                <button
                  onClick={() => onToggleAlert(false)}
                  className={`p-1.5 rounded-md hover:bg-white hover:bg-opacity-30 transition-colors ${statusInfo.text} opacity-60 hover:opacity-80`}
                  title="Cerrar"
                >
                  <FaTimes className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón flotante cuando la alerta está oculta */}
      <AnimatePresence>
        {!showSystemAlert && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onToggleAlert(true)}
            className={`fixed bottom-6 right-6 z-30 p-3 rounded-full shadow-lg backdrop-blur-sm transition-all duration-300 ${
              isSystemOnline
                ? "bg-green-500 bg-opacity-90 hover:bg-green-600 hover:shadow-green-500/25"
                : systemStatus.backend === "checking"
                ? "bg-blue-500 bg-opacity-90 hover:bg-blue-600 hover:shadow-blue-500/25"
                : "bg-red-500 bg-opacity-90 hover:bg-red-600 hover:shadow-red-500/25"
            } border border-white border-opacity-20`}
            title={`Sistema: ${
              isSystemOnline
                ? "Operativo ✅"
                : systemStatus.backend === "checking"
                ? "Verificando... 🔍"
                : "No disponible ❌"
            }`}
          >
            <div className="relative">
              {isCheckingSystem ? (
                <FaSyncAlt className="w-4 h-4 text-white animate-spin" />
              ) : isSystemOnline ? (
                <FaCheckCircle className="w-4 h-4 text-white" />
              ) : (
                <FaExclamationTriangle className="w-4 h-4 text-white" />
              )}

              {/* Indicador pulsante para estado online */}
              {isSystemOnline && !isCheckingSystem && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-300 rounded-full animate-ping"></div>
              )}
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}

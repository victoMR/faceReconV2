import { FaShieldAlt, FaSignInAlt, FaUser, FaHome } from "react-icons/fa";

interface HeaderProps {
  mode: string;
  isAuthenticated: boolean;
  onModeChange: (mode: string) => void;
}

export default function Header({
  mode,
  isAuthenticated,
  onModeChange,
}: HeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          {/* Logo y título */}
          <div className="flex items-center space-x-3">
            <div
              className="bg-gradient-to-br from-blue-900 to-blue-800 p-2 rounded-lg"
              style={{ backgroundColor: "#3e5866" }}
            >
              <FaShieldAlt className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1
                className="text-2xl font-semibold"
                style={{ color: "#3e5866" }}
              >
                SecureAuth
              </h1>
              <p className="text-gray-500 text-sm">
                Sistema de Autenticación Biométrica Avanzado
              </p>
            </div>
          </div>

          {/* Navegación */}
          {!isAuthenticated && mode === "home" && (
            <div className="flex space-x-3">
              <button
                onClick={() => onModeChange("login")}
                className="font-medium py-2 px-4 rounded-lg border transition-colors flex items-center space-x-2 hover:opacity-80"
                style={{
                  color: "#54a8a0",
                  borderColor: "#54a8a0",
                }}
              >
                <FaSignInAlt className="w-4 h-4" />
                <span>Iniciar Sesión</span>
              </button>

              <button
                onClick={() => onModeChange("register-form")}
                className="font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2 text-white hover:opacity-90"
                style={{ backgroundColor: "#54a8a0" }}
              >
                <FaUser className="w-4 h-4" />
                <span>Registrarse</span>
              </button>
            </div>
          )}

          {mode !== "home" && mode !== "dashboard" && (
            <button
              onClick={() => onModeChange("home")}
              className="font-medium py-2 px-4 rounded-lg border transition-colors flex items-center space-x-2 hover:opacity-80"
              style={{
                color: "#607123",
                borderColor: "#607123",
              }}
            >
              <FaHome className="w-4 h-4" />
              <span>Inicio</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

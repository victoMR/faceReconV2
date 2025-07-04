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
            <button
              className="bg-gradient-to-br from-blue-900 to-blue-800 p-2 rounded-lg hover:from-blue-800 hover:to-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200"
              onClick={() => onModeChange("home")}
              aria-label="Ir a inicio"
              type="button"
            >
              <FaShieldAlt className="w-6 h-6 text-white" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-[#3e5866]">Mono Repo</h1>
            </div>
          </div>

          {/* Navegación */}
          {!isAuthenticated && mode === "home" && (
            <div className="flex space-x-3">
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

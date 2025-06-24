import { useState } from "react";
import { motion } from "framer-motion";
import {
  FaLock,
  FaEnvelope,
  FaSignInAlt,
  FaEye,
  FaEyeSlash,
  FaSpinner,
} from "react-icons/fa";

interface PasswordLoginProps {
  loginData: {
    email: string;
    password: string;
  };
  onInputChange: (data: { email: string; password: string }) => void;
  onSubmit: () => void;
}

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  enter: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: { duration: 0.2 },
  },
};

export default function PasswordLogin({
  loginData,
  onInputChange,
  onSubmit,
}: PasswordLoginProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await onSubmit();
    setIsLoading(false);
  };

  const handleInputChange = (field: string, value: string) => {
    onInputChange({
      ...loginData,
      [field]: value,
    });
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      className="min-h-screen py-8 px-4 flex items-center justify-center"
    >
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-[#3e5866]">
            Iniciar con Contraseña
          </h2>
          <p className="text-gray-600 mt-2">Ingrese sus credenciales para acceder</p>
        </div>
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correo Electrónico
              </label>
              <div className="relative flex items-center">
                <FaEnvelope className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={loginData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className="pl-10 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors border-gray-300 hover:border-gray-400"
                  placeholder="usuario@ejemplo.com"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <div className="relative flex items-center">
                <FaLock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={loginData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  className="pl-10 pr-10 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors border-gray-300 hover:border-gray-400"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <FaEyeSlash className="w-5 h-5" />
                  ) : (
                    <FaEye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={isLoading}
              className="bg-blue-600/90 text-white font-semibold rounded-2xl shadow-md hover:bg-blue-700 transition-all duration-200 px-8 py-4 flex items-center justify-center space-x-3 w-full disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-blue-200"
            >
              {isLoading ? (
                <>
                  <FaSpinner className="w-5 h-5 animate-spin" />
                  <span>Iniciando...</span>
                </>
              ) : (
                <>
                  <FaSignInAlt className="w-5 h-5" />
                  <span>Iniciar Sesión</span>
                </>
              )}
            </motion.button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}

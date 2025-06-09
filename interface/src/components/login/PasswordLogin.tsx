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
      className="min-h-screen flex items-center justify-center px-4 py-8"
    >
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div
            className="inline-flex p-4 rounded-full mb-4"
            style={{ backgroundColor: "#f7f9f2" }}
          >
            <FaLock className="w-8 h-8" style={{ color: "#95b54c" }} />
          </div>
          <h2 className="text-3xl font-bold" style={{ color: "#3e5866" }}>
            Iniciar con Contraseña
          </h2>
          <p className="text-gray-600 mt-2">
            Ingrese sus credenciales para acceder
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Correo Electrónico
            </label>
            <div className="relative">
              <FaEnvelope className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={loginData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
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
                type={showPassword ? "text" : "password"}
                value={loginData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                className="pl-10 pr-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-200 hover:shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2"
            style={{ backgroundColor: "#95b54c" }}
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
  );
}

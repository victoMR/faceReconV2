import { motion } from "framer-motion";
import { FaSignInAlt, FaCamera, FaLock } from "react-icons/fa";

interface LoginPageProps {
  onModeChange: (mode: string) => void;
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

export default function LoginPage({ onModeChange }: LoginPageProps) {
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
            style={{ backgroundColor: "#e8f5f3" }}
          >
            <FaSignInAlt className="w-8 h-8" style={{ color: "#3e5866" }} />
          </div>
          <h2 className="text-3xl font-bold" style={{ color: "#3e5866" }}>
            Iniciar Sesión
          </h2>
          <p className="text-gray-600 mt-2">
            Seleccione su método de autenticación preferido
          </p>
        </div>

        <div className="space-y-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onModeChange("login-facial")}
            className="w-full p-6 rounded-xl border-2 transition-all duration-200 hover:shadow-lg"
            style={{
              borderColor: "#54a8a0",
              backgroundColor: "#f0f8f7",
            }}
          >
            <div className="flex items-center space-x-4">
              <div
                className="p-3 rounded-xl"
                style={{ backgroundColor: "#54a8a0" }}
              >
                <FaCamera className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <h3
                  className="font-semibold text-lg"
                  style={{ color: "#3e5866" }}
                >
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
            onClick={() => onModeChange("login-password")}
            className="w-full p-6 rounded-xl border-2 transition-all duration-200 hover:shadow-lg"
            style={{
              borderColor: "#95b54c",
              backgroundColor: "#f7f9f2",
            }}
          >
            <div className="flex items-center space-x-4">
              <div
                className="p-3 rounded-xl"
                style={{ backgroundColor: "#95b54c" }}
              >
                <FaLock className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <h3
                  className="font-semibold text-lg"
                  style={{ color: "#3e5866" }}
                >
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
  );
}

import { motion } from "framer-motion";
import { FaSignInAlt, FaLock, FaUser } from "react-icons/fa";

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
          {/* Botones principales de selección de método de login */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onModeChange("login-password")}
            className="bg-white/80 border border-blue-200 text-blue-900 font-semibold rounded-2xl shadow-md hover:bg-blue-50 transition-all duration-200 px-8 py-5 flex items-center justify-center space-x-4 w-full mb-4 focus:outline-none focus:ring-4 focus:ring-blue-100"
          >
            <div className="p-3 rounded-xl bg-blue-100">
              <FaUser className="w-6 h-6 text-blue-700" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-lg">Login Tradicional</h3>
              <p className="text-gray-500 text-sm">
                Ingrese con usuario y contraseña
              </p>
            </div>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

import { motion } from "framer-motion";
import { FaShieldAlt } from "react-icons/fa";

interface HomePageProps {
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

export default function HomePage({ onModeChange }: HomePageProps) {
  return (
    <motion.div
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
          <div
            className="inline-flex p-6 rounded-full mb-6"
            style={{ backgroundColor: "#e8f5f3" }}
          >
            <FaShieldAlt className="w-16 h-16" style={{ color: "#3e5866" }} />
          </div>
          <h1 className="text-5xl font-bold mb-4" style={{ color: "#3e5866" }}>
            Bienvenido a SecureAuth
          </h1>
        </motion.div>

        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex flex-col sm:flex-row gap-6 justify-center"
        >
          {/* Botón Iniciar Sesión */}
          <button
            onClick={() => onModeChange("login")}
            className="backdrop-blur-md bg-white/30 border border-blue-200 shadow-2xl rounded-2xl px-10 py-6 flex items-center justify-center space-x-4 text-xl font-bold text-blue-900 hover:bg-white/60 hover:shadow-blue-200 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-200"
            style={{ minWidth: 220 }}
          >
            <span>Iniciar Sesión</span>
          </button>
          {/* Botón Registrarse */}
          <button
            onClick={() => onModeChange("register-form")}
            className="backdrop-blur-md bg-white/30 border border-teal-200 shadow-2xl rounded-2xl px-10 py-6 flex items-center justify-center space-x-4 text-xl font-bold text-teal-900 hover:bg-white/60 hover:shadow-teal-200 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-teal-200"
            style={{ minWidth: 220 }}
          >
            <span>Registrarse</span>
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}

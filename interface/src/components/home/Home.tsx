import { motion } from "framer-motion";
import { FaShieldAlt, FaSignInAlt, FaUser } from "react-icons/fa";

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
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <button
            onClick={() => onModeChange("login")}
            className="px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 hover:shadow-lg flex items-center justify-center space-x-3"
            style={{
              backgroundColor: "#54a8a0",
              color: "white",
            }}
          >
            <FaSignInAlt className="w-5 h-5" />
            <span>Iniciar Sesión</span>
          </button>

          <button
            onClick={() => onModeChange("register-form")}
            className="px-8 py-4 rounded-xl font-semibold text-lg border-2 transition-all duration-200 hover:shadow-lg flex items-center justify-center space-x-3"
            style={{
              borderColor: "#54a8a0",
              color: "#54a8a0",
              backgroundColor: "transparent",
            }}
          >
            <FaUser className="w-5 h-5" />
            <span>Registrarse</span>
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}

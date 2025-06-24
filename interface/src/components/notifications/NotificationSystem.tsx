import { AnimatePresence, motion } from "framer-motion";
import { FaCheckCircle, FaExclamationTriangle, FaTimes } from "react-icons/fa";

interface NotificationSystemProps {
  successMessage: string;
  errorMessage: string;
  onClearSuccess: () => void;
  onClearError: () => void;
}

interface NotificationProps {
  type: "success" | "error";
  message: string;
  onClose: () => void;
}

function Notification({ type, message, onClose }: NotificationProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, x: "100%" }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: -20, x: "100%" }}
      className={`fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-xl backdrop-blur-sm border max-w-sm ${
        type === "success"
          ? "bg-green-50 bg-opacity-95 border-green-200 text-green-800"
          : "bg-red-50 bg-opacity-95 border-red-200 text-red-800"
      }`}
    >
      <div className="flex items-start space-x-3">
        <div
          className={`p-1 rounded-lg ${
            type === "success" ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {type === "success" ? (
            <FaCheckCircle className="w-4 h-4 text-white" />
          ) : (
            <FaExclamationTriangle className="w-4 h-4 text-white" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium leading-5">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="bg-gradient-to-br from-red-600 to-red-400 text-white font-semibold rounded-xl shadow hover:from-red-700 hover:to-red-500 transition-all duration-200 p-2 ml-2 flex items-center justify-center"
        >
          <FaTimes className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
}

export default function NotificationSystem({
  successMessage,
  errorMessage,
  onClearSuccess,
  onClearError,
}: NotificationSystemProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end space-y-4">
      <AnimatePresence>
        {successMessage && (
          <Notification
            type="success"
            message={successMessage}
            onClose={onClearSuccess}
          />
        )}
        {errorMessage && (
          <Notification
            type="error"
            message={errorMessage}
            onClose={onClearError}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

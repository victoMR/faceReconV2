"use client";

// 1. Paleta de colores y clases utilitarias para botones globales
// Agrega esto al principio del archivo para definir clases globales de botones
// Puedes moverlo a index.css o crear un archivo Button.module.css si prefieres modularidad

/* Ejemplo de clases globales para botones principales, secundarios, de peligro, etc. */
// .btn-primary {
//   @apply bg-gradient-to-br from-blue-700 to-teal-500 text-white font-semibold rounded-xl shadow-lg hover:from-blue-800 hover:to-teal-600 transition-all duration-200 px-6 py-3 flex items-center justify-center space-x-2;
// }
// .btn-secondary {
//   @apply bg-gradient-to-br from-gray-200 to-gray-100 text-gray-800 font-semibold rounded-xl shadow hover:bg-gray-300 transition-all duration-200 px-6 py-3 flex items-center justify-center space-x-2;
// }
// .btn-danger {
//   @apply bg-gradient-to-br from-red-600 to-red-400 text-white font-semibold rounded-xl shadow hover:from-red-700 hover:to-red-500 transition-all duration-200 px-6 py-3 flex items-center justify-center space-x-2;
// }
// .btn-outline {
//   @apply border-2 border-blue-700 text-blue-700 bg-white font-semibold rounded-xl hover:bg-blue-50 transition-all duration-200 px-6 py-3 flex items-center justify-center space-x-2;
// }

// 2. Reemplaza los estilos inline y clases de botones en el formulario por estas clases
// Ejemplo para el botón principal de registro:
// <motion.button
//   className="btn-primary w-full"
//   ...
// >
//   ...
// </motion.button>

// 3. Aplica el mismo patrón en todos los botones de la app para unificar el estilo
// Puedes crear un componente Button.tsx reutilizable si lo deseas

// 4. Opcional: agrega un efecto sutil de sombra y animación de presión en todos los botones
//   whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}

// 5. Si usas Tailwind, puedes agregar las clases en index.css o como componentes utilitarios

import type React from "react";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  FaUser,
  FaEnvelope,
  FaLock,
  FaPhone,
  FaIdCard,
  FaEye,
  FaEyeSlash,
  FaSpinner,
  FaCamera,
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle,
} from "react-icons/fa";

interface RegistrationData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  idNumber: string;
}

interface RegistrationFormProps {
  registrationData: RegistrationData;
  onInputChange: (data: RegistrationData) => void;
  onSubmit: () => Promise<boolean>;
}

interface FormErrors {
  [key: string]: string;
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

export default function RegistrationForm({
  registrationData,
  onInputChange,
  onSubmit,
}: RegistrationFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});
  const firstInvalidRef = useRef<HTMLInputElement | null>(null);

  // Validar fortaleza de contraseña
  const getPasswordStrength = (password: string) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  // Validar formulario
  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!registrationData.firstName.trim()) {
      errors.firstName = "El nombre es requerido";
    }

    if (!registrationData.lastName.trim()) {
      errors.lastName = "El apellido es requerido";
    }

    if (!registrationData.email.trim()) {
      errors.email = "El correo electrónico es requerido";
    } else if (!/\S+@\S+\.\S+/.test(registrationData.email)) {
      errors.email = "El correo electrónico no es válido";
    }

    if (!registrationData.password) {
      errors.password = "La contraseña es requerida";
    } else if (registrationData.password.length < 6) {
      errors.password = "La contraseña debe tener al menos 6 caracteres";
    }

    if (registrationData.password !== registrationData.confirmPassword) {
      errors.confirmPassword = "Las contraseñas no coinciden";
    }

    if (!registrationData.phone.trim()) {
      errors.phone = "El teléfono es requerido";
    } else if (!/^\d{10}$/.test(registrationData.phone.replace(/\D/g, ""))) {
      errors.phone = "El teléfono debe tener 10 dígitos";
    }

    if (!registrationData.idNumber.trim()) {
      errors.idNumber = "La cédula es requerida";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Manejar cambios en los inputs
  const handleInputChange = (field: keyof RegistrationData, value: string) => {
    onInputChange({
      ...registrationData,
      [field]: value,
    });
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === "password") {
      setPasswordStrength(getPasswordStrength(value));
    }
    // Limpiar error específico cuando el usuario empieza a escribir
    if (formErrors[field]) {
      setFormErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setIsLoading(true);
      try {
        await onSubmit();
      } finally {
        setIsLoading(false);
      }
    } else {
      // Foco en el primer campo inválido
      setTimeout(() => {
        if (firstInvalidRef.current) {
          firstInvalidRef.current.focus();
        }
      }, 100);
    }
  };

  // Utilidad para iconos de validación
  const getValidationIcon = (field: keyof RegistrationData) => {
    if (!touched[field]) return null;
    if (formErrors[field]) {
      return <FaTimesCircle className="text-red-400 ml-2" />;
    }
    if (registrationData[field] && !formErrors[field]) {
      return <FaCheckCircle className="text-green-500 ml-2" />;
    }
    return null;
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      className="min-h-screen py-8 px-4"
    >
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div
            className="inline-flex p-4 rounded-full mb-4"
            style={{ backgroundColor: "#f0f8f7" }}
          >
            <FaUser className="w-8 h-8" style={{ color: "#54a8a0" }} />
          </div>
          <h2 className="text-3xl font-bold" style={{ color: "#3e5866" }}>
            Registro de Usuario
          </h2>
          <p className="text-gray-600 mt-2">
            Complete sus datos personales para crear su cuenta
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={registrationData.firstName}
                    onChange={(e) =>
                      handleInputChange("firstName", e.target.value)
                    }
                    onBlur={() => setTouched((prev) => ({ ...prev, firstName: true }))}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      formErrors.firstName
                        ? "border-red-500 bg-red-50"
                        : touched.firstName && registrationData.firstName && !formErrors.firstName
                        ? "border-green-400 bg-green-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                    placeholder="Juan"
                    ref={formErrors.firstName && !firstInvalidRef.current ? firstInvalidRef : undefined}
                  />
                  {getValidationIcon("firstName")}
                </div>
                {formErrors.firstName && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-500 text-sm mt-1 flex items-center"
                  >
                    {formErrors.firstName}
                  </motion.p>
                )}
              </div>

              {/* Apellido */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Apellido <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={registrationData.lastName}
                    onChange={(e) =>
                      handleInputChange("lastName", e.target.value)
                    }
                    onBlur={() => setTouched((prev) => ({ ...prev, lastName: true }))}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      formErrors.lastName
                        ? "border-red-500 bg-red-50"
                        : touched.lastName && registrationData.lastName && !formErrors.lastName
                        ? "border-green-400 bg-green-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                    placeholder="Pérez"
                    ref={formErrors.lastName && !firstInvalidRef.current ? firstInvalidRef : undefined}
                  />
                  {getValidationIcon("lastName")}
                </div>
                {formErrors.lastName && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-500 text-sm mt-1"
                  >
                    {formErrors.lastName}
                  </motion.p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correo Electrónico <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <FaEnvelope className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={registrationData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                  className={`pl-10 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    formErrors.email
                      ? "border-red-500 bg-red-50"
                      : touched.email && registrationData.email && !formErrors.email
                      ? "border-green-400 bg-green-50"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                  placeholder="juan.perez@ejemplo.com"
                  ref={formErrors.email && !firstInvalidRef.current ? firstInvalidRef : undefined}
                />
                {getValidationIcon("email")}
              </div>
              {formErrors.email && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-500 text-sm mt-1"
                >
                  {formErrors.email}
                </motion.p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contraseña */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña <span className="text-red-500">*</span>
                  <span className="ml-1" title="Debe tener al menos 8 caracteres, mayúsculas, minúsculas, números y símbolos.">
                    <FaInfoCircle className="inline text-blue-400" />
                  </span>
                </label>
                <div className="relative flex items-center">
                  <FaLock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={registrationData.password}
                    onChange={(e) =>
                      handleInputChange("password", e.target.value)
                    }
                    onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                    className={`pl-10 pr-10 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      formErrors.password
                        ? "border-red-500 bg-red-50"
                        : touched.password && registrationData.password && !formErrors.password
                        ? "border-green-400 bg-green-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                    placeholder="••••••••"
                    ref={formErrors.password && !firstInvalidRef.current ? firstInvalidRef : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-8 top-3 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <FaEyeSlash className="w-5 h-5" /> : <FaEye className="w-5 h-5" />}
                  </button>
                  {getValidationIcon("password")}
                </div>
                {/* Barra de fortaleza de contraseña */}
                <div className="h-2 mt-2 rounded bg-gray-200 overflow-hidden">
                  <div
                    className={`h-2 rounded transition-all duration-300 ${
                      passwordStrength <= 2
                        ? "bg-red-400 w-1/5"
                        : passwordStrength === 3
                        ? "bg-yellow-400 w-3/5"
                        : passwordStrength >= 4
                        ? "bg-green-500 w-full"
                        : ""
                    }`}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Fortaleza: {[
                    "Débil",
                    "Débil",
                    "Media",
                    "Fuerte",
                    "Muy fuerte",
                  ][passwordStrength]}
                </div>
                {formErrors.password && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-500 text-sm mt-1"
                  >
                    {formErrors.password}
                  </motion.p>
                )}
              </div>

              {/* Confirmar Contraseña */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmar Contraseña <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <FaLock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={registrationData.confirmPassword}
                    onChange={(e) =>
                      handleInputChange("confirmPassword", e.target.value)
                    }
                    onBlur={() => setTouched((prev) => ({ ...prev, confirmPassword: true }))}
                    className={`pl-10 pr-10 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      formErrors.confirmPassword
                        ? "border-red-500 bg-red-50"
                        : touched.confirmPassword && registrationData.confirmPassword && !formErrors.confirmPassword
                        ? "border-green-400 bg-green-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                    placeholder="••••••••"
                    ref={formErrors.confirmPassword && !firstInvalidRef.current ? firstInvalidRef : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showConfirmPassword ? (
                      <FaEyeSlash className="w-5 h-5" />
                    ) : (
                      <FaEye className="w-5 h-5" />
                    )}
                  </button>
                  {getValidationIcon("confirmPassword")}
                </div>
                {formErrors.confirmPassword && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-500 text-sm mt-1"
                  >
                    {formErrors.confirmPassword}
                  </motion.p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Teléfono */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <FaPhone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    value={registrationData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
                    className={`pl-10 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      formErrors.phone
                        ? "border-red-500 bg-red-50"
                        : touched.phone && registrationData.phone && !formErrors.phone
                        ? "border-green-400 bg-green-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                    placeholder="3001234567"
                    ref={formErrors.phone && !firstInvalidRef.current ? firstInvalidRef : undefined}
                  />
                  {getValidationIcon("phone")}
                </div>
                {formErrors.phone && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-500 text-sm mt-1"
                  >
                    {formErrors.phone}
                  </motion.p>
                )}
              </div>

              {/* Cédula */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Identificación{" "}
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <FaIdCard className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={registrationData.idNumber}
                    onChange={(e) =>
                      handleInputChange("idNumber", e.target.value)
                    }
                    onBlur={() => setTouched((prev) => ({ ...prev, idNumber: true }))}
                    className={`pl-10 w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      formErrors.idNumber
                        ? "border-red-500 bg-red-50"
                        : touched.idNumber && registrationData.idNumber && !formErrors.idNumber
                        ? "border-green-400 bg-green-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                    placeholder="12345678"
                    ref={formErrors.idNumber && !firstInvalidRef.current ? firstInvalidRef : undefined}
                  />
                  {getValidationIcon("idNumber")}
                </div>
                {formErrors.idNumber && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-500 text-sm mt-1"
                  >
                    {formErrors.idNumber}
                  </motion.p>
                )}
              </div>
            </div>

            {/* Información adicional */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <FaCamera className="w-5 h-5 text-blue-600 mt-0.5" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-blue-900">
                    Siguiente paso: Registro Biométrico
                  </h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Después de completar este formulario, procederemos con el
                    registro de su huella biométrica facial para mayor
                    seguridad.
                  </p>
                </div>
              </div>
            </div>

            {/* Botón de envío */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              {/* Botón principal de registro (profesional y consistente) */}
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
                    <span>Registrando...</span>
                  </>
                ) : (
                  <>
                    <FaCamera className="w-5 h-5" />
                    <span>Continuar al Registro Biométrico</span>
                  </>
                )}
              </motion.button>
            </div>

            {/* Términos y condiciones */}
            <div className="text-center pt-4">
              <p className="text-sm text-gray-500">
                Al registrarse, acepta nuestros{" "}
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Términos y Condiciones
                </button>{" "}
                y{" "}
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Política de Privacidad
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
}

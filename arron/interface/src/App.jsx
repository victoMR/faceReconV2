import { useState, useRef, useEffect } from "react";
import { FaCamera, FaSignInAlt, FaUser } from "react-icons/fa";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { MdError } from "react-icons/md";

export default function App() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognitionError, setRecognitionError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = async () => {
    try {
      setRecognitionError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsCameraActive(true);
    } catch (error) {
      console.error("Error accessing camera:", error);
      setRecognitionError(
        "No se pudo acceder a la cámara. Por favor, verifica los permisos."
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraActive(false);
  };

  const handleRecognition = () => {
    setIsRecognizing(true);
    setRecognitionError(null);

    setTimeout(() => {
      setIsRecognizing(false);
      setRecognitionError(
        "No se pudo identificar al usuario. Por favor, inténtelo de nuevo."
      );
    }, 3000);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-green-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white border border-green-200 shadow-lg rounded-lg overflow-hidden">
          {/* Header */}
          <div className="bg-green-700 text-white px-6 py-4">
            <h1 className="text-center text-2xl font-semibold">Login</h1>
            <p className="text-green-100 text-center text-sm mt-1">
              Sistema de gestión para dispositivos IoT
            </p>
          </div>

          {/* Content */}
          <div className="pt-6 pb-4 px-6">
            {recognitionError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start">
                  <MdError className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-red-800">
                      Error de reconocimiento
                    </h3>
                    <p className="text-sm text-red-700 mt-1">
                      {recognitionError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col items-center space-y-4">
              {isCameraActive ? (
                <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border-4 border-green-600">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />

                  {isRecognizing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="flex flex-col items-center space-y-2">
                        <AiOutlineLoading3Quarters className="h-8 w-8 text-white animate-spin" />
                        <p className="text-white font-medium">
                          Reconociendo...
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full aspect-video bg-green-50 rounded-lg border-2 border-dashed border-green-300 flex items-center justify-center">
                  <div className="flex flex-col items-center space-y-2 text-green-700">
                    <FaUser className="h-12 w-12" />
                    <p className="text-sm font-medium">
                      Inicie la cámara para comenzar
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6">
            <div className="flex flex-col space-y-3">
              {isCameraActive ? (
                <div className="flex w-full space-x-3">
                  <button
                    className="flex-1 px-4 py-2 border border-green-600 text-green-700 bg-white hover:bg-green-50 rounded-md font-medium transition-colors duration-200"
                    onClick={stopCamera}
                  >
                    Cancelar
                  </button>
                  <button
                    className="flex-1 px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-md font-medium transition-colors duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleRecognition}
                    disabled={isRecognizing}
                  >
                    {isRecognizing ? (
                      <>
                        <AiOutlineLoading3Quarters className="mr-2 h-4 w-4 animate-spin" />
                        Procesando
                      </>
                    ) : (
                      <>
                        <FaSignInAlt className="mr-2 h-4 w-4" />
                        Identificar
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  className="w-full px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-md font-medium transition-colors duration-200 flex items-center justify-center"
                  onClick={startCamera}
                >
                  <FaCamera className="mr-2 h-4 w-4" />
                  Iniciar cámara
                </button>
              )}

              <p className="text-xs text-center text-gray-600">
                Este sistema utiliza reconocimiento facial para autenticar
                usuarios autorizados.
                <br />
                Si tiene problemas, contacte al administrador del sistema.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

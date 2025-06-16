import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MediaPipeService from "../../services/MediaPipeService";
import FaceEmbeddingService from "../../services/FaceEmbeddingService";
import ApiService from "../../services/ApiService";
import { FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import {
  FaCamera,
  FaCheck,
  FaExclamationTriangle,
  FaUser,
  FaEye,
  FaSyncAlt,
  FaSmile,
  FaEyeSlash,
  FaArrowDown,
  FaArrowUp,
} from "react-icons/fa";

// Estados posibles durante el proceso de enrollment
type EnrollmentStatus =
  | "inicializando"
  | "solicitando_camara"
  | "detectando_rostro"
  | "esperando_captura_normal"
  | "esperando_sonrisa_automatica"
  | "esperando_asentir_automatico"
  | "esperando_subir_cabeza_automatico"
  | "procesando_imagenes"
  | "enviando_datos"
  | "registro_exitoso"
  | "error_registro";

// Tipos de captura específicos
type CaptureType = "normal" | "sonrisa" | "asentir" | "subir_cabeza";

interface CapturedImage {
  type: CaptureType;
  embedding: number[];
  imageData: string;
  timestamp: string;
}

interface FacialEnrollmentProps {
  userData?: any;
  userToken: string;
  onEnrollmentComplete: (success: boolean, userToken?: string) => void;
}

const FacialEnrollment: React.FC<FacialEnrollmentProps> = ({
  userData,
  userToken,
  onEnrollmentComplete,
}) => {
  // Referencias
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

  // Estados
  const [status, setStatus] = useState<EnrollmentStatus>("inicializando");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const [faceQuality, setFaceQuality] = useState<"low" | "medium" | "high">(
    "low"
  );
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [currentCaptureType, setCurrentCaptureType] =
    useState<CaptureType>("normal");
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [showMesh, setShowMesh] = useState<boolean>(false);
  const [challengeProgress, setChallengeProgress] = useState<number>(0);
  const [stabilizationProgress, setStabilizationProgress] = useState<number>(0);

  // Contadores
  const stableFrameCounter = useRef<number>(0);
  const challengeCounter = useRef<number>(0);
  const blinkHistory = useRef<boolean[]>([]);

  // Historial para detección de asentimiento (como en FacialLogin)
  const nosePositionHistory = useRef<number[]>([]);

  // Control para captura post-asentimiento
  const postNodCaptureCounter = useRef<number>(0);
  const shouldCaptureAfterNod = useRef<boolean>(false);

  // Control de bucle de detección
  const isRunning = useRef<boolean>(false);
  const frameCount = useRef<number>(0);
  const lastFrameTime = useRef<number>(0);
  const currentStatusRef = useRef<EnrollmentStatus>("inicializando");

  // Flag para evitar múltiples capturas simultáneas
  const captureInProgress = useRef<Set<CaptureType>>(new Set());

  // REF PARA CONTROL INMEDIATO DE IMÁGENES (para evitar problemas de estado desactualizado)
  const capturedImagesRef = useRef<CapturedImage[]>([]);

  // Actualizar la ref cuando cambie el estado
  useEffect(() => {
    currentStatusRef.current = status;
  }, [status]);

  // Sincronizar ref de imágenes con el estado
  useEffect(() => {
    capturedImagesRef.current = capturedImages;
  }, [capturedImages]);

  // Inicializar servicios y solicitar acceso a la cámara
  useEffect(() => {
    const initializeServices = async () => {
      try {
        console.log(
          "[FacialEnrollment] Iniciando inicialización de servicios..."
        );
        setStatus("inicializando");

        // Inicializar MediaPipe
        const mediaPipeService = MediaPipeService.getInstance();
        if (!mediaPipeService.isInitialized()) {
          console.log("[FacialEnrollment] Inicializando MediaPipe...");
          await mediaPipeService.initialize();
        }

        // Inicializar FaceEmbeddingService
        const embeddingService = FaceEmbeddingService.getInstance();
        if (!embeddingService.isInitialized()) {
          console.log(
            "[FacialEnrollment] Inicializando FaceEmbeddingService..."
          );
          await embeddingService.initialize();
        }

        // Solicitar acceso a la cámara
        await startCamera();
      } catch (error) {
        console.error(
          "[FacialEnrollment] Error durante la inicialización:",
          error
        );
        setStatus("error_registro");
        setErrorMessage(
          "No se pudo inicializar el sistema de reconocimiento facial. Verifique su conexión a internet y que su navegador soporte WebRTC."
        );
      }
    };

    initializeServices();

    // Limpieza al desmontar el componente
    return () => {
      console.log("[FacialEnrollment] Limpiando recursos...");
      isRunning.current = false;
      stopCamera();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, []);

  // Iniciar la cámara con mejor manejo de errores
  const startCamera = async () => {
    try {
      setStatus("solicitando_camara");
      console.log("[FacialEnrollment] Solicitando acceso a la cámara...");

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Tu navegador no soporta acceso a la cámara");
      }

      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        console.log(
          "[FacialEnrollment] Cámara obtenida con restricciones básicas"
        );
      } catch (basicError) {
        console.warn(
          "[FacialEnrollment] Restricciones básicas fallaron, intentando mínimas:",
          basicError
        );

        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current
              .play()
              .then(() => {
                console.log("[FacialEnrollment] Video iniciado correctamente");
                setStatus("detectando_rostro");
                startFaceDetection();
              })
              .catch((error) => {
                console.error(
                  "[FacialEnrollment] Error reproduciendo video:",
                  error
                );
                setStatus("error_registro");
                setErrorMessage(
                  "No se pudo iniciar la reproducción del video. Verifique los permisos de su navegador."
                );
              });
          }
        };

        videoRef.current.onerror = (error) => {
          console.error(
            "[FacialEnrollment] Error en el elemento video:",
            error
          );
          setStatus("error_registro");
          setErrorMessage("Error al cargar el video de la cámara.");
        };
      }
    } catch (error) {
      console.error("[FacialEnrollment] Error accediendo a la cámara:", error);
      setStatus("error_registro");

      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          setErrorMessage(
            "Acceso a la cámara denegado. Por favor, permita el acceso a la cámara y recargue la página."
          );
        } else if (error.name === "NotFoundError") {
          setErrorMessage(
            "No se encontró ninguna cámara. Verifique que tiene una cámara conectada."
          );
        } else if (error.name === "NotReadableError") {
          setErrorMessage(
            "La cámara está siendo utilizada por otra aplicación. Cierre otras aplicaciones que puedan estar usando la cámara."
          );
        } else {
          setErrorMessage(`Error accediendo a la cámara: ${error.message}`);
        }
      } else {
        setErrorMessage("Error desconocido accediendo a la cámara.");
      }
    }
  };

  // Detener la cámara
  const stopCamera = () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        console.log("[FacialEnrollment] Cámara detenida");
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    } catch (error) {
      console.error("[FacialEnrollment] Error deteniendo cámara:", error);
    }
  };

  // DIBUJAR LANDMARKS SOBRE EL CANVAS
  function drawLandmarksOnCanvas(result: FaceLandmarkerResult | null, video: HTMLVideoElement, canvas: HTMLCanvasElement) {
    if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Dibujar frame de video
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Configuración de puntos y líneas
    ctx.strokeStyle = '#00e0ff';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#00e0ff';
    const landmarks = result.faceLandmarks[0];
    // Dibujar puntos
    for (const pt of landmarks) {
      ctx.beginPath();
      ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 2, 0, 2 * Math.PI);
      ctx.fill();
    }
    // Opcional: dibujar líneas entre landmarks clave (ejemplo: contorno)
    // ...
  }

  // Iniciar la detección facial continua
  const startFaceDetection = () => {
    if (isRunning.current) {
      console.warn("[FacialEnrollment] La detección ya está en marcha");
      return;
    }

    console.log("[FacialEnrollment] Iniciando detección facial...");
    isRunning.current = true;
    frameCount.current = 0;
    lastFrameTime.current = performance.now();

    const mediaPipeService = MediaPipeService.getInstance();

    const detectFace = (timestamp: number) => {
      if (!isRunning.current) {
        return;
      }

      frameCount.current++;

      // Limitar FPS a 15 para reducir carga
      if (timestamp - lastFrameTime.current < 66.67) {
        animationRef.current = requestAnimationFrame(detectFace);
        return;
      }
      lastFrameTime.current = timestamp;

      if (!videoRef.current || !mediaPipeService.isInitialized()) {
        animationRef.current = requestAnimationFrame(detectFace);
        return;
      }

      if (videoRef.current.readyState < 2) {
        animationRef.current = requestAnimationFrame(detectFace);
        return;
      }

      try {
        const result = mediaPipeService.detectFaceInVideo(
          videoRef.current,
          timestamp
        );
        const isFaceDetected = mediaPipeService.hasFaceDetected(result);
        setFaceDetected(isFaceDetected);

        if (isFaceDetected && result) {
          evaluateFaceQuality(result);
          const currentQuality = evaluateFaceQualitySync(result);
          processCurrentState(currentQuality);
          processAutomaticChallenges(result);
        } else {
          stableFrameCounter.current = 0;
          challengeCounter.current = 0;
          setChallengeProgress(0);
        }

        // DIBUJAR LANDMARKS EN TIEMPO REAL
        if (overlayCanvasRef.current && videoRef.current) {
          overlayCanvasRef.current.width = videoRef.current.videoWidth;
          overlayCanvasRef.current.height = videoRef.current.videoHeight;
          drawLandmarksOnCanvas(result, videoRef.current, overlayCanvasRef.current);
        }
      } catch (error) {
        console.error("[FacialEnrollment] Error en detección facial:", error);
      }

      if (isRunning.current) {
        animationRef.current = requestAnimationFrame(detectFace);
      }
    };

    animationRef.current = requestAnimationFrame(detectFace);
  };

  // Procesar el estado actual
  const processCurrentState = (currentQuality: "low" | "medium" | "high") => {
    try {
      switch (currentStatusRef.current) {
        case "detectando_rostro":
          // Log menos frecuente para no saturar consola
          if (frameCount.current % 30 === 0) {
            console.log(
              `[FacialEnrollment] Estado: ${currentStatusRef.current}, Calidad: ${currentQuality}, Contador: ${stableFrameCounter.current}`
            );
          }
          if (currentQuality === "high") {
            stableFrameCounter.current++;
            setStabilizationProgress(stableFrameCounter.current);
            console.log(
              `[FacialEnrollment] ✓ Calidad HIGH - Incrementando contador a ${stableFrameCounter.current}/5`
            );
            if (stableFrameCounter.current >= 5) {
              // Temporalmente reducido a 5 para debug
              console.log(
                "[FacialEnrollment] Rostro estable detectado, listo para capturas"
              );
              setStatus("esperando_captura_normal");
              setCurrentCaptureType("normal");
              stableFrameCounter.current = 0;
              setStabilizationProgress(0);
            } else {
              // Debug: mostrar progreso cada 5 frames
              if (stableFrameCounter.current % 5 === 0) {
                console.log(
                  `[FacialEnrollment] Frames estables: ${stableFrameCounter.current}/5`
                );
              }
            }
          } else {
            if (stableFrameCounter.current > 0) {
              console.log(
                `[FacialEnrollment] ✗ Calidad bajó a ${currentQuality}, reiniciando contador desde ${stableFrameCounter.current}`
              );
            }
            stableFrameCounter.current = 0;
            setStabilizationProgress(0);
          }
          break;
      }
    } catch (error) {
      console.error("[FacialEnrollment] Error procesando estado:", error);
    }
  };

  // Procesar detección automática de desafíos
  const processAutomaticChallenges = (result: FaceLandmarkerResult) => {
    const mediaPipeService = MediaPipeService.getInstance();

    // 🚨 VERIFICACIÓN CRÍTICA: SI YA TENEMOS 4 CAPTURAS, NO PROCESAR MÁS
    if (capturedImagesRef.current.length >= 4) {
      console.log(
        `[FacialEnrollment] 🛑 YA TENEMOS ${capturedImagesRef.current.length}/4 CAPTURAS - DETENIENDO PROCESAMIENTO`
      );
      // DETENER TODO INMEDIATAMENTE
      isRunning.current = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      setStatus("procesando_imagenes");
      return;
    }

    try {
      switch (currentStatusRef.current) {
        case "esperando_sonrisa_automatica":
          // Verificar si ya tenemos una imagen de sonrisa
          const existingSonrisaImage = capturedImages.find(
            (img) => img.type === "sonrisa"
          );
          if (existingSonrisaImage || isCapturing) {
            return; // Ya capturada o en proceso de captura
          }

          if (mediaPipeService.isSmiling(result)) {
            challengeCounter.current++;
            setChallengeProgress(
              Math.min((challengeCounter.current / 15) * 100, 100)
            );

            if (challengeCounter.current >= 15) {
              console.log(
                "[FacialEnrollment] Sonrisa detectada, capturando imagen..."
              );
              automaticCapture("sonrisa");
            }
          } else {
            if (challengeCounter.current > 0) {
              challengeCounter.current = Math.max(
                0,
                challengeCounter.current - 1
              );
              setChallengeProgress(
                Math.min((challengeCounter.current / 15) * 100, 100)
              );
            }
          }
          break;

        case "esperando_asentir_automatico":
          // Verificar si ya tenemos una imagen de asentir
          const existingAsentirImage = capturedImages.find(
            (img) => img.type === "asentir"
          );
          if (existingAsentirImage || isCapturing) {
            return; // Ya capturada o en proceso de captura
          }

          // Lógica de detección de asentimiento mejorada
          if (result.faceLandmarks && result.faceLandmarks.length > 0) {
            const landmarks = result.faceLandmarks[0];
            if (landmarks && landmarks.length > 1) {
              const noseY = landmarks[1]?.y;
              if (typeof noseY === "number") {
                nosePositionHistory.current.push(noseY);

                if (nosePositionHistory.current.length > 15) {
                  nosePositionHistory.current.shift();
                }

                // Si aún no hemos completado el asentimiento
                if (!shouldCaptureAfterNod.current) {
                  if (
                    mediaPipeService.isNodding(
                      result,
                      nosePositionHistory.current
                    )
                  ) {
                    challengeCounter.current++;
                    setChallengeProgress(
                      Math.min((challengeCounter.current / 8) * 100, 100)
                    );

                    if (challengeCounter.current >= 8) {
                      console.log(
                        "[FacialEnrollment] ✅ Asentimiento completado, esperando estabilización..."
                      );
                      shouldCaptureAfterNod.current = true;
                      postNodCaptureCounter.current = 0;
                      setChallengeProgress(100);
                    }
                  }
                } else {
                  // Ya completamos el asentimiento, esperamos estabilización
                  postNodCaptureCounter.current++;

                  // Esperar 10 frames (~0.7s) para que se estabilice
                  if (postNodCaptureCounter.current >= 10) {
                    console.log(
                      "[FacialEnrollment] 🎯 Cabeza estabilizada, capturando imagen..."
                    );
                    shouldCaptureAfterNod.current = false; // Reset
                    postNodCaptureCounter.current = 0;
                    automaticCapture("asentir");
                  }
                }
              }
            }
          }
          break;

        case "esperando_subir_cabeza_automatico":
          // Verificar si ya tenemos una imagen de subir cabeza
          const existingSubirCabezaImage = capturedImages.find(
            (img) => img.type === "subir_cabeza"
          );
          if (existingSubirCabezaImage || isCapturing) {
            return; // Ya capturada o en proceso de captura
          }

          // Lógica de detección de subir cabeza (similar a asentimiento pero detectando movimiento hacia arriba)
          if (result.faceLandmarks && result.faceLandmarks.length > 0) {
            const landmarks = result.faceLandmarks[0];
            if (landmarks && landmarks.length > 1) {
              const noseY = landmarks[1]?.y;
              if (typeof noseY === "number") {
                nosePositionHistory.current.push(noseY);

                if (nosePositionHistory.current.length > 15) {
                  nosePositionHistory.current.shift();
                }

                // Si aún no hemos completado el movimiento hacia arriba
                if (!shouldCaptureAfterNod.current) {
                  // Detectar si la cabeza se ha movido significativamente hacia arriba
                  if (nosePositionHistory.current.length >= 10) {
                    const recentPositions =
                      nosePositionHistory.current.slice(-10);
                    const firstPosition = recentPositions[0];
                    const lastPosition =
                      recentPositions[recentPositions.length - 1];

                    // Si la cabeza se movió hacia arriba (nose Y decreased) por al menos 0.05
                    if (firstPosition - lastPosition > 0.05) {
                      challengeCounter.current++;
                      setChallengeProgress(
                        Math.min((challengeCounter.current / 8) * 100, 100)
                      );

                      if (challengeCounter.current >= 8) {
                        console.log(
                          "[FacialEnrollment] ✅ Movimiento de cabeza hacia arriba completado, esperando estabilización..."
                        );
                        shouldCaptureAfterNod.current = true;
                        postNodCaptureCounter.current = 0;
                        setChallengeProgress(100);
                      }
                    }
                  }
                } else {
                  // Ya completamos el movimiento, esperamos estabilización
                  postNodCaptureCounter.current++;

                  // Esperar 10 frames (~0.7s) para que se estabilice
                  if (postNodCaptureCounter.current >= 10) {
                    console.log(
                      "[FacialEnrollment] 🎯 Cabeza estabilizada después del movimiento, capturando imagen..."
                    );
                    shouldCaptureAfterNod.current = false; // Reset
                    postNodCaptureCounter.current = 0;
                    automaticCapture("subir_cabeza");
                  }
                }
              }
            }
          }
          break;
      }
    } catch (error) {
      console.error(
        "[FacialEnrollment] Error procesando desafíos automáticos:",
        error
      );
    }
  };

  // Evaluar la calidad del rostro detectado (versión síncrona)
  const evaluateFaceQualitySync = (
    result: FaceLandmarkerResult | null
  ): "low" | "medium" | "high" => {
    if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
      return "low";
    }

    try {
      const landmarks = result.faceLandmarks[0];

      if (!landmarks || landmarks.length < 455) {
        return "low";
      }

      const faceWidth = Math.abs(landmarks[454]?.x - landmarks[234]?.x) || 0;
      const faceHeight = Math.abs(landmarks[10]?.y - landmarks[152]?.y) || 0;
      const noseX = landmarks[1]?.x || 0.5;
      const isCentered = noseX > 0.3 && noseX < 0.7;

      if (faceWidth > 0.18 && faceHeight > 0.18 && isCentered) {
        return "high";
      } else if (faceWidth > 0.1 && faceHeight > 0.1) {
        return "medium";
      } else {
        return "low";
      }
    } catch (error) {
      console.error(
        "[FacialEnrollment] Error evaluando calidad facial sync:",
        error
      );
      return "low";
    }
  };

  // Evaluar la calidad del rostro detectado
  const evaluateFaceQuality = (result: FaceLandmarkerResult | null) => {
    if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
      setFaceQuality("low");
      return;
    }

    try {
      const landmarks = result.faceLandmarks[0];

      if (!landmarks || landmarks.length < 455) {
        setFaceQuality("low");
        return;
      }

      const faceWidth = Math.abs(landmarks[454]?.x - landmarks[234]?.x) || 0;
      const faceHeight = Math.abs(landmarks[10]?.y - landmarks[152]?.y) || 0;
      const noseX = landmarks[1]?.x || 0.5;
      const isCentered = noseX > 0.3 && noseX < 0.7; // Más permisivo que 0.35-0.65

      // Log de debug cada 60 frames
      if (frameCount.current % 60 === 0) {
        console.log(
          `[FacialEnrollment] Calidad - Width: ${faceWidth.toFixed(
            3
          )}, Height: ${faceHeight.toFixed(3)}, Nose: ${noseX.toFixed(
            3
          )}, Centered: ${isCentered}`
        );
      }

      let newQuality: "low" | "medium" | "high";
      if (faceWidth > 0.18 && faceHeight > 0.18 && isCentered) {
        // Reducido de 0.2 a 0.18
        newQuality = "high";
      } else if (faceWidth > 0.1 && faceHeight > 0.1) {
        newQuality = "medium";
      } else {
        newQuality = "low";
      }

      // Log cuando cambie la calidad
      if (newQuality !== faceQuality) {
        console.log(
          `[FacialEnrollment] Calidad cambió de ${faceQuality} a ${newQuality}`
        );
      }

      setFaceQuality(newQuality);
    } catch (error) {
      console.error(
        "[FacialEnrollment] Error evaluando calidad facial:",
        error
      );
      setFaceQuality("low");
    }
  };

  // --- NUEVO: función para comparar embeddings y evitar duplicados ---
  function areEmbeddingsSimilar(emb1: number[], emb2: number[], threshold = 0.85) {
    if (!emb1 || !emb2 || emb1.length !== emb2.length) return false;
    // Distancia euclidiana normalizada
    const dist = Math.sqrt(emb1.reduce((sum, v, i) => sum + Math.pow(v - emb2[i], 2), 0));
    // Normalizar a [0,1] (embedding de 128 dims)
    const similarity = 1 - dist / Math.sqrt(2 * emb1.length);
    return similarity > threshold;
  }

  // Capturar imagen específica (manual para normal)
  const captureImage = async (type: CaptureType) => {
    if (isCapturing || !videoRef.current || faceQuality !== "high") {
      setErrorMessage("La calidad del rostro no es suficiente. Mejore la iluminación y posición.");
      return;
    }
    setIsCapturing(true);
    setErrorMessage("");
    try {
      const embeddingService = FaceEmbeddingService.getInstance();
      const canvas = embeddingService.captureVideoFrame(videoRef.current);
      const embedding = await embeddingService.generateFaceEmbedding(canvas);
      if (!embedding) {
        throw new Error(`No se pudo generar el embedding para la imagen ${type}`);
      }
      // Validar calidad del embedding
      const validation = embeddingService.validateEmbeddingQuality(embedding);
      if (!validation.isValid || validation.qualityScore < 0.7) {
        setErrorMessage("La calidad del embedding es baja. Mejore la iluminación, mire de frente y evite obstrucciones.");
        setIsCapturing(false);
        return;
      }
      // Evitar duplicados: comparar con capturas previas
      for (const img of capturedImages) {
        if (areEmbeddingsSimilar(img.embedding, embedding, 0.92)) {
          setErrorMessage("La captura es muy similar a una anterior. Cambie de expresión o pose.");
          setIsCapturing(false);
          return;
        }
      }
      // Crear imagen con landmarks
      let imageData = "";
      if (overlayCanvasRef.current && videoRef.current) {
        // Dibujar landmarks sobre el frame actual
        const result = MediaPipeService.getInstance().detectFaceInVideo(videoRef.current, performance.now());
        drawLandmarksOnCanvas(result, videoRef.current, overlayCanvasRef.current);
        imageData = overlayCanvasRef.current.toDataURL("image/jpeg", 0.8);
      } else {
        imageData = canvas.toDataURL("image/jpeg", 0.8);
      }
      const capturedImage: CapturedImage = {
        type,
        embedding,
        imageData,
        timestamp: new Date().toISOString(),
      };
      setCapturedImages((prev) => [...prev, capturedImage]);
      console.log(`[FacialEnrollment] Imagen ${type} capturada exitosamente`);

      // Determinar siguiente estado
      if (type === "normal") {
        setStatus("esperando_sonrisa_automatica");
        setCurrentCaptureType("sonrisa");
        challengeCounter.current = 0;
        setChallengeProgress(0);
      } else if (type === "sonrisa") {
        setStatus("esperando_asentir_automatico");
        setCurrentCaptureType("asentir");
        challengeCounter.current = 0;
        setChallengeProgress(0);
        nosePositionHistory.current = []; // Limpiar historial de nariz
        shouldCaptureAfterNod.current = false; // Reset control post-asentimiento
        postNodCaptureCounter.current = 0;
      } else if (type === "asentir") {
        setStatus("esperando_subir_cabeza_automatico");
        setCurrentCaptureType("subir_cabeza");
        challengeCounter.current = 0;
        setChallengeProgress(0);
        nosePositionHistory.current = []; // Limpiar historial de nariz
        shouldCaptureAfterNod.current = false; // Reset control post-movimiento
        postNodCaptureCounter.current = 0;
      } else if (type === "subir_cabeza") {
        // Todas las 4 capturas completadas
        await sendEnrollmentData([...capturedImages, capturedImage]);
      }
    } catch (error) {
      setErrorMessage(`Error al capturar la imagen: ${error.message}`);
    } finally {
      setIsCapturing(false);
    }
  };

  // Captura automática para desafíos
  const automaticCapture = async (type: CaptureType) => {
    if (isCapturing || !videoRef.current) return;
    setIsCapturing(true);
    setErrorMessage("");
    try {
      const embeddingService = FaceEmbeddingService.getInstance();
      const canvas = embeddingService.captureVideoFrame(videoRef.current!);
      const embedding = await embeddingService.generateFaceEmbedding(canvas);
      if (!embedding) throw new Error(`No se pudo generar el embedding para la imagen ${type}`);
      // Validar calidad del embedding
      const validation = embeddingService.validateEmbeddingQuality(embedding);
      if (!validation.isValid || validation.qualityScore < 0.7) {
        setErrorMessage("La calidad del embedding es baja. Mejore la iluminación, mire de frente y evite obstrucciones.");
        setIsCapturing(false);
        return;
      }
      // Evitar duplicados
      for (const img of capturedImages) {
        if (areEmbeddingsSimilar(img.embedding, embedding, 0.92)) {
          setErrorMessage("La captura es muy similar a una anterior. Cambie de expresión o pose.");
          setIsCapturing(false);
          return;
        }
      }
      // Crear imagen con landmarks
      let imageData = "";
      if (overlayCanvasRef.current && videoRef.current) {
        const result = MediaPipeService.getInstance().detectFaceInVideo(videoRef.current, performance.now());
        drawLandmarksOnCanvas(result, videoRef.current, overlayCanvasRef.current);
        imageData = overlayCanvasRef.current.toDataURL("image/jpeg", 0.8);
      } else {
        imageData = canvas.toDataURL("image/jpeg", 0.8);
      }
      const capturedImage: CapturedImage = {
        type,
        embedding,
        imageData,
        timestamp: new Date().toISOString(),
      };
      setCapturedImages((prevImages) => {
        const updatedImages = [...prevImages, capturedImage];
        capturedImagesRef.current = updatedImages;
        return updatedImages;
      });
      // Determinar siguiente estado automáticamente
      setTimeout(() => {
        if (type === "sonrisa" && capturedImages.length === 2) {
          setStatus("esperando_asentir_automatico");
          setCurrentCaptureType("asentir");
        } else if (type === "asentir" && capturedImages.length === 3) {
          setStatus("esperando_subir_cabeza_automatico");
          setCurrentCaptureType("subir_cabeza");
        } else if (type === "subir_cabeza" && capturedImages.length === 4) {
          setStatus("procesando_imagenes");
          // DETENER TODA DETECCIÓN INMEDIATAMENTE
          isRunning.current = false;
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
          }
          // Pequeña pausa para mostrar el estado de procesamiento
          setTimeout(async () => {
            await sendEnrollmentData(capturedImages);
          }, 1000);
        }
      }, 50); // Reducido a 50ms para mayor velocidad
    } catch (error) {
      setErrorMessage(`Error al capturar la imagen: ${error.message}`);
    } finally {
      setIsCapturing(false);
      captureInProgress.current.delete(type);
    }
  };

  // Enviar datos de enrollment al backend
  const sendEnrollmentData = async (images: CapturedImage[]) => {
    try {
      console.log("[FacialEnrollment] Enviando datos al servidor...");
      setStatus("enviando_datos");

      // Detener el bucle de detección
      isRunning.current = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      // Preparar embeddings en el formato que espera el backend
      const embeddings = images.map((img) => ({
        data: img.embedding, // El array de números del embedding
        type: img.type, // Tipo de captura (normal, sonrisa, asentir, subir_cabeza)
        quality: 0.9, // Calidad fija alta ya que solo capturamos con calidad alta
      }));

      console.log(
        `[FacialEnrollment] 📤 Enviando ${embeddings.length} embeddings estructurados al backend`
      );

      // Log de verificación del formato
      embeddings.forEach((emb, idx) => {
        console.log(
          `[FacialEnrollment] Embedding ${idx + 1}: tipo="${
            emb.type
          }", data_length=${emb.data.length}, quality=${emb.quality}`
        );
      });

      // Preparar datos del usuario
      const enrollmentData = {
        userToken,
        userData,
        faceEmbeddings: embeddings,
        captureDetails: images.map((img) => ({
          type: img.type,
          timestamp: img.timestamp,
        })),
      };

      const result = await ApiService.enrollFace(userToken, embeddings);

      if (result.success) {
        console.log("[FacialEnrollment] Registro exitoso");
        setStatus("registro_exitoso");
        setTimeout(() => onEnrollmentComplete(true, userToken), 2000);
      } else {
        console.log("[FacialEnrollment] Registro fallido:", result.error);
        setStatus("error_registro");
        setErrorMessage(
          result.error || "Error durante el registro. Intente nuevamente."
        );
      }
    } catch (error) {
      console.error(
        "[FacialEnrollment] Error enviando datos de enrollment:",
        error
      );
      setStatus("error_registro");
      setErrorMessage(
        "Error de comunicación con el servidor. Intente nuevamente."
      );
    }
  };

  // Reintentar proceso
  const handleRetry = () => {
    console.log("[FacialEnrollment] Reiniciando proceso...");

    isRunning.current = false;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    setStatus("inicializando");
    setErrorMessage("");
    setFaceDetected(false);
    setFaceQuality("low");
    setCapturedImages([]);
    capturedImagesRef.current = []; // Limpiar ref también
    setCurrentCaptureType("normal");
    setIsCapturing(false);
    setChallengeProgress(0);
    setStabilizationProgress(0);
    stableFrameCounter.current = 0;
    frameCount.current = 0;
    challengeCounter.current = 0;
    blinkHistory.current = [];
    nosePositionHistory.current = []; // Limpiar historial de nariz
    shouldCaptureAfterNod.current = false; // Reset control post-asentimiento
    postNodCaptureCounter.current = 0;
    captureInProgress.current.clear(); // Limpiar flags de captura en progreso

    stopCamera();
    setTimeout(() => startCamera(), 1000);
  };

  // Obtener configuración del tipo de captura actual
  const getCaptureConfig = (type: CaptureType) => {
    const configs = {
      normal: {
        title: "Captura Normal",
        instruction: "Mire directamente a la cámara con expresión neutra",
        icon: <FaUser className="w-6 h-6" />,
        color: "blue",
        isAutomatic: false,
      },
      sonrisa: {
        title: "Captura con Sonrisa",
        instruction: "Sonría naturalmente - Se detectará automáticamente",
        icon: <FaSmile className="w-6 h-6" />,
        color: "green",
        isAutomatic: true,
      },
      asentir: {
        title: "Captura con Asentimiento",
        instruction:
          "Mueva la cabeza arriba y abajo - Se detectará automáticamente",
        icon: <FaArrowDown className="w-6 h-6" />,
        color: "purple",
        isAutomatic: true,
      },
      subir_cabeza: {
        title: "Captura de Subir Cabeza",
        instruction: "Mueva la cabeza hacia arriba",
        icon: <FaArrowUp className="w-6 h-6" />,
        color: "purple",
        isAutomatic: true,
      },
    };
    return configs[type];
  };

  // Renderizar indicador de estado
  const renderStatusIndicator = () => {
    const statusConfig = {
      inicializando: {
        backgroundColor: "#54a8a0",
        text: "Inicializando sistema...",
        icon: <FaSyncAlt className="w-5 h-5 animate-spin" />,
      },
      solicitando_camara: {
        backgroundColor: "#95b54c",
        text: "Solicitando acceso a la cámara...",
        icon: <FaCamera className="w-5 h-5" />,
      },
      detectando_rostro: {
        backgroundColor: faceDetected ? "#3e5866" : "#95b54c",
        text: faceDetected
          ? faceQuality === "high"
            ? `Estabilizando rostro... ${stabilizationProgress}/5`
            : `Rostro detectado - Calidad: ${
                faceQuality === "medium" ? "Media" : "Baja"
              }`
          : "Posiciónese frente a la cámara...",
        icon: <FaEye className="w-5 h-5" />,
      },
      esperando_captura_normal: {
        backgroundColor: "#3e5866",
        text: "Listo para captura normal",
        icon: <FaUser className="w-5 h-5" />,
      },
      esperando_sonrisa_automatica: {
        backgroundColor: "#95b54c",
        text: "Sonría para captura automática",
        icon: <FaSmile className="w-5 h-5" />,
      },
      esperando_asentir_automatico: {
        backgroundColor: "#607123",
        text: "Mueva la cabeza arriba y abajo para captura automática",
        icon: <FaArrowDown className="w-5 h-5" />,
      },
      esperando_subir_cabeza_automatico: {
        backgroundColor: "#9333ea",
        text: "Mueva la cabeza hacia arriba para captura automática",
        icon: <FaArrowUp className="w-5 h-5" />,
      },
      procesando_imagenes: {
        backgroundColor: "#54a8a0",
        text: "Procesando imágenes capturadas...",
        icon: <FaSyncAlt className="w-5 h-5 animate-spin" />,
      },
      enviando_datos: {
        backgroundColor: "#54a8a0",
        text: "Enviando datos al servidor...",
        icon: <FaSyncAlt className="w-5 h-5 animate-spin" />,
      },
      registro_exitoso: {
        backgroundColor: "#cbe552",
        text: "¡Registro biométrico completado con éxito!",
        icon: <FaCheck className="w-5 h-5" />,
      },
      error_registro: {
        backgroundColor: "#dc2626",
        text: "Error en el proceso",
        icon: <FaExclamationTriangle className="w-5 h-5" />,
      },
    };

    const config = statusConfig[status];

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl p-5 shadow-lg border border-blue-100 bg-white flex items-center justify-center"
      >
        <div className="flex items-center justify-center space-x-3 text-white">
          {config.icon}
          <div className="text-center">
            <p className="font-semibold text-lg">{config.text}</p>
            <div className="flex items-center justify-center space-x-4 mt-2 text-white/80 text-sm">
              <span>Calidad: {faceQuality}</span>
              <span>•</span>
              <span>Capturas: {capturedImages.length}/4</span>
              {[
                "esperando_sonrisa_automatica",
                "esperando_asentir_automatico",
                "esperando_subir_cabeza_automatico",
              ].includes(status) && (
                <>
                  <span>•</span>
                  <span>Progreso: {Math.round(challengeProgress)}%</span>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="facial-enrollment max-w-3xl mx-auto p-4">
      {/* Header moderno con fondo degradado y sombra */}
      <div
        className="rounded-3xl p-8 mb-8 shadow-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-blue-100"
        style={{
          background: "linear-gradient(135deg, #e0f2fe 0%, #f8fafc 100%)",
          boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.10)"
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-100 p-4 rounded-2xl shadow-md">
              <FaCamera className="w-10 h-10 text-blue-500" />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-blue-900 drop-shadow-sm">Registro Biométrico</h2>
              <p className="text-blue-700 text-lg mt-1">4 capturas específicas para máxima seguridad</p>
            </div>
          </div>
          {/* Progreso de capturas */}
          <div className="flex space-x-2">
            {["normal", "sonrisa", "asentir", "subir_cabeza"].map((type, index) => (
              <div
                key={type}
                className={`w-4 h-4 rounded-full transition-all duration-300 shadow-md ${
                  capturedImages.some((img) => img.type === type)
                    ? "bg-green-400 border-2 border-green-600"
                    : currentCaptureType === type
                    ? "bg-blue-400 animate-pulse border-2 border-blue-600"
                    : "bg-gray-200 border border-gray-300"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Indicador de estado */}
      <div className="mb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl p-5 shadow-lg border border-blue-100 bg-white flex items-center justify-center"
        >
          {renderStatusIndicator()}
        </motion.div>
      </div>

      {/* Área de video mejorada */}
      <div className="relative mb-8 flex justify-center">
        <div className="relative rounded-3xl overflow-hidden shadow-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-100 via-white to-blue-200" style={{width: 420, height: 320}}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover rounded-3xl"
            autoPlay
            muted
            playsInline
            style={{ aspectRatio: "4/3", background: '#e0e7ef' }}
          />
          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none rounded-3xl"
            style={{ zIndex: 10 }}
          />
          {/* Indicador de calidad facial */}
          <div className="absolute top-4 left-4">
            <AnimatePresence>
              {faceDetected && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={`px-4 py-2 rounded-xl text-base font-semibold shadow border-2 ${
                    faceQuality === "high"
                      ? "bg-green-500/90 text-white border-green-400"
                      : faceQuality === "medium"
                      ? "bg-yellow-500/90 text-white border-yellow-400"
                      : "bg-red-500/90 text-white border-red-400"
                  }`}
                >
                  Calidad: {faceQuality === "high" ? "Excelente" : faceQuality === "medium" ? "Media" : "Baja"}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Instrucciones y botones de captura mejorados */}
      <AnimatePresence>
        {[
          "esperando_captura_normal",
          "esperando_sonrisa_automatica",
          "esperando_asentir_automatico",
          "esperando_subir_cabeza_automatico",
        ].includes(status) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl shadow-lg border border-blue-100 p-8 mb-8 flex flex-col items-center"
          >
            {(() => {
              const config = getCaptureConfig(currentCaptureType);
              return (
                <div className="text-center">
                  <div className={`mx-auto mb-4 flex items-center justify-center w-14 h-14 rounded-full bg-${config.color}-100 shadow-lg`}>{config.icon}</div>
                  <h3 className="text-2xl font-bold text-blue-900 mb-2 drop-shadow-sm">{config.title}</h3>
                  <p className="text-blue-700 text-lg mb-6">{config.instruction}</p>
                  {/* Solo mostrar botón para captura normal (manual) */}
                  {!config.isAutomatic && (
                    <button
                      onClick={() => captureImage(currentCaptureType)}
                      disabled={isCapturing || faceQuality !== "high"}
                      className={`bg-gradient-to-br from-blue-700 to-teal-500 text-white font-semibold rounded-xl shadow-lg hover:from-blue-800 hover:to-teal-600 transition-all duration-200 px-10 py-3 flex items-center justify-center space-x-2 mx-auto w-full disabled:opacity-50 disabled:cursor-not-allowed ${isCapturing || faceQuality !== "high" ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {isCapturing ? (
                        <>
                          <FaSyncAlt className="w-5 h-5 animate-spin" />
                          <span>Capturando...</span>
                        </>
                      ) : (
                        <>
                          <FaCamera className="w-5 h-5" />
                          <span>Capturar Imagen</span>
                        </>
                      )}
                    </button>
                  )}
                  {/* Mostrar progreso para capturas automáticas */}
                  {config.isAutomatic && (
                    <div className="max-w-md mx-auto mt-4">
                      <div className="bg-gray-200 rounded-full h-4 overflow-hidden mb-3">
                        <motion.div
                          className={`bg-${config.color}-600 h-4 rounded-full`}
                          initial={{ width: 0 }}
                          animate={{ width: `${challengeProgress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      <p className="text-base text-blue-700">
                        {Math.round(challengeProgress)}% - {currentCaptureType === "sonrisa"
                          ? "Mantenga la sonrisa natural"
                          : currentCaptureType === "asentir"
                          ? "Mueva la cabeza arriba y abajo"
                          : "Mueva la cabeza hacia arriba"}
                      </p>
                      {isCapturing && (
                        <div className="flex items-center justify-center mt-3 text-green-600">
                          <FaSyncAlt className="w-5 h-5 animate-spin mr-2" />
                          <span className="text-base font-medium">
                            Capturando imagen automáticamente...
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {faceQuality !== "high" && (
                    <p className="text-base text-orange-600 mt-2 font-semibold">
                      {!faceDetected
                        ? "Posiciónese frente a la cámara"
                        : "Ajuste su posición para mejorar la calidad de detección"}
                    </p>
                  )}
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Consejos de captura mejorados */}
      <div className="mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-blue-900 text-base shadow">
          <strong className="block mb-2 text-lg">Consejos para una captura exitosa:</strong>
          <ul className="list-disc ml-7 mt-1 space-y-1">
            <li>Buena iluminación (evita contraluces y sombras fuertes).</li>
            <li>Rostro centrado y mirando de frente.</li>
            <li>No uses gafas oscuras, mascarillas ni cubras tu cara.</li>
            <li>Cambia de expresión o pose en cada captura.</li>
            <li>Evita fondos muy brillantes o con muchas personas.</li>
          </ul>
        </div>
        {errorMessage && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-base shadow">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Lista de imágenes capturadas mejorada */}
      {capturedImages.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg border border-blue-100 p-8 mb-8"
        >
          <h4 className="text-2xl font-bold text-blue-900 mb-6">Imágenes Capturadas</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {capturedImages.map((image, index) => {
              const config = getCaptureConfig(image.type);
              return (
                <div key={index} className="text-center flex flex-col items-center">
                  <img src={image.imageData} alt={config.title} className="rounded-xl border-2 border-blue-200 shadow mb-2 w-32 h-32 object-cover bg-gray-100" />
                  <div className={`bg-${config.color}-100 text-${config.color}-700 p-2 rounded-lg mb-1 inline-block`}>{config.icon}</div>
                  <h5 className="font-semibold text-blue-900">{config.title}</h5>
                  <p className="text-sm text-blue-700">Capturada ✓</p>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Estado de error */}
      <AnimatePresence>
        {status === "error_registro" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8 shadow"
          >
            <div className="flex items-center">
              <FaExclamationTriangle className="w-6 h-6 text-red-600 mr-3" />
              <div className="flex-1">
                <h3 className="text-red-800 font-bold text-lg">Error en el registro</h3>
                <p className="text-red-700 text-base mt-1">{errorMessage}</p>
              </div>
              <button
                onClick={handleRetry}
                className="bg-gradient-to-br from-red-600 to-red-400 text-white font-semibold rounded-xl shadow hover:from-red-700 hover:to-red-500 transition-all duration-200 px-6 py-2 flex items-center justify-center ml-4"
              >
                Reintentar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Estado de éxito */}
      <AnimatePresence>
        {status === "registro_exitoso" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-8 shadow"
          >
            <div className="flex items-center">
              <FaCheck className="w-6 h-6 text-green-600 mr-3" />
              <div>
                <h3 className="text-green-800 font-bold text-lg">Registro completado exitosamente</h3>
                <p className="text-green-700 text-base mt-1">
                  Su perfil biométrico ha sido configurado correctamente con las 4 capturas específicas
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FacialEnrollment;

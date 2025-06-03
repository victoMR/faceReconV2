import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MediaPipeService from '../services/MediaPipeService';
import FaceEmbeddingService from '../services/FaceEmbeddingService';
import ApiService from '../services/ApiService';
import { FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { FaCamera, FaCheck, FaExclamationTriangle, FaUser, FaEye, FaSyncAlt, FaSmile, FaEyeSlash } from 'react-icons/fa';

// Estados posibles durante el proceso de enrollment
type EnrollmentStatus = 
  | 'inicializando'
  | 'solicitando_camara'
  | 'detectando_rostro'
  | 'esperando_captura_normal'
  | 'esperando_sonrisa_automatica' 
  | 'esperando_ojos_cerrados_automaticos'
  | 'procesando_imagenes'
  | 'enviando_datos'
  | 'registro_exitoso'
  | 'error_registro';

// Tipos de captura específicos
type CaptureType = 'normal' | 'sonrisa' | 'ojos_cerrados';

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
  onEnrollmentComplete 
}) => {
  // Referencias
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  
  // Estados
  const [status, setStatus] = useState<EnrollmentStatus>('inicializando');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const [faceQuality, setFaceQuality] = useState<'low' | 'medium' | 'high'>('low');
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [currentCaptureType, setCurrentCaptureType] = useState<CaptureType>('normal');
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [showMesh, setShowMesh] = useState<boolean>(false);
  const [challengeProgress, setChallengeProgress] = useState<number>(0);
  const [stabilizationProgress, setStabilizationProgress] = useState<number>(0);
  
  // Contadores
  const stableFrameCounter = useRef<number>(0);
  const challengeCounter = useRef<number>(0);
  const blinkHistory = useRef<boolean[]>([]);
  
  // Control de bucle de detección
  const isRunning = useRef<boolean>(false);
  const frameCount = useRef<number>(0);
  const lastFrameTime = useRef<number>(0);
  const currentStatusRef = useRef<EnrollmentStatus>('inicializando');

  // Actualizar la ref cuando cambie el estado
  useEffect(() => {
    currentStatusRef.current = status;
  }, [status]);

  // Inicializar servicios y solicitar acceso a la cámara
  useEffect(() => {
    const initializeServices = async () => {
      try {
        console.log('[FacialEnrollment] Iniciando inicialización de servicios...');
        setStatus('inicializando');
        
        // Inicializar MediaPipe
        const mediaPipeService = MediaPipeService.getInstance();
        if (!mediaPipeService.isInitialized()) {
          console.log('[FacialEnrollment] Inicializando MediaPipe...');
          await mediaPipeService.initialize();
        }
        
        // Inicializar FaceEmbeddingService  
        const embeddingService = FaceEmbeddingService.getInstance();
        if (!embeddingService.isInitialized()) {
          console.log('[FacialEnrollment] Inicializando FaceEmbeddingService...');
          await embeddingService.initialize();
        }
        
        // Solicitar acceso a la cámara
        await startCamera();
        
      } catch (error) {
        console.error('[FacialEnrollment] Error durante la inicialización:', error);
        setStatus('error_registro');
        setErrorMessage('No se pudo inicializar el sistema de reconocimiento facial. Verifique su conexión a internet y que su navegador soporte WebRTC.');
      }
    };

    initializeServices();

    // Limpieza al desmontar el componente
    return () => {
      console.log('[FacialEnrollment] Limpiando recursos...');
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
      setStatus('solicitando_camara');
      console.log('[FacialEnrollment] Solicitando acceso a la cámara...');
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta acceso a la cámara');
      }

      let stream: MediaStream;
      
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
        console.log('[FacialEnrollment] Cámara obtenida con restricciones básicas');
      } catch (basicError) {
        console.warn('[FacialEnrollment] Restricciones básicas fallaron, intentando mínimas:', basicError);
        
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play()
              .then(() => {
                console.log('[FacialEnrollment] Video iniciado correctamente');
                setStatus('detectando_rostro');
                startFaceDetection();
              })
              .catch(error => {
                console.error('[FacialEnrollment] Error reproduciendo video:', error);
                setStatus('error_registro');
                setErrorMessage('No se pudo iniciar la reproducción del video. Verifique los permisos de su navegador.');
              });
          }
        };

        videoRef.current.onerror = (error) => {
          console.error('[FacialEnrollment] Error en el elemento video:', error);
          setStatus('error_registro');
          setErrorMessage('Error al cargar el video de la cámara.');
        };
      }
    } catch (error) {
      console.error('[FacialEnrollment] Error accediendo a la cámara:', error);
      setStatus('error_registro');
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setErrorMessage('Acceso a la cámara denegado. Por favor, permita el acceso a la cámara y recargue la página.');
        } else if (error.name === 'NotFoundError') {
          setErrorMessage('No se encontró ninguna cámara. Verifique que tiene una cámara conectada.');
        } else if (error.name === 'NotReadableError') {
          setErrorMessage('La cámara está siendo utilizada por otra aplicación. Cierre otras aplicaciones que puedan estar usando la cámara.');
        } else {
          setErrorMessage(`Error accediendo a la cámara: ${error.message}`);
        }
      } else {
        setErrorMessage('Error desconocido accediendo a la cámara.');
      }
    }
  };

  // Detener la cámara
  const stopCamera = () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        console.log('[FacialEnrollment] Cámara detenida');
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    } catch (error) {
      console.error('[FacialEnrollment] Error deteniendo cámara:', error);
    }
  };

  // Iniciar la detección facial continua
  const startFaceDetection = () => {
    if (isRunning.current) {
      console.warn('[FacialEnrollment] La detección ya está en marcha');
      return;
    }

    console.log('[FacialEnrollment] Iniciando detección facial...');
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
        const result = mediaPipeService.detectFaceInVideo(videoRef.current, timestamp);
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
      } catch (error) {
        console.error('[FacialEnrollment] Error en detección facial:', error);
      }

      if (isRunning.current) {
        animationRef.current = requestAnimationFrame(detectFace);
      }
    };

    animationRef.current = requestAnimationFrame(detectFace);
  };

  // Procesar el estado actual
  const processCurrentState = (currentQuality: 'low' | 'medium' | 'high') => {
    try {
      switch (currentStatusRef.current) {
        case 'detectando_rostro':
          // Log menos frecuente para no saturar consola
          if (frameCount.current % 30 === 0) {
            console.log(`[FacialEnrollment] Estado: ${currentStatusRef.current}, Calidad: ${currentQuality}, Contador: ${stableFrameCounter.current}`);
          }
          if (currentQuality === 'high') {
            stableFrameCounter.current++;
            setStabilizationProgress(stableFrameCounter.current);
            console.log(`[FacialEnrollment] ✓ Calidad HIGH - Incrementando contador a ${stableFrameCounter.current}/5`);
            if (stableFrameCounter.current >= 5) { // Temporalmente reducido a 5 para debug
              console.log('[FacialEnrollment] Rostro estable detectado, listo para capturas');
              setStatus('esperando_captura_normal');
              setCurrentCaptureType('normal');
              stableFrameCounter.current = 0;
              setStabilizationProgress(0);
            } else {
              // Debug: mostrar progreso cada 5 frames
              if (stableFrameCounter.current % 5 === 0) {
                console.log(`[FacialEnrollment] Frames estables: ${stableFrameCounter.current}/5`);
              }
            }
          } else {
            if (stableFrameCounter.current > 0) {
              console.log(`[FacialEnrollment] ✗ Calidad bajó a ${currentQuality}, reiniciando contador desde ${stableFrameCounter.current}`);
            }
            stableFrameCounter.current = 0;
            setStabilizationProgress(0);
          }
          break;
      }
    } catch (error) {
      console.error('[FacialEnrollment] Error procesando estado:', error);
    }
  };

  // Procesar detección automática de desafíos
  const processAutomaticChallenges = (result: FaceLandmarkerResult) => {
    const mediaPipeService = MediaPipeService.getInstance();
    
    try {
      switch (currentStatusRef.current) {
        case 'esperando_sonrisa_automatica':
          if (mediaPipeService.isSmiling(result)) {
            challengeCounter.current++;
            setChallengeProgress(Math.min((challengeCounter.current / 15) * 100, 100));
            
            if (challengeCounter.current >= 15) {
              console.log('[FacialEnrollment] Sonrisa detectada, capturando imagen...');
              automaticCapture('sonrisa');
            }
          } else {
            if (challengeCounter.current > 0) {
              challengeCounter.current = Math.max(0, challengeCounter.current - 1);
              setChallengeProgress(Math.min((challengeCounter.current / 15) * 100, 100));
            }
          }
          break;

        case 'esperando_ojos_cerrados_automaticos':
          const isBlinking = mediaPipeService.isBlinking(result);
          blinkHistory.current.push(isBlinking);
          
          if (blinkHistory.current.length > 30) {
            blinkHistory.current.shift();
          }
          
          // Detectar si los ojos han estado cerrados por suficiente tiempo
          const recentFrames = blinkHistory.current.slice(-10);
          const closedFrames = recentFrames.filter(closed => closed).length;
          
          if (closedFrames >= 8) { // 8 de 10 frames con ojos cerrados
            challengeCounter.current++;
            setChallengeProgress(Math.min((challengeCounter.current / 10) * 100, 100));
            
            if (challengeCounter.current >= 10) {
              console.log('[FacialEnrollment] Ojos cerrados detectados, capturando imagen...');
              automaticCapture('ojos_cerrados');
            }
          } else {
            if (challengeCounter.current > 0) {
              challengeCounter.current = Math.max(0, challengeCounter.current - 1);
              setChallengeProgress(Math.min((challengeCounter.current / 10) * 100, 100));
            }
          }
          break;
      }
    } catch (error) {
      console.error('[FacialEnrollment] Error procesando desafíos automáticos:', error);
    }
  };

  // Evaluar la calidad del rostro detectado (versión síncrona)
  const evaluateFaceQualitySync = (result: FaceLandmarkerResult | null): 'low' | 'medium' | 'high' => {
    if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
      return 'low';
    }

    try {
      const landmarks = result.faceLandmarks[0];
      
      if (!landmarks || landmarks.length < 455) {
        return 'low';
      }
      
      const faceWidth = Math.abs(landmarks[454]?.x - landmarks[234]?.x) || 0;
      const faceHeight = Math.abs(landmarks[10]?.y - landmarks[152]?.y) || 0;
      const noseX = landmarks[1]?.x || 0.5;
      const isCentered = noseX > 0.3 && noseX < 0.7;
      
      if (faceWidth > 0.18 && faceHeight > 0.18 && isCentered) {
        return 'high';
      } else if (faceWidth > 0.1 && faceHeight > 0.1) {
        return 'medium';
      } else {
        return 'low';
      }
    } catch (error) {
      console.error('[FacialEnrollment] Error evaluando calidad facial sync:', error);
      return 'low';
    }
  };

  // Evaluar la calidad del rostro detectado
  const evaluateFaceQuality = (result: FaceLandmarkerResult | null) => {
    if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
      setFaceQuality('low');
      return;
    }

    try {
      const landmarks = result.faceLandmarks[0];
      
      if (!landmarks || landmarks.length < 455) {
        setFaceQuality('low');
        return;
      }
      
      const faceWidth = Math.abs(landmarks[454]?.x - landmarks[234]?.x) || 0;
      const faceHeight = Math.abs(landmarks[10]?.y - landmarks[152]?.y) || 0;
      const noseX = landmarks[1]?.x || 0.5;
      const isCentered = noseX > 0.3 && noseX < 0.7; // Más permisivo que 0.35-0.65
      
      // Log de debug cada 60 frames
      if (frameCount.current % 60 === 0) {
        console.log(`[FacialEnrollment] Calidad - Width: ${faceWidth.toFixed(3)}, Height: ${faceHeight.toFixed(3)}, Nose: ${noseX.toFixed(3)}, Centered: ${isCentered}`);
      }
      
      let newQuality: 'low' | 'medium' | 'high';
      if (faceWidth > 0.18 && faceHeight > 0.18 && isCentered) { // Reducido de 0.2 a 0.18
        newQuality = 'high';
      } else if (faceWidth > 0.1 && faceHeight > 0.1) {
        newQuality = 'medium';
      } else {
        newQuality = 'low';
      }
      
      // Log cuando cambie la calidad
      if (newQuality !== faceQuality) {
        console.log(`[FacialEnrollment] Calidad cambió de ${faceQuality} a ${newQuality}`);
      }
      
      setFaceQuality(newQuality);
    } catch (error) {
      console.error('[FacialEnrollment] Error evaluando calidad facial:', error);
      setFaceQuality('low');
    }
  };

  // Capturar imagen específica (manual para normal)
  const captureImage = async (type: CaptureType) => {
    if (isCapturing || !videoRef.current || faceQuality !== 'high') {
      return;
    }

    setIsCapturing(true);
    console.log(`[FacialEnrollment] Capturando imagen tipo: ${type}`);

    try {
      const embeddingService = FaceEmbeddingService.getInstance();
      
      // Capturar frame del video
      const canvas = embeddingService.captureVideoFrame(videoRef.current);
      const embedding = await embeddingService.generateFaceEmbedding(canvas);
      
      if (!embedding) {
        throw new Error(`No se pudo generar el embedding para la imagen ${type}`);
      }

      // Obtener los datos de la imagen como base64
      const imageData = canvas.toDataURL('image/jpeg', 0.8);

      const capturedImage: CapturedImage = {
        type,
        embedding,
        imageData,
        timestamp: new Date().toISOString()
      };

      setCapturedImages(prev => [...prev, capturedImage]);
      console.log(`[FacialEnrollment] Imagen ${type} capturada exitosamente`);

      // Determinar siguiente estado
      if (type === 'normal') {
        setStatus('esperando_sonrisa_automatica');
        setCurrentCaptureType('sonrisa');
        challengeCounter.current = 0;
        setChallengeProgress(0);
      } else if (type === 'sonrisa') {
        setStatus('esperando_ojos_cerrados_automaticos');
        setCurrentCaptureType('ojos_cerrados');
        challengeCounter.current = 0;
        setChallengeProgress(0);
        blinkHistory.current = [];
      } else if (type === 'ojos_cerrados') {
        // Todas las capturas completadas
        await sendEnrollmentData([...capturedImages, capturedImage]);
      }
      
    } catch (error) {
      console.error(`[FacialEnrollment] Error capturando imagen ${type}:`, error);
      setStatus('error_registro');
      setErrorMessage(`Error al capturar la imagen ${type}. Intente nuevamente.`);
    } finally {
      setIsCapturing(false);
    }
  };

  // Captura automática para desafíos
  const automaticCapture = async (type: CaptureType) => {
    if (isCapturing || !videoRef.current) {
      return;
    }

    setIsCapturing(true);
    console.log(`[FacialEnrollment] Captura automática tipo: ${type}`);

    try {
      const embeddingService = FaceEmbeddingService.getInstance();
      
      // Capturar frame del video
      const canvas = embeddingService.captureVideoFrame(videoRef.current);
      const embedding = await embeddingService.generateFaceEmbedding(canvas);
      
      if (!embedding) {
        throw new Error(`No se pudo generar el embedding para la imagen ${type}`);
      }

      // Obtener los datos de la imagen como base64
      const imageData = canvas.toDataURL('image/jpeg', 0.8);

      const capturedImage: CapturedImage = {
        type,
        embedding,
        imageData,
        timestamp: new Date().toISOString()
      };

      setCapturedImages(prev => [...prev, capturedImage]);
      console.log(`[FacialEnrollment] Imagen automática ${type} capturada exitosamente`);

      // Determinar siguiente estado
      if (type === 'sonrisa') {
        setStatus('esperando_ojos_cerrados_automaticos');
        setCurrentCaptureType('ojos_cerrados');
        challengeCounter.current = 0;
        setChallengeProgress(0);
        blinkHistory.current = [];
      } else if (type === 'ojos_cerrados') {
        // Todas las capturas completadas
        await sendEnrollmentData([...capturedImages, capturedImage]);
      }
      
    } catch (error) {
      console.error(`[FacialEnrollment] Error en captura automática ${type}:`, error);
      setStatus('error_registro');
      setErrorMessage(`Error al capturar la imagen ${type}. Intente nuevamente.`);
    } finally {
      setIsCapturing(false);
    }
  };

  // Enviar datos de enrollment al backend
  const sendEnrollmentData = async (images: CapturedImage[]) => {
    try {
      console.log('[FacialEnrollment] Enviando datos al servidor...');
      setStatus('enviando_datos');
      
      // Detener el bucle de detección
      isRunning.current = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      // Extraer embeddings
      const embeddings = images.map(img => img.embedding);
      
      // Preparar datos del usuario
      const enrollmentData = {
        userToken,
        userData,
        faceEmbeddings: embeddings,
        captureDetails: images.map(img => ({
          type: img.type,
          timestamp: img.timestamp
        }))
      };

      const result = await ApiService.enrollFace(userToken, embeddings);
      
      if (result.success) {
        console.log('[FacialEnrollment] Registro exitoso');
        setStatus('registro_exitoso');
        setTimeout(() => onEnrollmentComplete(true, userToken), 2000);
      } else {
        console.log('[FacialEnrollment] Registro fallido:', result.error);
        setStatus('error_registro');
        setErrorMessage(result.error || 'Error durante el registro. Intente nuevamente.');
      }
      
    } catch (error) {
      console.error('[FacialEnrollment] Error enviando datos de enrollment:', error);
      setStatus('error_registro');
      setErrorMessage('Error de comunicación con el servidor. Intente nuevamente.');
    }
  };

  // Reintentar proceso
  const handleRetry = () => {
    console.log('[FacialEnrollment] Reiniciando proceso...');
    
    isRunning.current = false;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    setStatus('inicializando');
    setErrorMessage('');
    setFaceDetected(false);
    setFaceQuality('low');
    setCapturedImages([]);
    setCurrentCaptureType('normal');
    setIsCapturing(false);
    setChallengeProgress(0);
    setStabilizationProgress(0);
    stableFrameCounter.current = 0;
    frameCount.current = 0;
    challengeCounter.current = 0;
    blinkHistory.current = [];
    
    stopCamera();
    setTimeout(() => startCamera(), 1000);
  };

  // Obtener configuración del tipo de captura actual
  const getCaptureConfig = (type: CaptureType) => {
    const configs = {
      normal: {
        title: 'Captura Normal',
        instruction: 'Mire directamente a la cámara con expresión neutra',
        icon: <FaUser className="w-6 h-6" />,
        color: 'blue',
        isAutomatic: false
      },
      sonrisa: {
        title: 'Captura con Sonrisa',
        instruction: 'Sonría naturalmente - Se detectará automáticamente',
        icon: <FaSmile className="w-6 h-6" />,
        color: 'green',
        isAutomatic: true
      },
      ojos_cerrados: {
        title: 'Captura Ojos Cerrados',
        instruction: 'Cierre los ojos suavemente - Se detectará automáticamente',
        icon: <FaEyeSlash className="w-6 h-6" />,
        color: 'purple',
        isAutomatic: true
      }
    };
    return configs[type];
  };

  // Renderizar indicador de estado
  const renderStatusIndicator = () => {
    const statusConfig = {
      'inicializando': { 
        backgroundColor: '#54a8a0',
        text: 'Inicializando sistema...',
        icon: <FaSyncAlt className="w-5 h-5 animate-spin" />
      },
      'solicitando_camara': { 
        backgroundColor: '#95b54c',
        text: 'Solicitando acceso a la cámara...',
        icon: <FaCamera className="w-5 h-5" />
      },
      'detectando_rostro': { 
        backgroundColor: faceDetected ? '#3e5866' : '#95b54c',
        text: faceDetected 
          ? faceQuality === 'high' 
            ? `Estabilizando rostro... ${stabilizationProgress}/5`
            : `Rostro detectado - Calidad: ${faceQuality === 'medium' ? 'Media' : 'Baja'}` 
          : 'Posiciónese frente a la cámara...',
        icon: <FaEye className="w-5 h-5" />
      },
      'esperando_captura_normal': { 
        backgroundColor: '#3e5866',
        text: 'Listo para captura normal',
        icon: <FaUser className="w-5 h-5" />
      },
      'esperando_sonrisa_automatica': { 
        backgroundColor: '#95b54c',
        text: 'Sonría para captura automática',
        icon: <FaSmile className="w-5 h-5" />
      },
      'esperando_ojos_cerrados_automaticos': { 
        backgroundColor: '#607123',
        text: 'Cierre los ojos para captura automática',
        icon: <FaEyeSlash className="w-5 h-5" />
      },
      'procesando_imagenes': { 
        backgroundColor: '#54a8a0',
        text: 'Procesando imágenes capturadas...',
        icon: <FaSyncAlt className="w-5 h-5 animate-spin" />
      },
      'enviando_datos': { 
        backgroundColor: '#54a8a0',
        text: 'Enviando datos al servidor...',
        icon: <FaSyncAlt className="w-5 h-5 animate-spin" />
      },
      'registro_exitoso': { 
        backgroundColor: '#cbe552',
        text: '¡Registro biométrico completado con éxito!',
        icon: <FaCheck className="w-5 h-5" />
      },
      'error_registro': { 
        backgroundColor: '#dc2626',
        text: 'Error en el proceso',
        icon: <FaExclamationTriangle className="w-5 h-5" />
      }
    };

    const config = statusConfig[status];
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="rounded-xl p-4 shadow-lg"
        style={{ backgroundColor: config.backgroundColor }}
      >
        <div className="flex items-center justify-center space-x-3 text-white">
          {config.icon}
          <div className="text-center">
            <p className="font-semibold text-lg">{config.text}</p>
            <div className="flex items-center justify-center space-x-4 mt-2 text-white/80 text-sm">
              <span>Calidad: {faceQuality}</span>
              <span>•</span>
              <span>Capturas: {capturedImages.length}/3</span>
              {['esperando_sonrisa_automatica', 'esperando_ojos_cerrados_automaticos'].includes(status) && (
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
    <div className="facial-enrollment max-w-4xl mx-auto p-4">
      {/* Header moderno */}
      <div className="rounded-xl p-6 mb-6 shadow-xl" style={{
        background: 'linear-gradient(135deg, #3e5866 0%, #54a8a0 100%)'
      }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-white bg-opacity-20 p-3 rounded-xl">
              <FaCamera className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Registro Biométrico</h2>
              <p className="text-gray-200">3 capturas específicas para máxima seguridad</p>
            </div>
          </div>
          
          {/* Progreso de capturas */}
          <div className="flex space-x-2">
            {['normal', 'sonrisa', 'ojos_cerrados'].map((type, index) => (
              <div
                key={type}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  capturedImages.some(img => img.type === type)
                    ? 'bg-green-400'
                    : currentCaptureType === type
                      ? 'animate-pulse'
                      : 'bg-gray-400'
                }`}
                style={{
                  backgroundColor: capturedImages.some(img => img.type === type)
                    ? '#cbe552'
                    : currentCaptureType === type
                      ? '#95b54c'
                      : '#ffffff80'
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Indicador de estado */}
      <div className="mb-6">
        {renderStatusIndicator()}
      </div>

      {/* Área de video */}
      <div className="relative mb-6">
        <div className="relative bg-gray-900 rounded-xl overflow-hidden shadow-lg">
          <video 
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
            style={{ aspectRatio: '16/9' }}
          />
          
          {/* Overlay de detección facial */}
          <AnimatePresence>
            {faceDetected && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div className={`border-4 rounded-lg transition-all duration-300 ${
                  faceQuality === 'high' 
                    ? 'border-green-400 shadow-lg shadow-green-400/30' 
                    : faceQuality === 'medium' 
                      ? 'border-yellow-400 shadow-lg shadow-yellow-400/30' 
                      : 'border-red-400 shadow-lg shadow-red-400/30'
                }`} style={{ width: '320px', height: '240px' }} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Indicador de calidad facial */}
          <div className="absolute top-4 left-4">
            <AnimatePresence>
              {faceDetected && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold backdrop-blur-md border ${
                    faceQuality === 'high' 
                      ? 'bg-green-500/90 text-white border-green-400' 
                      : faceQuality === 'medium' 
                        ? 'bg-yellow-500/90 text-white border-yellow-400' 
                        : 'bg-red-500/90 text-white border-red-400'
                  }`}
                >
                  Calidad: {faceQuality === 'high' ? 'Excelente' : faceQuality === 'medium' ? 'Media' : 'Baja'}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Instrucciones y botones de captura */}
      <AnimatePresence>
        {['esperando_captura_normal', 'esperando_sonrisa_automatica', 'esperando_ojos_cerrados_automaticos'].includes(status) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6"
          >
            {(() => {
              const config = getCaptureConfig(currentCaptureType);
              return (
                <div className="text-center">
                  <div className={`bg-${config.color}-100 text-${config.color}-700 p-4 rounded-xl mb-4 inline-block`}>
                    {config.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{config.title}</h3>
                  <p className="text-gray-600 mb-6">{config.instruction}</p>
                  
                  {/* Solo mostrar botón para captura normal (manual) */}
                  {!config.isAutomatic && (
                    <button
                      onClick={() => captureImage(currentCaptureType)}
                      disabled={isCapturing || faceQuality !== 'high'}
                      className={`px-8 py-3 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 mx-auto ${
                        faceQuality === 'high' && !isCapturing
                          ? `bg-${config.color}-600 hover:bg-${config.color}-700 text-white shadow-lg hover:shadow-xl`
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {isCapturing ? (
                        <>
                          <FaSyncAlt className="w-4 h-4 animate-spin" />
                          <span>Capturando...</span>
                        </>
                      ) : (
                        <>
                          <FaCamera className="w-4 h-4" />
                          <span>Capturar Imagen</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Mostrar progreso para capturas automáticas */}
                  {config.isAutomatic && (
                    <div className="max-w-md mx-auto">
                      <div className="bg-gray-200 rounded-full h-3 overflow-hidden mb-3">
                        <motion.div 
                          className={`bg-${config.color}-600 h-3 rounded-full`}
                          initial={{ width: 0 }}
                          animate={{ width: `${challengeProgress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      <p className="text-sm text-gray-600">
                        {Math.round(challengeProgress)}% - {
                          currentCaptureType === 'sonrisa' 
                            ? 'Mantenga la sonrisa natural' 
                            : 'Mantenga los ojos cerrados'
                        }
                      </p>
                      {isCapturing && (
                        <div className="flex items-center justify-center mt-3 text-green-600">
                          <FaSyncAlt className="w-4 h-4 animate-spin mr-2" />
                          <span className="text-sm font-medium">Capturando imagen automáticamente...</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {faceQuality !== 'high' && (
                    <p className="text-sm text-orange-600 mt-2">
                      {!faceDetected 
                        ? 'Posiciónese frente a la cámara' 
                        : 'Ajuste su posición para mejorar la calidad de detección'
                      }
                    </p>
                  )}
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista de imágenes capturadas */}
      {capturedImages.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6"
        >
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Imágenes Capturadas</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {capturedImages.map((image, index) => {
              const config = getCaptureConfig(image.type);
              return (
                <div key={index} className="text-center">
                  <div className={`bg-${config.color}-100 text-${config.color}-700 p-3 rounded-lg mb-2 inline-block`}>
                    {config.icon}
                  </div>
                  <h5 className="font-medium text-gray-900">{config.title}</h5>
                  <p className="text-sm text-gray-500">Capturada ✓</p>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Estado de error */}
      <AnimatePresence>
        {status === 'error_registro' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-red-50 border border-red-200 rounded-xl p-6"
          >
            <div className="flex items-center">
              <FaExclamationTriangle className="w-5 h-5 text-red-600 mr-3" />
              <div className="flex-1">
                <h3 className="text-red-800 font-medium">Error en el registro</h3>
                <p className="text-red-700 text-sm mt-1">{errorMessage}</p>
              </div>
              <button
                onClick={handleRetry}
                className="ml-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Reintentar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Estado de éxito */}
      <AnimatePresence>
        {status === 'registro_exitoso' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-green-50 border border-green-200 rounded-xl p-6"
          >
            <div className="flex items-center">
              <FaCheck className="w-5 h-5 text-green-600 mr-3" />
              <div>
                <h3 className="text-green-800 font-medium">Registro completado exitosamente</h3>
                <p className="text-green-700 text-sm mt-1">Su perfil biométrico ha sido configurado correctamente con las 3 capturas específicas</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FacialEnrollment;

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MediaPipeService from '../services/MediaPipeService';
import FaceEmbeddingService from '../services/FaceEmbeddingService';
import ApiService from '../services/ApiService';
import { FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { FaSmile, FaEye, FaArrowDown, FaCheck, FaExclamationTriangle, FaCamera, FaSyncAlt, FaUser } from 'react-icons/fa';
import * as faceapi from 'face-api.js';

// Estados posibles durante el proceso de login
type LoginStatus = 
  | 'inicializando'
  | 'solicitando_camara' 
  | 'detectando_rostro' 
  | 'challenge_sonrisa'
  | 'challenge_parpadeo'
  | 'challenge_asentir'
  | 'liveness_completado'
  | 'generando_embedding'
  | 'verificando_identidad'
  | 'login_exitoso' 
  | 'error_login';

// Tipo de desafío de liveness
type LivenessChallenge = 'sonrisa' | 'parpadeo' | 'asentir';

interface FacialLoginProps {
  onLoginComplete: (success: boolean, userToken?: string) => void;
}

const FacialLogin: React.FC<FacialLoginProps> = ({ onLoginComplete }) => {
  // Referencias
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  
  // Estado para las posiciones históricas de la nariz (para detección de asentimiento)
  const nosePositionHistory = useRef<number[]>([]);
  const blinkHistory = useRef<boolean[]>([]);
  
  // Estados
  const [status, setStatus] = useState<LoginStatus>('inicializando');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const [faceQuality, setFaceQuality] = useState<'low' | 'medium' | 'high'>('low');
  const [currentChallenge, setCurrentChallenge] = useState<LivenessChallenge>('sonrisa');
  const [challengeProgress, setChallengeProgress] = useState<number>(0);
  const [completedChallenges, setCompletedChallenges] = useState<LivenessChallenge[]>([]);
  
  // Contadores para la detección
  const challengeCounter = useRef<number>(0);
  const stableFrameCounter = useRef<number>(0);
  
  // Control de bucle de detección
  const isRunning = useRef<boolean>(false);
  const frameCount = useRef<number>(0);
  const lastFrameTime = useRef<number>(0);
  const currentStatusRef = useRef<LoginStatus>('inicializando');

  // Actualizar la ref cuando cambie el estado
  useEffect(() => {
    currentStatusRef.current = status;
  }, [status]);

  // Inicializar servicios y solicitar acceso a la cámara
  useEffect(() => {
    const initializeServices = async () => {
      try {
        console.log('[FacialLogin] Iniciando inicialización de servicios...');
        setStatus('inicializando');
        
        // Inicializar MediaPipe
        const mediaPipeService = MediaPipeService.getInstance();
        if (!mediaPipeService.isInitialized()) {
          console.log('[FacialLogin] Inicializando MediaPipe...');
        await mediaPipeService.initialize();
        }
        
        // Inicializar FaceEmbeddingService  
        const embeddingService = FaceEmbeddingService.getInstance();
        if (!embeddingService.isInitialized()) {
          console.log('[FacialLogin] Inicializando FaceEmbeddingService...');
          await embeddingService.initialize();
        }
        
        // Solicitar acceso a la cámara
        await startCamera();
        
      } catch (error) {
        console.error('[FacialLogin] Error durante la inicialización:', error);
        setStatus('error_login');
        setErrorMessage('No se pudo inicializar el sistema de reconocimiento facial. Verifique su conexión a internet y que su navegador soporte WebRTC.');
      }
    };

    initializeServices();

    // Limpieza al desmontar el componente
    return () => {
      console.log('[FacialLogin] Limpiando recursos...');
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
      console.log('[FacialLogin] Solicitando acceso a la cámara...');
      
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
        console.log('[FacialLogin] Cámara obtenida con restricciones básicas');
      } catch (basicError) {
        console.warn('[FacialLogin] Restricciones básicas fallaron, intentando mínimas:', basicError);
        
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
                console.log('[FacialLogin] Video iniciado correctamente');
                setStatus('detectando_rostro');
                startFaceDetection();
              })
              .catch(error => {
                console.error('[FacialLogin] Error reproduciendo video:', error);
              setStatus('error_login');
                setErrorMessage('No se pudo iniciar la reproducción del video. Verifique los permisos de su navegador.');
            });
          }
        };

        videoRef.current.onerror = (error) => {
          console.error('[FacialLogin] Error en el elemento video:', error);
          setStatus('error_login');
          setErrorMessage('Error al cargar el video de la cámara.');
        };
      }
    } catch (error) {
      console.error('[FacialLogin] Error accediendo a la cámara:', error);
      setStatus('error_login');
      
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
        console.log('[FacialLogin] Cámara detenida');
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      }
    } catch (error) {
      console.error('[FacialLogin] Error deteniendo cámara:', error);
    }
  };

  // Iniciar la detección facial continua
  const startFaceDetection = () => {
    if (isRunning.current) {
      console.warn('[FacialLogin] La detección ya está en marcha');
      return;
    }

    console.log('[FacialLogin] Iniciando detección facial...');
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

      // Log cada 150 frames (cada ~10 segundos)
      if (frameCount.current % 150 === 0) {
        console.log(`[FacialLogin] Frame ${frameCount.current}, Status: ${currentStatusRef.current}`);
      }

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
          processCurrentState(result, currentQuality);
        } else {
          challengeCounter.current = 0;
          setChallengeProgress(0);
          
          if (currentStatusRef.current !== 'detectando_rostro' && currentStatusRef.current !== 'error_login' && currentStatusRef.current !== 'login_exitoso') {
            stableFrameCounter.current++;
            if (stableFrameCounter.current > 45) {
              console.log('[FacialLogin] Rostro perdido, volviendo a detección');
        setStatus('detectando_rostro');
              stableFrameCounter.current = 0;
            }
          }
        }
      } catch (error) {
        console.error('[FacialLogin] Error en detección facial:', error);
      }

      if (isRunning.current) {
      animationRef.current = requestAnimationFrame(detectFace);
      }
    };

    animationRef.current = requestAnimationFrame(detectFace);
  };

  // Procesar el estado actual y actuar en consecuencia
  const processCurrentState = (result: FaceLandmarkerResult, currentQuality: 'low' | 'medium' | 'high') => {
    const mediaPipeService = MediaPipeService.getInstance();
    
    stableFrameCounter.current = 0;

    try {
      switch (currentStatusRef.current) {
      case 'detectando_rostro':
          if (currentQuality === 'high') {
            console.log('[FacialLogin] Rostro de alta calidad detectado, iniciando liveness');
            setStatus('challenge_sonrisa');
            setCurrentChallenge('sonrisa');
            challengeCounter.current = 0;
            setChallengeProgress(0);
        }
        break;
        
      case 'challenge_sonrisa':
        if (mediaPipeService.isSmiling(result)) {
            challengeCounter.current++;
            setChallengeProgress(Math.min((challengeCounter.current / 10) * 100, 100));
            
            if (challengeCounter.current >= 10) {
              console.log('[FacialLogin] Sonrisa completada');
              setCompletedChallenges(prev => [...prev, 'sonrisa']);
              setStatus('challenge_parpadeo');
            setCurrentChallenge('parpadeo');
              challengeCounter.current = 0;
              setChallengeProgress(0);
              blinkHistory.current = [];
          }
        } else {
            if (challengeCounter.current > 0) {
              challengeCounter.current = Math.max(0, challengeCounter.current - 1);
              setChallengeProgress(Math.min((challengeCounter.current / 10) * 100, 100));
            }
        }
        break;
        
      case 'challenge_parpadeo':
          const isBlinking = mediaPipeService.isBlinking(result);
          blinkHistory.current.push(isBlinking);
          
          if (blinkHistory.current.length > 20) {
            blinkHistory.current.shift();
          }
          
          const blinks = detectBlinks(blinkHistory.current);
          if (blinks >= 2) {
            console.log('[FacialLogin] Parpadeos completados');
            setCompletedChallenges(prev => [...prev, 'parpadeo']);
            setStatus('challenge_asentir');
            setCurrentChallenge('asentir');
            challengeCounter.current = 0;
            setChallengeProgress(0);
            nosePositionHistory.current = [];
        } else {
            setChallengeProgress(Math.min((blinks / 2) * 100, 100));
        }
        break;
        
      case 'challenge_asentir':
          if (result.faceLandmarks && result.faceLandmarks.length > 0) {
            const landmarks = result.faceLandmarks[0];
            if (landmarks && landmarks.length > 1) {
              const noseY = landmarks[1]?.y;
              if (typeof noseY === 'number') {
                nosePositionHistory.current.push(noseY);
                
                if (nosePositionHistory.current.length > 15) {
                  nosePositionHistory.current.shift();
                }
                
        if (mediaPipeService.isNodding(result, nosePositionHistory.current)) {
                  challengeCounter.current++;
                  setChallengeProgress(Math.min((challengeCounter.current / 8) * 100, 100));
                  
                  if (challengeCounter.current >= 8) {
                    console.log('[FacialLogin] Asentimiento completado, iniciando verificación final');
                    setCompletedChallenges(prev => [...prev, 'asentir']);
                    setStatus('liveness_completado');
                    processFinalVerification();
                  }
                }
              }
            }
          }
          break;
      }
    } catch (error) {
      console.error('[FacialLogin] Error procesando estado:', error);
    }
  };

  // Detectar parpadeos en el historial
  const detectBlinks = (blinkHistory: boolean[]): number => {
    let blinks = 0;
    let wasOpen = true;
    
    try {
      for (const isClosed of blinkHistory) {
        if (wasOpen && isClosed) {
          wasOpen = false;
        } else if (!wasOpen && !isClosed) {
          blinks++;
          wasOpen = true;
        }
      }
    } catch (error) {
      console.error('[FacialLogin] Error detectando parpadeos:', error);
          }
    
    return blinks;
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
      console.error('[FacialLogin] Error evaluando calidad facial sync:', error);
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
        console.log(`[FacialLogin] Calidad - Width: ${faceWidth.toFixed(3)}, Height: ${faceHeight.toFixed(3)}, Nose: ${noseX.toFixed(3)}, Centered: ${isCentered}`);
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
        console.log(`[FacialLogin] Calidad cambió de ${faceQuality} a ${newQuality}`);
      }
      
      setFaceQuality(newQuality);
    } catch (error) {
      console.error('[FacialLogin] Error evaluando calidad facial:', error);
      setFaceQuality('low');
    }
  };

  // Procesar verificación final después del liveness
  const processFinalVerification = async () => {
    try {
      console.log('[FacialLogin] Iniciando verificación final...');
      setStatus('generando_embedding');
      
      // NO detener el bucle de detección para mantener el video activo
      // isRunning.current = false;
      
      if (!videoRef.current) {
        throw new Error('Elemento de video no disponible');
      }

      const embeddingService = FaceEmbeddingService.getInstance();
      
      // Intentar generar embedding con múltiples intentos
      let embedding: number[] | null = null;
      const maxAttempts = 5;
      let attempt = 0;
      
      console.log('[FacialLogin] Intentando generar embedding con múltiples intentos...');
      
      while (attempt < maxAttempts && !embedding) {
        attempt++;
        console.log(`[FacialLogin] Intento ${attempt}/${maxAttempts} para generar embedding...`);
        
        try {
          // Pequeña pausa para estabilizar el video
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Intentar directamente con el video (sin canvas intermedio)
          embedding = await embeddingService.generateFaceEmbedding(videoRef.current);
          
          if (embedding) {
            console.log(`[FacialLogin] ✅ Embedding generado exitosamente en intento ${attempt}`);
            break;
          } else {
            console.warn(`[FacialLogin] ❌ Intento ${attempt} falló, reintentando...`);
            
            // Si falla, intentar con canvas capturado
            if (attempt === maxAttempts - 1) {
              console.log('[FacialLogin] Último intento con canvas capturado...');
              const canvas = embeddingService.captureVideoFrame(videoRef.current);
              embedding = await embeddingService.generateFaceEmbedding(canvas);
            }
          }
          
        } catch (attemptError) {
          console.warn(`[FacialLogin] Error en intento ${attempt}:`, attemptError);
          
          // Pausa más larga entre intentos fallidos
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
    
      if (!embedding) {
        // Intentar una última vez con diferentes configuraciones de face-api.js
        console.log('[FacialLogin] Último recurso: intentando con configuración alternativa...');
        
        try {
          // Crear un canvas temporal con mejor resolución
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (ctx && videoRef.current) {
            // Usar mayor resolución para el canvas
            canvas.width = videoRef.current.videoWidth || 640;
            canvas.height = videoRef.current.videoHeight || 480;
            
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            
            // Intentar con configuración muy permisiva
            const detections = await faceapi
              .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions({ 
                inputSize: 160, 
                scoreThreshold: 0.1  // Muy permisivo
              }))
              .withFaceLandmarks()
              .withFaceDescriptors();
              
            if (detections.length > 0) {
              const bestDetection = detections.reduce((best, current) => 
                current.detection.score > best.detection.score ? current : best
              );
              
              embedding = Array.from(bestDetection.descriptor);
              console.log('[FacialLogin] ✅ Embedding generado con configuración alternativa');
            }
          }
        } catch (lastError) {
          console.error('[FacialLogin] Error en último recurso:', lastError);
        }
      }
      
      if (!embedding) {
        throw new Error('No se pudo generar el embedding facial después de múltiples intentos. Intente con mejor iluminación.');
      }
      
      // Validar calidad del embedding antes de usar
      const validation = embeddingService.validateEmbeddingQuality(embedding, true); // true = configuración alternativa
      if (!validation.isValid) {
        throw new Error(`Calidad del embedding insuficiente: ${validation.reason}`);
      }
      
      console.log(`[FacialLogin] Embedding final validado - Calidad: ${validation.qualityScore.toFixed(3)}`);
      console.log('[FacialLogin] Enviando embedding al servidor para verificación...');
      setStatus('verificando_identidad');
      
      const result = await ApiService.loginFace(embedding);
      
      // Ahora sí detener el bucle de detección
      isRunning.current = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      
      if (result.success && result.userToken) {
        console.log('[FacialLogin] Login exitoso');
        setStatus('login_exitoso');
        onLoginComplete(true, result.userToken);
      } else {
        console.log('[FacialLogin] Login fallido:', result.error);
        setStatus('error_login');
        setErrorMessage(result.error || 'Rostro no reconocido. Intente nuevamente o registre su rostro primero.');
      }
      
    } catch (error) {
      console.error('[FacialLogin] Error en verificación final:', error);
      
      // Asegurar que el bucle se detenga en caso de error
      isRunning.current = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      
      setStatus('error_login');
      setErrorMessage(error instanceof Error ? error.message : 'Error durante la verificación. Intente nuevamente.');
    }
  };

  // Reintentar todo el proceso
  const handleRetry = () => {
    console.log('[FacialLogin] Reiniciando proceso...');
    
    isRunning.current = false;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    setStatus('inicializando');
    setErrorMessage('');
    setFaceDetected(false);
    setFaceQuality('low');
    setCurrentChallenge('sonrisa');
    setChallengeProgress(0);
    setCompletedChallenges([]);
    challengeCounter.current = 0;
    stableFrameCounter.current = 0;
    frameCount.current = 0;
    nosePositionHistory.current = [];
    blinkHistory.current = [];
    
    stopCamera();
    setTimeout(() => startCamera(), 1000);
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
          ? `Rostro detectado - Calidad: ${faceQuality === 'high' ? 'Alta' : faceQuality === 'medium' ? 'Media' : 'Baja'}` 
          : 'Posiciónese frente a la cámara...',
        icon: <FaEye className="w-5 h-5" />
      },
      'challenge_sonrisa': { 
        backgroundColor: '#95b54c',
        text: 'Verificación de vida activa',
        icon: <FaSmile className="w-5 h-5" />
      },
      'challenge_parpadeo': { 
        backgroundColor: '#54a8a0',
        text: 'Verificación de vida activa',
        icon: <FaEye className="w-5 h-5" />
      },
      'challenge_asentir': { 
        backgroundColor: '#607123',
        text: 'Verificación de vida activa',
        icon: <FaArrowDown className="w-5 h-5" />
      },
      'liveness_completado': { 
        backgroundColor: '#cbe552',
        text: 'Verificación de vida completada',
        icon: <FaCheck className="w-5 h-5" />
      },
      'generando_embedding': { 
        backgroundColor: '#54a8a0',
        text: 'Procesando imagen facial...',
        icon: <FaSyncAlt className="w-5 h-5 animate-spin" />
      },
      'verificando_identidad': { 
        backgroundColor: '#3e5866',
        text: 'Verificando identidad...',
        icon: <FaSyncAlt className="w-5 h-5 animate-spin" />
      },
      'login_exitoso': { 
        backgroundColor: '#cbe552',
        text: 'Acceso autorizado',
        icon: <FaCheck className="w-5 h-5" />
      },
      'error_login': { 
        backgroundColor: '#dc2626',
        text: 'Error de autenticación',
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
              <span>Desafíos: {completedChallenges.length}/3</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // Renderizar las instrucciones del desafío actual
  const renderChallengeInstructions = () => {
    const challenges = [
      {
        id: 'sonrisa',
        icon: <FaSmile className="w-6 h-6" />,
        title: 'Sonría',
        description: 'Sonría naturalmente',
        completed: completedChallenges.includes('sonrisa')
      },
      {
        id: 'parpadeo',
        icon: <FaEye className="w-6 h-6" />,
        title: 'Parpadee',
        description: 'Parpadee dos veces',
        completed: completedChallenges.includes('parpadeo')
      },
      {
        id: 'asentir',
        icon: <FaArrowDown className="w-6 h-6" />,
        title: 'Asiente',
        description: 'Mueva la cabeza arriba y abajo',
        completed: completedChallenges.includes('asentir')
      }
    ];

  return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
      >
        <div className="flex items-center space-x-3 mb-4">
          <div className="text-white p-2 rounded-xl" style={{backgroundColor: '#3e5866'}}>
            <FaUser className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-lg" style={{color: '#3e5866'}}>Verificación de Identidad</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {challenges.map((challenge) => (
            <motion.div 
              key={challenge.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="p-4 rounded-xl border-2 transition-all duration-300 bg-white"
              style={{
                borderColor: challenge.completed 
                  ? '#cbe552' 
                  : currentChallenge === challenge.id 
                    ? '#54a8a0' 
                    : '#e5e7eb',
                backgroundColor: challenge.completed 
                  ? '#f0f9e8' 
                  : currentChallenge === challenge.id 
                    ? '#f0f8f7' 
                    : 'white'
              }}
            >
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 rounded-xl text-white"
                style={{
                  backgroundColor: challenge.completed 
                    ? '#cbe552' 
                    : currentChallenge === challenge.id 
                      ? '#3e5866' 
                      : '#9ca3af'
                }}
                >
                  {challenge.completed ? <FaCheck className="w-5 h-5" /> : challenge.icon}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800">{challenge.title}</h4>
                  <p className="text-sm text-gray-600">{challenge.description}</p>
                </div>
              </div>
              
              {currentChallenge === challenge.id && !challenge.completed && (
                <div className="mt-3">
                  <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                    <motion.div 
                      className="h-2 rounded-full"
                      style={{backgroundColor: '#54a8a0'}}
                      initial={{ width: 0 }}
                      animate={{ width: `${challengeProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    {Math.round(challengeProgress)}% completado
                  </p>
                </div>
            )}
            
              {challenge.completed && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 text-center"
                >
                  <span className="inline-flex items-center space-x-1 text-sm font-medium" style={{color: '#607123'}}>
                    <FaCheck className="w-3 h-3" />
                    <span>Completado</span>
                  </span>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="facial-login max-w-4xl mx-auto p-4">
      {/* Header moderno */}
      <div className="rounded-xl p-6 mb-6 shadow-xl" style={{
        background: 'linear-gradient(135deg, #3e5866 0%, #54a8a0 100%)'
      }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-white bg-opacity-20 p-3 rounded-xl">
              <FaUser className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Autenticación Biométrica</h2>
              <p className="text-gray-200">Verificación segura por reconocimiento facial</p>
            </div>
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
                <div className={`border-4 rounded-lg transition-all duration-300`} 
                style={{ 
                  width: '320px', 
                  height: '240px',
                  borderColor: faceQuality === 'high' 
                    ? '#cbe552' 
                    : faceQuality === 'medium' 
                      ? '#95b54c' 
                      : '#dc2626',
                  boxShadow: faceQuality === 'high' 
                    ? '0 0 20px rgba(203, 229, 82, 0.3)' 
                    : faceQuality === 'medium' 
                      ? '0 0 20px rgba(149, 181, 76, 0.3)' 
                      : '0 0 20px rgba(220, 38, 38, 0.3)'
                }} />
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
                  className="px-3 py-2 rounded-lg text-sm font-semibold backdrop-blur-md border text-white"
                  style={{
                    backgroundColor: faceQuality === 'high' 
                      ? '#cbe552' 
                      : faceQuality === 'medium' 
                        ? '#95b54c' 
                        : '#dc2626',
                    borderColor: faceQuality === 'high' 
                      ? '#cbe552' 
                      : faceQuality === 'medium' 
                        ? '#95b54c' 
                        : '#dc2626'
                  }}
                >
                  Calidad: {faceQuality === 'high' ? 'Excelente' : faceQuality === 'medium' ? 'Media' : 'Baja'}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Estado del desafío */}
          <div className="absolute top-4 right-4">
            <AnimatePresence>
              {['challenge_sonrisa', 'challenge_parpadeo', 'challenge_asentir'].includes(status) && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="text-white px-4 py-2 rounded-lg text-sm font-semibold backdrop-blur-md border"
                  style={{
                    backgroundColor: 'rgba(62, 88, 102, 0.9)',
                    borderColor: '#54a8a0'
                  }}
                >
                  <div className="flex items-center space-x-2">
                    {currentChallenge === 'sonrisa' && <FaSmile className="w-3 h-3" />}
                    {currentChallenge === 'parpadeo' && <FaEye className="w-3 h-3" />}
                    {currentChallenge === 'asentir' && <FaArrowDown className="w-3 h-3" />}
                    <span>{Math.round(challengeProgress)}%</span>
              </div>
                </motion.div>
              )}
            </AnimatePresence>
            </div>
            
          <canvas ref={canvasRef} className="hidden" />
                </div>
              </div>
            
      {/* Instrucciones del desafío */}
      <AnimatePresence>
        {['challenge_sonrisa', 'challenge_parpadeo', 'challenge_asentir'].includes(status) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6"
          >
            {renderChallengeInstructions()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mensajes de error y éxito */}
      <AnimatePresence>
        {status === 'error_login' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-red-50 border border-red-200 rounded-xl p-6"
          >
            <div className="flex items-start space-x-4">
              <div className="bg-red-500 text-white p-2 rounded-xl">
                <FaExclamationTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-red-800 font-semibold text-lg">Error de Autenticación</h3>
                <p className="text-red-600 mt-1">{errorMessage}</p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
                  onClick={handleRetry}
                  className="mt-4 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2"
            >
                  <FaSyncAlt className="w-4 h-4" />
                  <span>Intentar de Nuevo</span>
            </motion.button>
              </div>
            </div>
          </motion.div>
        )}
            
        {status === 'login_exitoso' && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="bg-green-50 border border-green-200 rounded-xl p-6"
          >
            <div className="flex items-start space-x-4">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5 }}
                className="bg-green-500 text-white p-2 rounded-xl"
              >
                <FaCheck className="w-5 h-5" />
              </motion.div>
              <div className="flex-1">
                <h3 className="text-green-800 font-semibold text-lg">Acceso Autorizado</h3>
                <p className="text-green-600 mt-1">
                  Su identidad ha sido verificada correctamente. Bienvenido al sistema.
                </p>
          </div>
            </div>
          </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
};

export default FacialLogin;

import { FaceLandmarker, FaceLandmarkerResult, FilesetResolver } from '@mediapipe/tasks-vision';

interface MediaPipeServiceState {
  faceLandmarker: FaceLandmarker | null;
  isInitialized: boolean;
  isInitializing: boolean;
  initError: Error | null;
}

class MediaPipeService {
  private static instance: MediaPipeService;
  private state: MediaPipeServiceState = {
    faceLandmarker: null,
    isInitialized: false,
    isInitializing: false,
    initError: null,
  };

  // Contador para evitar spam de logs
  private errorCount = 0;
  private lastErrorTime = 0;
  private readonly MAX_ERRORS_PER_SECOND = 5;

  private constructor() {}

  public static getInstance(): MediaPipeService {
    if (!MediaPipeService.instance) {
      MediaPipeService.instance = new MediaPipeService();
    }
    return MediaPipeService.instance;
  }

  /**
   * Log controlado para evitar spam
   */
  private logError(message: string, error?: any) {
    const now = Date.now();
    if (now - this.lastErrorTime > 1000) {
      this.errorCount = 0;
      this.lastErrorTime = now;
    }
    
    this.errorCount++;
    if (this.errorCount <= this.MAX_ERRORS_PER_SECOND) {
      console.error(`[MediaPipe] ${message}`, error);
      if (this.errorCount === this.MAX_ERRORS_PER_SECOND) {
        console.error('[MediaPipe] Demasiados errores, silenciando logs por 1 segundo...');
      }
    }
  }

  /**
   * Inicializa el FaceLandmarker de MediaPipe
   */
  public async initialize(): Promise<void> {
    // Si ya está inicializado o está en proceso, no hacer nada
    if (this.state.isInitialized || this.state.isInitializing) {
      console.log('[MediaPipe] Ya está inicializado o en proceso de inicialización');
      return;
    }

    try {
      console.log('[MediaPipe] Iniciando inicialización...');
      this.state.isInitializing = true;
      this.state.initError = null;

      // Cargar los archivos WASM y el modelo
      console.log('[MediaPipe] Cargando FilesetResolver...');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      console.log('[MediaPipe] Creando FaceLandmarker...');
      // Crear el FaceLandmarker con configuración más conservadora
      this.state.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'CPU' // Cambiar a CPU para evitar problemas con GPU
        },
        runningMode: 'VIDEO',
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
        numFaces: 1
      });

      this.state.isInitialized = true;
      console.log('[MediaPipe] Inicialización completada exitosamente');
    } catch (error) {
      this.state.initError = error instanceof Error ? error : new Error('Unknown error during initialization');
      console.error('[MediaPipe] Error durante la inicialización:', error);
      throw this.state.initError;
    } finally {
      this.state.isInitializing = false;
    }
  }

  /**
   * Detecta landmarks faciales en un frame de video
   */
  public detectFaceInVideo(videoElement: HTMLVideoElement, timestamp: number): FaceLandmarkerResult | null {
    if (!this.state.isInitialized || !this.state.faceLandmarker) {
      // Solo loggear este error ocasionalmente
      if (Math.random() < 0.01) { // 1% de probabilidad
        console.warn('[MediaPipe] FaceLandmarker no está inicializado');
      }
      return null;
    }

    // Verificar que el video esté listo
    if (!videoElement || videoElement.readyState < 2) {
      return null;
    }

    try {
      const result = this.state.faceLandmarker.detectForVideo(videoElement, timestamp);
      return result;
    } catch (error) {
      this.logError('Error detectando rostros:', error);
      return null;
    }
  }

  /**
   * Verifica si hay un rostro detectado en el resultado
   */
  public hasFaceDetected(result: FaceLandmarkerResult | null): boolean {
    if (!result) return false;
    
    try {
      return result.faceLandmarks && result.faceLandmarks.length > 0;
    } catch (error) {
      this.logError('Error verificando detección de rostro:', error);
      return false;
    }
  }

  /**
   * Verifica si el usuario está sonriendo basándose en los blendshapes
   */
  public isSmiling(result: FaceLandmarkerResult | null): boolean {
    if (!result || !result.faceBlendshapes || result.faceBlendshapes.length === 0) {
      return false;
    }

    try {
      const blendshapes = result.faceBlendshapes[0].categories;
      const mouthSmileLeft = blendshapes.find(b => b.categoryName === 'mouthSmileLeft')?.score || 0;
      const mouthSmileRight = blendshapes.find(b => b.categoryName === 'mouthSmileRight')?.score || 0;

      // Se considera sonrisa si ambos lados están sonriendo con un umbral de 0.3 (más permisivo)
      return mouthSmileLeft > 0.3 && mouthSmileRight > 0.3;
    } catch (error) {
      this.logError('Error detectando sonrisa:', error);
      return false;
    }
  }

  /**
   * Verifica si el usuario está parpadeando basándose en los blendshapes
   */
  public isBlinking(result: FaceLandmarkerResult | null): boolean {
    if (!result || !result.faceBlendshapes || result.faceBlendshapes.length === 0) {
      return false;
    }

    try {
      const blendshapes = result.faceBlendshapes[0].categories;
      const eyeBlinkLeft = blendshapes.find(b => b.categoryName === 'eyeBlinkLeft')?.score || 0;
      const eyeBlinkRight = blendshapes.find(b => b.categoryName === 'eyeBlinkRight')?.score || 0;

      // Se considera parpadeo si ambos ojos están cerrados con un umbral de 0.5
      return eyeBlinkLeft > 0.5 && eyeBlinkRight > 0.5;
    } catch (error) {
      this.logError('Error detectando parpadeo:', error);
      return false;
    }
  }

  /**
   * Verifica si el usuario está asintiendo con la cabeza
   * Esta es una implementación básica, basada en el movimiento vertical de la nariz
   */
  public isNodding(currentResult: FaceLandmarkerResult | null, previousPositions: number[]): boolean {
    if (!currentResult || !currentResult.faceLandmarks || currentResult.faceLandmarks.length === 0) {
      return false;
    }

    try {
      // Verificar que tenemos landmarks válidos
      const landmarks = currentResult.faceLandmarks[0];
      if (!landmarks || landmarks.length < 2) {
        return false;
      }

      // Punto de la nariz (índice 1 es más seguro que 0)
      const noseY = landmarks[1]?.y;
      if (typeof noseY !== 'number') {
        return false;
      }
      
      // Necesitamos un historial para detectar el movimiento
      if (previousPositions.length < 10) {
        return false;
      }

      // Algoritmo simple para detectar un movimiento hacia abajo y luego hacia arriba
      const recentPositions = previousPositions.slice(-10);
      const minY = Math.min(...recentPositions);
      const maxY = Math.max(...recentPositions);
      const range = maxY - minY;

      // Si el rango de movimiento es significativo y hemos visto un patrón de subida y bajada
      return range > 0.05 && 
             recentPositions.indexOf(maxY) < recentPositions.indexOf(minY) && 
             recentPositions.indexOf(minY) > recentPositions.length / 2;
    } catch (error) {
      this.logError('Error detectando asentimiento:', error);
      return false;
    }
  }

  /**
   * Libera los recursos del faceLandmarker
   */
  public dispose(): void {
    try {
      if (this.state.faceLandmarker) {
        this.state.faceLandmarker.close();
        this.state.faceLandmarker = null;
        this.state.isInitialized = false;
        console.log('[MediaPipe] Recursos liberados');
      }
    } catch (error) {
      console.error('[MediaPipe] Error liberando recursos:', error);
    }
  }

  /**
   * Verifica si el servicio está inicializado
   */
  public isInitialized(): boolean {
    return this.state.isInitialized;
  }

  /**
   * Retorna el error de inicialización, si existe
   */
  public getInitError(): Error | null {
    return this.state.initError;
  }
}

export default MediaPipeService;

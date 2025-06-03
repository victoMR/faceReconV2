import * as faceapi from 'face-api.js';

interface FaceEmbeddingServiceState {
  isInitialized: boolean;
  isInitializing: boolean;
  initError: Error | null;
}

class FaceEmbeddingService {
  private static instance: FaceEmbeddingService;
  private state: FaceEmbeddingServiceState = {
    isInitialized: false,
    isInitializing: false,
    initError: null,
  };

  private constructor() {}

  public static getInstance(): FaceEmbeddingService {
    if (!FaceEmbeddingService.instance) {
      FaceEmbeddingService.instance = new FaceEmbeddingService();
    }
    return FaceEmbeddingService.instance;
  }

  /**
   * Inicializa los modelos de face-api.js necesarios para generar embeddings
   */
  public async initialize(): Promise<void> {
    if (this.state.isInitialized || this.state.isInitializing) {
      return;
    }

    try {
      this.state.isInitializing = true;
      this.state.initError = null;

      // Cargar los modelos necesarios desde CDN
      const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
      
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL), 
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
      ]);

      this.state.isInitialized = true;
      console.log('FaceEmbeddingService inicializado correctamente');
    } catch (error) {
      this.state.initError = error instanceof Error ? error : new Error('Error desconocido durante la inicialización');
      console.error('Error inicializando FaceEmbeddingService:', error);
      throw this.state.initError;
    } finally {
      this.state.isInitializing = false;
    }
  }

  /**
   * Genera un embedding facial a partir de un elemento de video o imagen
   */
  public async generateFaceEmbedding(element: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<number[] | null> {
    if (!this.state.isInitialized) {
      throw new Error('FaceEmbeddingService no está inicializado. Llame a initialize() primero.');
    }

    try {
      console.log('[FaceEmbeddingService] Iniciando detección facial para embedding...');
      
      // Configuraciones de detección en orden de preferencia (de más estricta a más permisiva)
      const detectionConfigs = [
        // Configuración estándar
        new faceapi.TinyFaceDetectorOptions({ 
          inputSize: 416, 
          scoreThreshold: 0.5 
        }),
        // Configuración más permisiva
        new faceapi.TinyFaceDetectorOptions({ 
          inputSize: 320, 
          scoreThreshold: 0.4 
        }),
        // Configuración muy permisiva
        new faceapi.TinyFaceDetectorOptions({ 
          inputSize: 224, 
          scoreThreshold: 0.3 
        })
      ];

      for (let i = 0; i < detectionConfigs.length; i++) {
        const config = detectionConfigs[i];
        console.log(`[FaceEmbeddingService] Probando configuración ${i + 1}/${detectionConfigs.length}...`);
        
        try {
          // Detectar rostros con landmarks y descriptores
          const detections = await faceapi
            .detectAllFaces(element, config)
            .withFaceLandmarks()
            .withFaceDescriptors();

          console.log(`[FaceEmbeddingService] Configuración ${i + 1}: ${detections.length} rostro(s) detectado(s)`);

          if (detections.length > 0) {
            // Tomar el rostro con mayor puntuación de confianza
            const bestDetection = detections.reduce((best, current) => 
              current.detection.score > best.detection.score ? current : best
            );
            
            console.log(`[FaceEmbeddingService] ✅ Rostro seleccionado con confianza: ${bestDetection.detection.score.toFixed(3)}`);
            
            // Convertir Float32Array a Array de números
            const embedding = Array.from(bestDetection.descriptor);
            console.log(`[FaceEmbeddingService] ✅ Embedding generado: ${embedding.length} dimensiones`);
            
            return embedding;
          }
        } catch (configError) {
          console.warn(`[FaceEmbeddingService] Error con configuración ${i + 1}:`, configError);
          continue;
        }
      }

      // Si llegamos aquí, ninguna configuración funcionó
      console.error('[FaceEmbeddingService] ❌ No se detectaron rostros con ninguna configuración');
      
      // Como último recurso, intentar detección simple sin landmarks
      try {
        console.log('[FaceEmbeddingService] Intentando detección simple como último recurso...');
        const simpleDetections = await faceapi.detectAllFaces(
          element, 
          new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.2 })
        );
        
        console.log(`[FaceEmbeddingService] Detección simple: ${simpleDetections.length} rostro(s)`);
        
        if (simpleDetections.length > 0) {
          console.warn('[FaceEmbeddingService] ⚠️ Rostro detectado pero sin descriptores válidos');
        }
      } catch (lastResortError) {
        console.error('[FaceEmbeddingService] Error en detección de último recurso:', lastResortError);
      }
      
      return null;
    } catch (error) {
      console.error('[FaceEmbeddingService] Error crítico generando embedding facial:', error);
      return null;
    }
  }

  /**
   * Genera múltiples embeddings faciales de un elemento
   */
  public async generateMultipleFaceEmbeddings(
    element: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement, 
    count: number = 3,
    delayMs: number = 1000
  ): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    for (let i = 0; i < count; i++) {
      if (i > 0) {
        // Esperar entre capturas para obtener diferentes poses/expresiones
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      const embedding = await this.generateFaceEmbedding(element);
      if (embedding) {
        embeddings.push(embedding);
      }
    }
    
    return embeddings;
  }

  /**
   * Captura un frame del video en un canvas para procesamiento
   */
  public captureVideoFrame(videoElement: HTMLVideoElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    
    // Configurar contexto 2D con optimización para múltiples operaciones getImageData
    let ctx: CanvasRenderingContext2D | null;
    try {
      ctx = canvas.getContext('2d', { willReadFrequently: true });
    } catch (e) {
      // Fallback para navegadores que no soportan willReadFrequently
      ctx = canvas.getContext('2d');
    }
    
    if (!ctx) {
      throw new Error('No se pudo obtener el contexto 2D del canvas');
    }

    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    return canvas;
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

export default FaceEmbeddingService; 
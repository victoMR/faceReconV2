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
            
            // Validar calidad del embedding antes de devolverlo
            const validation = this.validateEmbeddingQuality(embedding, i > 0); // Más permisivo para configuraciones 2 y 3
            if (!validation.isValid) {
              console.warn(`[FaceEmbeddingService] ⚠️ Embedding generado pero con baja calidad: ${validation.reason}`);
              // Continuar con la siguiente configuración en lugar de devolver embedding de baja calidad
              continue;
            }
            
            console.log(`[FaceEmbeddingService] ✅ Embedding validado: ${embedding.length} dimensiones, calidad: ${validation.qualityScore.toFixed(3)}`);
            
            return embedding;
          }
        } catch (configError) {
          console.warn(`[FaceEmbeddingService] Error con configuración ${i + 1}:`, configError);
          continue;
        }
      }

      // Si llegamos aquí, ninguna configuración funcionó
      console.error('[FaceEmbeddingService] ❌ No se detectaron rostros válidos con ninguna configuración');
      
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
   * Valida la calidad de un embedding facial
   */
  public validateEmbeddingQuality(embedding: number[], isAlternativeConfig: boolean = false): { isValid: boolean; reason: string; qualityScore: number } {
    if (!embedding || !Array.isArray(embedding)) {
      return { isValid: false, reason: 'Embedding no es un array válido', qualityScore: 0 };
    }

    if (embedding.length !== 128) {
      return { isValid: false, reason: `Dimensión incorrecta: ${embedding.length}, esperado: 128`, qualityScore: 0 };
    }

    // Verificar que no sea un embedding vacío o corrupto
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude < 0.001) {
      return { isValid: false, reason: 'Magnitud muy baja (posiblemente corrupto)', qualityScore: 0 };
    }

    // Verificar que no todos los valores sean iguales
    const uniqueValues = new Set(embedding.map(v => Math.round(v * 10000))).size; // Más precisión
    if (uniqueValues < 5) {
      return { isValid: false, reason: 'Muy poca variabilidad en los datos', qualityScore: 0 };
    }

    // Verificar que no haya valores extremos (más permisivo)
    const hasExtremeValues = embedding.some(val => Math.abs(val) > 50);
    if (hasExtremeValues) {
      return { isValid: false, reason: 'Contiene valores extremos', qualityScore: 0 };
    }

    // Calcular score de calidad mejorado
    const variance = embedding.reduce((sum, val, _, arr) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      return sum + Math.pow(val - mean, 2);
    }, 0) / embedding.length;

    // Fórmula mejorada de calidad
    const magnitudeScore = Math.min(1.0, magnitude / 5); // Más permisivo
    const varianceScore = Math.min(1.0, Math.sqrt(variance) / 1.5); // Más permisivo
    const diversityScore = Math.min(1.0, uniqueValues / 50); // Basado en diversidad
    
    const qualityScore = (magnitudeScore * 0.4 + varianceScore * 0.4 + diversityScore * 0.2);

    // Thresholds ajustados según el contexto
    let minQuality: number;
    if (isAlternativeConfig) {
      minQuality = 0.05; // 5% para configuraciones alternativas (muy permisivo)
    } else {
      minQuality = 0.15; // 15% para configuraciones normales (más permisivo que antes)
    }

    const isValid = qualityScore >= minQuality;

    return {
      isValid,
      reason: isValid ? 'Embedding válido' : `Calidad insuficiente: ${qualityScore.toFixed(3)} (mínimo: ${minQuality})`,
      qualityScore
    };
  }

  /**
   * Calcula similitud coseno entre dos embeddings
   */
  public calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
      return 0;
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
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
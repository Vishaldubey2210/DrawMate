import { operationalMetrics } from './OperationalMetrics.js';

export interface SketchPredictionItem {
  class_name: string;
  confidence: number;
}

export interface SketchPredictResult {
  recognized: boolean;
  top_predictions: SketchPredictionItem[];
  confidence: number;
  message?: string;
  serviceAvailable: boolean;
}

export class SketchRecognizerClient {
  private static serviceUrl =
    process.env.SKETCH_RECOGNIZER_URL ||
    process.env.SKETCH_SERVICE_URL ||
    'http://localhost:8000';

  /**
   * Health check for ML model prediction service
   */
  public static async checkHealth(): Promise<{
    available: boolean;
    modelLoaded: boolean;
    classes: string[];
    numClasses: number;
  }> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`${this.serviceUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data: any = await res.json();
        return {
          available: true,
          modelLoaded: Boolean(data.model_loaded),
          classes: data.classes || [],
          numClasses: data.num_classes || 0,
        };
      }
    } catch {
      // Degraded / offline status
    }

    return {
      available: false,
      modelLoaded: false,
      classes: [],
      numClasses: 0,
    };
  }

  /**
   * Submits a practice drawing for ML classification
   */
  public static async predictSketch(
    imageBase64: string,
    topK: number = 3
  ): Promise<SketchPredictResult> {
    const startMs = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${this.serviceUrl}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64, top_k: topK }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const elapsedMs = Date.now() - startMs;

      if (res.ok) {
        const data: any = await res.json();
        operationalMetrics.recordSketchInference(elapsedMs, true);
        return {
          recognized: Boolean(data.recognized),
          top_predictions: data.top_predictions || [],
          confidence: data.confidence ?? 0,
          message: data.message,
          serviceAvailable: true,
        };
      } else if (res.status === 503) {
        operationalMetrics.recordSketchInference(elapsedMs, false);
        return {
          recognized: false,
          top_predictions: [],
          confidence: 0,
          message: 'Sketch recognition model is currently offline or still training.',
          serviceAvailable: false,
        };
      }
    } catch (err: any) {
      operationalMetrics.recordSketchInference(Date.now() - startMs, false);
      console.warn('[SketchRecognizerClient] Inference service unreachable:', err?.message);
    }

    return {
      recognized: false,
      top_predictions: [],
      confidence: 0,
      message: 'AI Sketch Recognition service is offline. Please launch the inference server.',
      serviceAvailable: false,
    };
  }
}

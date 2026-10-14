import { api } from './api.js';

export interface SketchPrediction {
  class_name: string;
  confidence: number;
}

export interface PracticeHealthResponse {
  available: boolean;
  modelLoaded: boolean;
  classes: string[];
  numClasses: number;
}

export interface PracticePredictResponse {
  recognized: boolean;
  top_predictions: SketchPrediction[];
  confidence: number;
  message?: string;
  serviceAvailable: boolean;
}

export const practiceService = {
  /** Check AI service availability and loaded classes */
  async getHealth(): Promise<PracticeHealthResponse> {
    const res = await api.get<{ success: boolean } & PracticeHealthResponse>('/practice/health');
    return res.data;
  },

  /** Submit canvas base64 PNG for sketch classification */
  async predict(imageBase64: string, topK: number = 5): Promise<PracticePredictResponse> {
    const res = await api.post<{ success: boolean } & PracticePredictResponse>('/practice/predict', {
      image: imageBase64,
      topK,
    });
    return res.data;
  },
};

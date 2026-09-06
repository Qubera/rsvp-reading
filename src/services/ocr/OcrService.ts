/**
 * Архитектура OCR: движок-интерфейс + точка расширения.
 *
 * По умолчанию движок недоступен (Expo Go не содержит ML Kit). Для включения
 * реального OCR достаточно установить @react-native-ml-kit/text-recognition
 * (dev-сборка) и подставить реализацию ниже — весь остальной код не меняется.
 */

export interface OcrResult {
  text: string;
}

export interface OcrEngine {
  readonly id: string;
  readonly available: boolean;
  recognize(imageUri: string): Promise<OcrResult>;
}

export class OcrUnavailableError extends Error {
  constructor() {
    super('OCR engine is not available in this build');
    this.name = 'OcrUnavailableError';
  }
}

export class UnavailableOcrEngine implements OcrEngine {
  readonly id = 'unavailable';
  readonly available = false;

  async recognize(_imageUri: string): Promise<OcrResult> {
    throw new OcrUnavailableError();
  }
}

/**
 * Пример реализации для dev-сборки (подключить при необходимости):
 *
 * import TextRecognition from '@react-native-ml-kit/text-recognition';
 * export class MlKitOcrEngine implements OcrEngine {
 *   readonly id = 'mlkit';
 *   readonly available = true;
 *   async recognize(imageUri: string): Promise<OcrResult> {
 *     const result = await TextRecognition.process(imageUri);
 *     return { text: result.blocks.map(b => b.text).join('\n\n') };
 *   }
 * }
 */

export const ocrEngine: OcrEngine = new UnavailableOcrEngine();

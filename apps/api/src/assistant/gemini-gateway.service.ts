import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';

export interface GeminiPart {
  text?: string;
  functionCall?: {
    name: string;
    args?: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
  };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface GeminiGenerateRequest {
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: GeminiContent[];
  tools?: Array<{
    functionDeclarations: Array<Record<string, unknown>>;
  }>;
  toolConfig?: Record<string, unknown>;
  generationConfig?: Record<string, unknown>;
}

export interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: GeminiContent;
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
}

const RETRYABLE_STATUSES = new Set([401, 403, 429, 500, 502, 503, 504]);

@Injectable()
export class GeminiGatewayService {
  private rotationOffset = 0;

  async generate(
    model: string,
    apiKeys: string[],
    request: GeminiGenerateRequest,
  ): Promise<GeminiGenerateResponse> {
    let lastStatus: number | undefined;
    for (let attempt = 0; attempt < apiKeys.length; attempt += 1) {
      const keyIndex = (this.rotationOffset + attempt) % apiKeys.length;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKeys[keyIndex]!,
            },
            body: JSON.stringify(request),
            signal: controller.signal,
          },
        );
        lastStatus = response.status;
        if (response.ok) {
          this.rotationOffset = (keyIndex + 1) % apiKeys.length;
          return (await response.json()) as GeminiGenerateResponse;
        }
        if (!RETRYABLE_STATUSES.has(response.status)) {
          throw new BadGatewayException(
            `Gemini từ chối yêu cầu với mã ${response.status}. Hãy kiểm tra model đã cấu hình.`,
          );
        }
      } catch (error) {
        if (error instanceof BadGatewayException) throw error;
        lastStatus = undefined;
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new ServiceUnavailableException(
      lastStatus === 429
        ? 'Tất cả API key Gemini đang hết hạn mức. Vui lòng thử lại sau.'
        : 'Không thể kết nối Gemini bằng các API key đã cấu hình.',
    );
  }
}

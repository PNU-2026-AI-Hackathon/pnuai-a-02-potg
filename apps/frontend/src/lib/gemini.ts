import { extractStudioJson } from './studio-draft';

/**
 * Gemini에 JSON을 요구하는 호출.
 *
 * 기획서 생성과 항목 수정이 같은 방식으로 부르므로 한 곳에 둔다. 모델이 막히면
 * 다음 모델로 넘어가는 처리도 같아서, 따로 두면 한쪽만 고치는 일이 생긴다.
 */

export const allowedGeminiModels = [
  'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite',
  'gemini-3.5-flash', 'gemini-2.5-flash',
] as const;

export type GeminiModel = (typeof allowedGeminiModels)[number];

const fallbackModels = [process.env.GEMINI_MODEL, ...allowedGeminiModels]
  .filter((model): model is string => typeof model === 'string' && model.trim().length > 0)
  .map((model) => model.trim());

export function resolveModels(requested?: unknown) {
  const model = typeof requested === 'string' && allowedGeminiModels.includes(requested as GeminiModel)
    ? requested
    : null;
  return model ? [model] : fallbackModels;
}

function readText(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== 'object') return null;
  const body = responseBody as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = (body.candidates?.[0]?.content?.parts ?? []).map((part) => part.text || '').join('').trim();
  return text.length > 0 ? text : null;
}

/** 모델이 없거나 지원하지 않는다는 답이면 다음 모델로 넘어간다. */
function shouldTryNextModel(status: number, message: string) {
  const lower = message.toLowerCase();
  return status === 404 || status === 400 || lower.includes('not found') || lower.includes('not supported');
}

export type GeminiJsonResult =
  | { ok: true; value: unknown; model: string }
  | { ok: false; error: string; status: number };

export async function requestGeminiJson(
  apiKey: string,
  prompt: string,
  models: string[],
  temperature = 0.4,
): Promise<GeminiJsonResult> {
  let lastError = 'Gemini API 호출에 실패했습니다.';
  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature, responseMimeType: 'application/json' },
        }),
      },
    );
    const responseBody = await response.json();
    if (!response.ok) {
      lastError = responseBody?.error?.message || `Gemini API 호출에 실패했습니다. (${model})`;
      if (shouldTryNextModel(response.status, lastError)) continue;
      return { ok: false, error: lastError, status: 502 };
    }
    const text = readText(responseBody);
    if (!text) {
      lastError = 'Gemini 응답 본문을 읽지 못했습니다.';
      continue;
    }
    try {
      return { ok: true, value: JSON.parse(extractStudioJson(text)), model };
    } catch (error) {
      console.error('Gemini JSON parse failed:', error);
      return { ok: false, error: 'Gemini 응답을 JSON으로 읽지 못했습니다.', status: 502 };
    }
  }
  return { ok: false, error: lastError, status: 502 };
}

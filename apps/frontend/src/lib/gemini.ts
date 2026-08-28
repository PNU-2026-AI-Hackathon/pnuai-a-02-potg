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
  .map((model) => model.trim())
  .filter((model, index, models) => models.indexOf(model) === index);

export function resolveModels(requested?: unknown) {
  const model = typeof requested === 'string' && allowedGeminiModels.includes(requested as GeminiModel)
    ? requested
    : null;
  // 화면에서 고른 모델을 먼저 쓰되, 그 모델이 일시적으로 막히면 나머지를 시도한다.
  return model ? [model, ...fallbackModels.filter((candidate) => candidate !== model)] : fallbackModels;
}

const GEMINI_TIMEOUT_MS = 45_000;

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
    let response: Response;
    let responseBody: { error?: { message?: string }; candidates?: unknown[] };
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature, responseMimeType: 'application/json' },
          }),
          signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        },
      );
      responseBody = await response.json() as typeof responseBody;
    } catch (error) {
      lastError = error instanceof Error && error.name === 'TimeoutError'
        ? `Gemini 응답 시간이 초과되었습니다. (${model})`
        : `Gemini 서버에 연결하지 못했습니다. (${model})`;
      console.error('Gemini request failed:', model, error);
      continue;
    }
    if (!response.ok) {
      lastError = responseBody?.error?.message || `Gemini API 호출에 실패했습니다. (${model})`;
      // 잘못된 키(401/403)는 다른 모델에서도 같지만, 모델별 제한(429)이나
      // 일시 서버 장애(5xx)는 다음 모델에서 성공할 수 있다.
      if (shouldTryNextModel(response.status, lastError) || response.status === 429 || response.status >= 500) continue;
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
      lastError = `Gemini 응답을 JSON으로 읽지 못했습니다. (${model})`;
      continue;
    }
  }
  return { ok: false, error: lastError, status: 502 };
}

import { NextResponse } from 'next/server';
import {
  buildStudioPrompt,
  extractStudioJson,
  parseStudioDraft,
  type StudioGenerateRequest,
} from '@/lib/studio-draft';

const allowedGeminiModels = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash'] as const;
const defaultGeminiModels = [process.env.GEMINI_MODEL, ...allowedGeminiModels]
  .filter((model): model is string => typeof model === 'string' && model.trim().length > 0)
  .map((model) => model.trim());

function createDocumentId() {
  return `generated-${Date.now()}`;
}

function readGeminiText(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== 'object') {
    return null;
  }

  const body = responseBody as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const parts = body.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((part) => part.text || '').join('').trim();

  return text.length > 0 ? text : null;
}

function isUnsupportedModelError(message: string) {
  const lowerMessage = message.toLowerCase();

  return lowerMessage.includes('not found') || lowerMessage.includes('not supported');
}

async function generateDraftWithModel(model: string, apiKey: string, prompt: string, conditions: Record<string, string[]>, agenda: StudioGenerateRequest['agenda'], referencesMarkdown?: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: buildStudioPrompt({
                  prompt,
                  conditions,
                  agenda,
                  referencesMarkdown,
                }),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  const responseBody = await response.json();

  return { response, responseBody };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, { status: 500 });
    }

    const body = (await request.json()) as Partial<StudioGenerateRequest>;
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const conditions = body.conditions && typeof body.conditions === 'object' ? body.conditions : {};
    const agenda = body.agenda && typeof body.agenda === 'object' ? body.agenda : null;
    const referencesMarkdown = typeof body.referencesMarkdown === 'string' ? body.referencesMarkdown.slice(0, 30000) : undefined;
    const requestedModel = typeof body.model === 'string' && allowedGeminiModels.includes(body.model as typeof allowedGeminiModels[number])
      ? body.model
      : null;
    const geminiModels = requestedModel ? [requestedModel] : defaultGeminiModels;

    if (!prompt) {
      return NextResponse.json({ error: '프로그램 아이디어를 입력해 주세요.' }, { status: 400 });
    }

    let lastErrorMessage = 'Gemini API 호출에 실패했습니다.';
    let generatedText: string | null = null;
    let usedModel: string | null = null;

    for (const model of geminiModels) {
      const { response, responseBody } = await generateDraftWithModel(
        model,
        apiKey,
        prompt,
        conditions as Record<string, string[]>,
        agenda,
        referencesMarkdown,
      );

      if (!response.ok) {
        const errorMessage = responseBody?.error?.message || `Gemini API 호출에 실패했습니다. (${model})`;
        lastErrorMessage = errorMessage;

        if (response.status === 404 || response.status === 400 || isUnsupportedModelError(errorMessage)) {
          continue;
        }

        return NextResponse.json({ error: errorMessage }, { status: 502 });
      }

      generatedText = readGeminiText(responseBody);

      if (generatedText) {
        usedModel = model;
        break;
      }

      lastErrorMessage = 'Gemini 응답 본문을 읽지 못했습니다.';
    }

    if (!generatedText) {
      return NextResponse.json({ error: lastErrorMessage }, { status: 502 });
    }

    let parsedDraft = null;

    try {
      parsedDraft = parseStudioDraft(JSON.parse(extractStudioJson(generatedText)));
    } catch (error) {
      console.error('Studio draft parse failed:', error);
      return NextResponse.json({ error: 'Gemini 응답을 기획서 형식으로 변환하지 못했습니다.' }, { status: 502 });
    }

    if (!parsedDraft) {
      return NextResponse.json({ error: '기획서 초안 형식이 올바르지 않습니다.' }, { status: 502 });
    }

    const documentId = createDocumentId();

    return NextResponse.json({
      documentId,
      draft: {
        ...parsedDraft,
        id: documentId,
      },
      model: usedModel,
    });
  } catch (error) {
    console.error('Studio generate route failed:', error);

    return NextResponse.json({ error: '기획서 초안 생성 중 문제가 발생했습니다.' }, { status: 503 });
  }
}

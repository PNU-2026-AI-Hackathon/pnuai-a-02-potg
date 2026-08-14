import { NextResponse } from 'next/server';
import {
  buildStudioRevisionPrompt,
  extractStudioJson,
  parseStudioRevision,
  type StudioReviseRequest,
} from '@/lib/studio-draft';

const geminiModels = [process.env.GEMINI_MODEL, 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']
  .filter((model): model is string => typeof model === 'string' && model.trim().length > 0)
  .map((model) => model.trim());

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

async function reviseTextWithModel(model: string, apiKey: string, input: StudioReviseRequest) {
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
                text: buildStudioRevisionPrompt(input),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.35,
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

    const body = (await request.json()) as Partial<StudioReviseRequest>;
    const documentId = typeof body.documentId === 'string' ? body.documentId.trim() : '';
    const selectedText = typeof body.selectedText === 'string' ? body.selectedText.trim() : '';
    const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';
    const context = body.context && typeof body.context === 'object' ? body.context : {};

    if (!documentId) {
      return NextResponse.json({ error: '문서 정보를 찾지 못했습니다.' }, { status: 400 });
    }

    if (!selectedText) {
      return NextResponse.json({ error: '수정할 문장을 선택해 주세요.' }, { status: 400 });
    }

    if (!instruction) {
      return NextResponse.json({ error: '수정 요청을 입력해 주세요.' }, { status: 400 });
    }

    const reviseInput: StudioReviseRequest = {
      documentId,
      selectedText,
      instruction,
      context: {
        title: typeof context.title === 'string' ? context.title : '',
        before: typeof context.before === 'string' ? context.before : '',
        after: typeof context.after === 'string' ? context.after : '',
      },
    };
    let lastErrorMessage = 'Gemini API 호출에 실패했습니다.';
    let generatedText: string | null = null;

    for (const model of geminiModels) {
      const { response, responseBody } = await reviseTextWithModel(model, apiKey, reviseInput);

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
        break;
      }

      lastErrorMessage = 'Gemini 응답 본문을 읽지 못했습니다.';
    }

    if (!generatedText) {
      return NextResponse.json({ error: lastErrorMessage }, { status: 502 });
    }

    let parsedRevision = null;

    try {
      parsedRevision = parseStudioRevision(JSON.parse(extractStudioJson(generatedText)));
    } catch (error) {
      console.error('Studio revision parse failed:', error);
      return NextResponse.json({ error: 'Gemini 응답을 수정안 형식으로 변환하지 못했습니다.' }, { status: 502 });
    }

    if (!parsedRevision) {
      return NextResponse.json({ error: 'AI 수정안 형식이 올바르지 않습니다.' }, { status: 502 });
    }

    return NextResponse.json(parsedRevision);
  } catch (error) {
    console.error('Studio revise route failed:', error);

    return NextResponse.json({ error: 'AI 수정안 생성 중 문제가 발생했습니다.' }, { status: 503 });
  }
}

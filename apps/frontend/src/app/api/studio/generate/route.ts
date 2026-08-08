import { NextResponse } from 'next/server';
import {
  buildStudioPrompt,
  extractStudioJson,
  parseStudioDraft,
  type StudioGenerateRequest,
} from '@/lib/studio-draft';

const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

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

    if (!prompt) {
      return NextResponse.json({ error: '기획 메모를 입력해 주세요.' }, { status: 400 });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
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
                    conditions: conditions as Record<string, string[]>,
                    agenda,
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

    if (!response.ok) {
      return NextResponse.json(
        { error: responseBody?.error?.message || 'Gemini API 호출에 실패했습니다.' },
        { status: 502 },
      );
    }

    const generatedText = readGeminiText(responseBody);

    if (!generatedText) {
      return NextResponse.json({ error: 'Gemini 응답 본문을 읽지 못했습니다.' }, { status: 502 });
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

    return NextResponse.json({ draft: parsedDraft });
  } catch (error) {
    console.error('Studio generate route failed:', error);

    return NextResponse.json({ error: '기획서 초안 생성 중 문제가 발생했습니다.' }, { status: 503 });
  }
}
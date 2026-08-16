import { NextResponse } from 'next/server';
import { requestGeminiJson, resolveModels } from '@/lib/gemini';
import { buildStudioPlanPrompt, parseStudioPlan, type StudioPlanAgenda } from '@/lib/studio-plan-prompt';

/**
 * 기획서를 항목 구조로 만든다.
 *
 * 기존 `/api/studio/generate`는 항목이 일곱 개이고 회차가 문자열 목록이라
 * 항목 단위 수정과 표 형태 내보내기를 할 수 없다. 그 경로는 아직 쓰는 화면이 있어
 * 두고, 새 구조를 쓰는 화면은 이쪽을 부른다.
 */

export type StudioGeneratePlanRequest = {
  memo: string;
  conditions?: Record<string, string[]>;
  referencesMarkdown?: string;
  agenda?: StudioPlanAgenda | null;
  model?: string;
};

/** 보내온 의제를 읽는다. 제목과 내용이 있어야 기획의 근거가 되므로 둘 다 없으면 없는 것으로 본다. */
function readAgenda(value: unknown): StudioPlanAgenda | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const title = typeof source.title === 'string' ? source.title.trim() : '';
  const content = typeof source.content === 'string' ? source.content.trim() : '';
  if (!title || !content) return null;
  return {
    title,
    content,
    tags: Array.isArray(source.tags) ? source.tags.filter((tag): tag is string => typeof tag === 'string') : [],
  };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, { status: 500 });
    }

    const body = (await request.json()) as Partial<StudioGeneratePlanRequest>;
    const memo = typeof body.memo === 'string' ? body.memo.trim() : '';
    const agenda = readAgenda(body.agenda);
    /**
     * 메모와 의제 중 하나만 있으면 된다. 의제를 고르는 것 자체가 「이걸로 기획해 달라」는
     * 요청이라, 같은 말을 메모에 한 번 더 적게 할 이유가 없다.
     */
    if (!memo && !agenda) {
      return NextResponse.json({ error: '기획 메모를 적거나 지역 의제를 골라 주세요.' }, { status: 400 });
    }

    const prompt = buildStudioPlanPrompt({
      memo,
      conditions: body.conditions && typeof body.conditions === 'object' ? body.conditions : {},
      referencesMarkdown: typeof body.referencesMarkdown === 'string'
        ? body.referencesMarkdown.slice(0, 30000)
        : undefined,
      agenda,
    });

    const result = await requestGeminiJson(apiKey, prompt, resolveModels(body.model));
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { plan, missing } = parseStudioPlan(result.value);
    if (!plan.title) {
      return NextResponse.json({ error: '기획서 형식으로 읽지 못했습니다.' }, { status: 502 });
    }

    return NextResponse.json({
      documentId: `plan-${Date.now()}`,
      plan,
      // 비어 온 항목을 알려 준다. 화면에서 「이 항목은 다시 만들어 주세요」로 안내할 수 있다.
      missingFields: missing,
      model: result.model,
    });
  } catch (error) {
    /**
     * 원인을 함께 남긴다. `fetch failed`만으로는 Gemini가 거절한 것인지, 이 서버가
     * 바깥으로 나가지 못하는 것인지 구분할 수 없어 엉뚱한 곳을 고치게 된다.
     * 화면에는 내보내지 않는다. 내부 주소가 사용자에게 보일 이유가 없다.
     */
    console.error('Studio generate-plan route failed:', error, error instanceof Error ? error.cause : undefined);
    return NextResponse.json({ error: '기획서 생성 중 문제가 발생했습니다.' }, { status: 503 });
  }
}

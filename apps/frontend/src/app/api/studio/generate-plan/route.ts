import { NextResponse } from 'next/server';
import { requestGeminiJson, resolveModels } from '@/lib/gemini';
import { buildStudioPlanPrompt, parseStudioPlan } from '@/lib/studio-plan-prompt';

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
  model?: string;
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, { status: 500 });
    }

    const body = (await request.json()) as Partial<StudioGeneratePlanRequest>;
    const memo = typeof body.memo === 'string' ? body.memo.trim() : '';
    if (!memo) {
      return NextResponse.json({ error: '기획 메모를 입력해 주세요.' }, { status: 400 });
    }

    const prompt = buildStudioPlanPrompt({
      memo,
      conditions: body.conditions && typeof body.conditions === 'object' ? body.conditions : {},
      referencesMarkdown: typeof body.referencesMarkdown === 'string'
        ? body.referencesMarkdown.slice(0, 30000)
        : undefined,
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
    console.error('Studio generate-plan route failed:', error);
    return NextResponse.json({ error: '기획서 생성 중 문제가 발생했습니다.' }, { status: 503 });
  }
}

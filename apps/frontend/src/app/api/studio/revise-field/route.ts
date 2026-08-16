import { NextResponse } from 'next/server';
import { requestGeminiJson, resolveModels } from '@/lib/gemini';
import { studioPlanFieldMap, type StudioPlanFieldKey } from '@/lib/studio-plan';
import { buildStudioPlanRevisePrompt, parseStudioPlanField } from '@/lib/studio-plan-prompt';

/**
 * 기획서의 항목 하나만 고친다.
 *
 * 전체를 다시 만들지 않는 이유는 호출 비용 때문이다. 개발계획서가 이 기능을 둔 목적이
 * 그것이라, 고칠 항목과 지금 값, 수정 요청만 보낸다. 참고 사례 Markdown은 보내지 않는다.
 */

export type StudioReviseFieldRequest = {
  fieldKey: StudioPlanFieldKey;
  currentValue: unknown;
  instruction: string;
  planTitle?: string;
  planTarget?: string;
  model?: string;
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, { status: 500 });
    }

    const body = (await request.json()) as Partial<StudioReviseFieldRequest>;
    const fieldKey = typeof body.fieldKey === 'string' ? body.fieldKey as StudioPlanFieldKey : null;
    const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';
    const field = fieldKey ? studioPlanFieldMap.get(fieldKey) : null;

    if (!field) {
      return NextResponse.json({ error: '고칠 항목을 찾지 못했습니다.' }, { status: 400 });
    }
    if (field.manualOnly) {
      return NextResponse.json({ error: `${field.label}은(는) 사서가 직접 적는 항목입니다.` }, { status: 400 });
    }
    if (!instruction) {
      return NextResponse.json({ error: '어떻게 고칠지 적어 주세요.' }, { status: 400 });
    }

    const prompt = buildStudioPlanRevisePrompt({
      fieldKey: field.key,
      currentValue: body.currentValue ?? '',
      instruction,
      planTitle: typeof body.planTitle === 'string' ? body.planTitle : '',
      planTarget: typeof body.planTarget === 'string' ? body.planTarget : '',
    });

    const result = await requestGeminiJson(apiKey, prompt, resolveModels(body.model));
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const value = parseStudioPlanField(field.key, result.value);
    if (value === null) {
      return NextResponse.json({ error: `${field.label}을(를) 고친 결과를 읽지 못했습니다.` }, { status: 502 });
    }

    return NextResponse.json({ fieldKey: field.key, value, model: result.model });
  } catch (error) {
    console.error('Studio revise-field route failed:', error);
    return NextResponse.json({ error: '항목 수정 중 문제가 발생했습니다.' }, { status: 503 });
  }
}

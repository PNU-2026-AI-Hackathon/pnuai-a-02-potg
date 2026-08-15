'use client';

import { useRouter } from 'next/navigation';
import { studioGenerateRequestStorageKey, type StudioAgendaInput, type StudioGenerateRequest } from '@/lib/studio-draft';
import type { StudioConditionKey } from './studio-options';

type GenerateButtonProps = {
  canGenerate: boolean;
  prompt: string;
  conditions: Record<StudioConditionKey, string[]>;
  selectedAgenda: StudioAgendaInput | null;
};

export default function GenerateButton({
  canGenerate,
  prompt,
  conditions,
  selectedAgenda,
}: GenerateButtonProps) {
  const router = useRouter();

  function handleGenerate() {
    if (!canGenerate) {
      return;
    }

    const requestBody: StudioGenerateRequest = {
      prompt: prompt.trim(),
      conditions: conditions as Record<string, string[]>,
      agenda: selectedAgenda,
    };

    window.sessionStorage.setItem(studioGenerateRequestStorageKey, JSON.stringify(requestBody));
    router.push('/studio/generating');
  }

  return (
    <div className="studioGeneratePanel" aria-live="polite">
      <p>
        {canGenerate
          ? '기획 메모를 바탕으로 초안 작성 흐름을 시작합니다.'
          : '만들고 싶은 프로그램을 한 줄로 적어주세요.'}
      </p>
      <button
        className="uiButton uiButtonPrimary studioGenerateButton"
        disabled={!canGenerate}
        type="button"
        onClick={handleGenerate}
      >
        기획안 만들기 <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';

type GenerateButtonProps = {
  canGenerate: boolean;
};

export default function GenerateButton({
  canGenerate,
}: GenerateButtonProps) {
  const router = useRouter();

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
        onClick={() => router.push('/studio/generating')}
      >
        기획안 만들기 <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

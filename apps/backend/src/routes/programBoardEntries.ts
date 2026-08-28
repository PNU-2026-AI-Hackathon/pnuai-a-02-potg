import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma';

/**
 * 프로그램 게시판이 읽는 창구.
 *
 * 목록과 상세를 나눈 이유는 크기다. 정제 결과 한 건이 평균 19KB라 351건이면 6MB가 넘는다.
 * 목록 화면은 제목·도서관·대상·기간만 쓰므로, 전부를 실어 보내면 첫 화면이 그만큼 늦어진다.
 */

const router = Router();

/** 목록 화면이 거르고 세우는 데 쓰는 값. 정제 결과 전체는 상세에서만 내준다. */
const SUMMARY_FIELDS = {
  sourceId: true,
  seriesKey: true,
  title: true,
  libraryName: true,
  targetGroup: true,
  sourceUrl: true,
  occurrenceLabel: true,
  capacity: true,
  capacityText: true,
  programStartDate: true,
  programEndDate: true,
  applyStartDate: true,
  applyEndDate: true,
} as const;

router.get('/programs', async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.programBoardEntry.findMany({
      select: SUMMARY_FIELDS,
      // 모집 중을 앞에 세우는 일은 오늘 날짜에 달려 있어 화면이 한다.
      // 여기서는 그 정렬이 기대는 신청 시작일만 맞춰 둔다.
      orderBy: [{ applyStartDate: 'desc' }, { sourceId: 'desc' }],
    });

    /**
     * capacityText 는 정제 결과에서 evidence 아래에 있던 값이다. 화면이 쓰는 함수가
     * 상세와 목록 양쪽에 같이 쓰이므로, 칼럼으로 눕혀 둔 것을 원래 자리로 되돌려 보낸다.
     */
    const programs = rows.map(({ capacityText, ...row }) => ({
      ...row,
      evidence: { capacityText },
    }));

    return res.json({ programs });
  } catch (error) {
    console.error('Program board list failed:', error);

    return res.status(500).json({
      code: 'PROGRAM_BOARD_LIST_FAILED',
      error: 'Unable to load program board entries.',
    });
  }
});

router.get('/programs/:sourceId', async (req: Request<{ sourceId: string }>, res: Response) => {
  const sourceId = Number(req.params.sourceId);

  if (!Number.isInteger(sourceId)) {
    return res.status(400).json({ code: 'INVALID_SOURCE_ID', error: 'sourceId must be an integer.' });
  }

  try {
    const entry = await prisma.programBoardEntry.findUnique({
      where: { sourceId },
      select: { payload: true },
    });

    if (!entry) {
      return res.status(404).json({ code: 'PROGRAM_NOT_FOUND', error: 'Program not found.' });
    }

    return res.json({ program: entry.payload });
  } catch (error) {
    console.error('Program board detail failed:', error);

    return res.status(500).json({
      code: 'PROGRAM_BOARD_DETAIL_FAILED',
      error: 'Unable to load the program.',
    });
  }
});

export default router;

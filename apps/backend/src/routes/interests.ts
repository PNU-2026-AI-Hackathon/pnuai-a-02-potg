import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateJwt, requireStaffRole } from '../middleware/auth';

const router = Router();

type SaveUserInterestsBody = {
  interestIds?: unknown;
};

function readInterestIds(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  return [
    ...new Set(
      value
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
}

async function saveUserInterests(userId: string, interestIds: string[]) {
  const [user, interests] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    }),
    prisma.interest.findMany({
      where: { id: { in: interestIds } },
      select: { id: true },
    }),
  ]);

  if (!user) {
    return { status: 404 as const, body: { code: 'USER_NOT_FOUND', error: 'User not found.' } };
  }

  if (interests.length !== interestIds.length) {
    const validInterestIds = new Set(interests.map((interest) => interest.id));
    const invalidInterestIds = interestIds.filter((interestId) => !validInterestIds.has(interestId));

    return {
      status: 400 as const,
      body: {
        code: 'INVALID_INTEREST_IDS',
        error: 'One or more interest IDs do not exist.',
        invalidInterestIds,
      },
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.userInterest.deleteMany({ where: { userId } });

    if (interestIds.length > 0) {
      await tx.userInterest.createMany({
        data: interestIds.map((interestId) => ({ userId, interestId })),
      });
    }
  });

  const savedInterests = await prisma.userInterest.findMany({
    where: { userId },
    orderBy: { interest: { name: 'asc' } },
    select: {
      interest: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return {
    status: 200 as const,
    body: {
      userId,
      interests: savedInterests.map(({ interest }) => interest),
    },
  };
}

async function saveAuthenticatedUserInterests(req: Request<{}, {}, SaveUserInterestsBody>, res: Response) {
  if (!req.user) {
    return res.status(401).json({ code: 'AUTHENTICATION_REQUIRED', error: 'Authentication required.' });
  }

  try {
    const interestIds = readInterestIds(req.body.interestIds);

    if (!interestIds) {
      return res.status(400).json({ code: 'INVALID_BODY', error: 'interestIds must be an array.' });
    }

    const result = await saveUserInterests(req.user.id, interestIds);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('User interest save failed:', error);
    return res.status(500).json({ code: 'USER_INTEREST_SAVE_FAILED', error: 'Unable to save user interests.' });
  }
}

async function saveUserInterestsByParam(
  req: Request<{ userId: string }, {}, SaveUserInterestsBody>,
  res: Response,
) {
  try {
    const interestIds = readInterestIds(req.body.interestIds);

    if (!interestIds) {
      return res.status(400).json({ code: 'INVALID_BODY', error: 'interestIds must be an array.' });
    }

    const result = await saveUserInterests(req.params.userId, interestIds);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('User interest save failed:', error);
    return res.status(500).json({ code: 'USER_INTEREST_SAVE_FAILED', error: 'Unable to save user interests.' });
  }
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const interests = await prisma.interest.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
      },
    });

    return res.status(200).json({ interests });
  } catch (error) {
    console.error('Interest list lookup failed:', error);
    return res.status(500).json({ code: 'INTEREST_LIST_FAILED', error: 'Unable to load interests.' });
  }
});

router.get('/me', authenticateJwt, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ code: 'AUTHENTICATION_REQUIRED', error: 'Authentication required.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        interests: {
          orderBy: { interest: { name: 'asc' } },
          select: {
            interest: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', error: 'User not found.' });
    }

    return res.status(200).json({
      userId: user.id,
      interests: user.interests.map(({ interest }) => interest),
    });
  } catch (error) {
    console.error('User interest lookup failed:', error);
    return res.status(500).json({ code: 'USER_INTEREST_LOOKUP_FAILED', error: 'Unable to load user interests.' });
  }
});

router.put('/me', authenticateJwt, saveAuthenticatedUserInterests);
router.post('/me', authenticateJwt, saveAuthenticatedUserInterests);

router.get('/users/:userId', authenticateJwt, requireStaffRole, async (req: Request<{ userId: string }>, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: {
        id: true,
        interests: {
          orderBy: { interest: { name: 'asc' } },
          select: {
            interest: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', error: 'User not found.' });
    }

    return res.status(200).json({
      userId: user.id,
      interests: user.interests.map(({ interest }) => interest),
    });
  } catch (error) {
    console.error('User interest lookup failed:', error);
    return res.status(500).json({ code: 'USER_INTEREST_LOOKUP_FAILED', error: 'Unable to load user interests.' });
  }
});

router.put('/users/:userId', authenticateJwt, requireStaffRole, saveUserInterestsByParam);
router.post('/users/:userId', authenticateJwt, requireStaffRole, saveUserInterestsByParam);

export default router;

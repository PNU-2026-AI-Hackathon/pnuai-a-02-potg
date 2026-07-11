import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('Environment variable JWT_SECRET is required and must not be empty.');
}
const REQUIRED_JWT_SECRET: string = JWT_SECRET;

type AuthTokenPayload = jwt.JwtPayload & {
  sub: string;
};

type SaveUserInterestsBody = {
  interestIds?: unknown;
};

function getBearerToken(req: Request) {
  const authorization = req.header('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim() || null;
}

function getAuthenticatedUserId(req: Request) {
  const token = getBearerToken(req);

  if (!token) {
    return null;
  }

  const payload = jwt.verify(token, REQUIRED_JWT_SECRET) as AuthTokenPayload;
  return typeof payload.sub === 'string' ? payload.sub : null;
}

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
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({ code: 'AUTHENTICATION_REQUIRED', error: 'Authentication required.' });
    }

    const interestIds = readInterestIds(req.body.interestIds);

    if (!interestIds) {
      return res.status(400).json({ code: 'INVALID_BODY', error: 'interestIds must be an array.' });
    }

    const result = await saveUserInterests(userId, interestIds);
    return res.status(result.status).json(result.body);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ code: 'INVALID_TOKEN', error: 'Invalid or expired token.' });
    }

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

router.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({ code: 'AUTHENTICATION_REQUIRED', error: 'Authentication required.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
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
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ code: 'INVALID_TOKEN', error: 'Invalid or expired token.' });
    }

    console.error('User interest lookup failed:', error);
    return res.status(500).json({ code: 'USER_INTEREST_LOOKUP_FAILED', error: 'Unable to load user interests.' });
  }
});

router.put('/me', saveAuthenticatedUserInterests);
router.post('/me', saveAuthenticatedUserInterests);

router.get('/users/:userId', async (req: Request<{ userId: string }>, res: Response) => {
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

router.put('/users/:userId', saveUserInterestsByParam);
router.post('/users/:userId', saveUserInterestsByParam);

export default router;

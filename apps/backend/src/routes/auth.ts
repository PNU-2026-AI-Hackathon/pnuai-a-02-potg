import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('Environment variable JWT_SECRET is required and must not be empty.');
}
const JWT_EXPIRES_IN = '1h';

type AuthTokenPayload = jwt.JwtPayload & {
  sub: string;
  email: string;
  name: string;
};

type LoginRequestBody = {
  email?: string;
  password?: string;
};

type RegisterRequestBody = {
  name?: string;
  email?: string;
  password?: string;
};

function getBearerToken(req: Request) {
  const authorization = req.header('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim() || null;
}

router.post('/login', async (req: Request<{}, {}, LoginRequestBody>, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );

  return res.status(200).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
});

router.get('/me', async (req: Request, res: Response) => {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;

    if (typeof payload.sub !== 'string') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    console.error('Current user lookup failed:', error);
    return res.status(500).json({ error: 'Unable to load current user' });
  }
});

router.post('/register', async (req: Request<{}, {}, RegisterRequestBody>, res: Response) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }

  const exists = await prisma.user.findUnique({
    where: { email },
  });

  if (exists) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
    },
  });

  const token = jwt.sign(
    { sub: newUser.id, email: newUser.email, name: newUser.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );

  return res.status(201).json({
    token,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
    },
  });
});

export default router;

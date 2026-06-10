import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { users } from '../data/mockData';

const router = Router();

// Mock authentication backend: users are stored in-memory for local/demo use only.
// This implementation is not persistent and is not suitable for a production auth flow.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('Environment variable JWT_SECRET is required and must not be empty.');
}
const JWT_EXPIRES_IN = '1h';

type LoginRequestBody = {
  email?: string;
  password?: string;
};

type RegisterRequestBody = {
  name?: string;
  email?: string;
  password?: string;
};

router.post('/login', async (req: Request<{}, {}, LoginRequestBody>, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = users.find((item) => item.email === email);

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

router.post('/register', async (req: Request<{}, {}, RegisterRequestBody>, res: Response) => {
  const { name, email, password } = req.body;

  // NOTE: registration is handled by an in-memory mock data store.
  // New users are not persisted across server restarts.
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }

  const exists = users.some((item) => item.email === email);

  if (exists) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = { id: `u${users.length + 1}`, name, email, password: hashedPassword };
  users.push(newUser);

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

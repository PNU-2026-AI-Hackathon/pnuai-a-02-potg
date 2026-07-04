import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AccountType, Gender, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const router = Router();

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
  accountType?: string;
  userId?: string;
  name?: string;
  email?: string;
  password?: string;
  gender?: string | null;
  birthDate?: string;
  region?: string;
  phone?: string | null;
  interestIds?: string[];
};

const accountTypeMap: Record<string, AccountType> = {
  resident: AccountType.RESIDENT,
  librarian: AccountType.LIBRARIAN,
  admin: AccountType.ADMIN,
};

const genderMap: Record<string, Gender | null> = {
  female: Gender.FEMALE,
  male: Gender.MALE,
  other: Gender.OTHER,
  none: null,
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const userIdPattern = /^[a-zA-Z0-9_-]{4,30}$/;
const birthDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
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

router.post('/register', async (req: Request<{}, {}, RegisterRequestBody>, res: Response) => {
  const accountType = readString(req.body.accountType).toLowerCase();
  const userId = readString(req.body.userId);
  const name = readString(req.body.name);
  const email = readString(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const gender = readString(req.body.gender).toLowerCase() || 'none';
  const birthDate = readString(req.body.birthDate);
  const region = readString(req.body.region);
  const phone = readString(req.body.phone) || null;
  const interestIds = [
    ...new Set(
      (Array.isArray(req.body.interestIds) ? req.body.interestIds : [])
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];

  if (!accountType || !userId || !name || !email || !password || !birthDate || !region || interestIds.length === 0) {
    return res.status(400).json({
      code: 'MISSING_REQUIRED_FIELDS',
      error: '필수 회원가입 정보를 모두 입력해 주세요.',
    });
  }

  if (!Object.prototype.hasOwnProperty.call(accountTypeMap, accountType)) {
    return res.status(400).json({ code: 'INVALID_ACCOUNT_TYPE', error: '유효하지 않은 계정 유형입니다.' });
  }
  if (!Object.prototype.hasOwnProperty.call(genderMap, gender)) {
    return res.status(400).json({ code: 'INVALID_GENDER', error: '유효하지 않은 성별 값입니다.' });
  }
  if (!userIdPattern.test(userId)) {
    return res.status(400).json({
      code: 'INVALID_USER_ID',
      error: '회원 아이디는 영문, 숫자, 밑줄, 하이픈을 사용해 4~30자로 입력해 주세요.',
    });
  }
  if (!emailPattern.test(email)) {
    return res.status(400).json({ code: 'INVALID_EMAIL', error: '올바른 이메일 주소를 입력해 주세요.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ code: 'INVALID_PASSWORD', error: '비밀번호는 8자 이상이어야 합니다.' });
  }

  const parsedBirthDate = new Date(`${birthDate}T00:00:00.000Z`);
  if (
    !birthDatePattern.test(birthDate) ||
    Number.isNaN(parsedBirthDate.getTime()) ||
    parsedBirthDate.toISOString().slice(0, 10) !== birthDate ||
    parsedBirthDate >= new Date()
  ) {
    return res.status(400).json({ code: 'INVALID_BIRTH_DATE', error: '올바른 생년월일을 입력해 주세요.' });
  }

  try {
    const duplicateUsers = await prisma.user.findMany({
      where: { OR: [{ userId }, { email }] },
      select: { userId: true, email: true },
    });
    if (duplicateUsers.some((user) => user.userId === userId)) {
      return res.status(409).json({ code: 'USER_ID_TAKEN', error: '이미 사용 중인 회원 아이디입니다.' });
    }
    if (duplicateUsers.some((user) => user.email === email)) {
      return res.status(409).json({ code: 'EMAIL_TAKEN', error: '이미 사용 중인 이메일입니다.' });
    }

    const validInterests = await prisma.interest.findMany({
      where: { id: { in: interestIds } },
      select: { id: true },
    });
    if (validInterests.length !== interestIds.length) {
      return res.status(400).json({ code: 'INVALID_INTERESTS', error: '유효하지 않은 관심분야가 포함되어 있습니다.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.$transaction((tx) =>
      tx.user.create({
        data: {
          accountType: accountTypeMap[accountType],
          userId,
          name,
          email,
          password: hashedPassword,
          gender: genderMap[gender],
          birthDate: parsedBirthDate,
          region,
          phone,
          interests: {
            create: interestIds.map((interestId) => ({ interestId })),
          },
        },
        select: { id: true, userId: true, name: true, email: true },
      }),
    );

    return res.status(201).json({ message: '회원가입이 완료되었습니다.', user: newUser });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ code: 'DUPLICATE_USER', error: '이미 사용 중인 회원 아이디 또는 이메일입니다.' });
    }

    console.error('Registration failed:', error);
    return res.status(500).json({ code: 'REGISTER_FAILED', error: '회원가입 처리 중 오류가 발생했습니다.' });
  }
});

export default router;

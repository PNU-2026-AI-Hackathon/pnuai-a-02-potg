import { Router, Request, Response } from 'express';
import { Gender, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticateJwt } from '../middleware/auth';

const router = Router();

const PROFILE_FIELDS = new Set(['name', 'gender', 'birthDate', 'region', 'phone']);
const GENDER_VALUES = new Set<Gender>([Gender.FEMALE, Gender.MALE, Gender.OTHER]);
const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_PATTERN = /^\d{8,15}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

const profileSelect = {
  id: true,
  userId: true,
  name: true,
  email: true,
  accountType: true,
  gender: true,
  birthDate: true,
  region: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type ProfileRecord = Prisma.UserGetPayload<{ select: typeof profileSelect }>;
type ProfileUpdateData = Pick<Prisma.UserUpdateInput, 'name' | 'gender' | 'birthDate' | 'region' | 'phone'>;

type ValidationResult =
  | { ok: true; data: ProfileUpdateData }
  | { ok: false; code: string; error: string };

export function serializeProfile(user: ProfileRecord) {
  return {
    ...user,
    birthDate: user.birthDate?.toISOString().slice(0, 10) ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function validationError(code: string, error: string): ValidationResult {
  return { ok: false, code, error };
}

export function validateProfileUpdate(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return validationError('INVALID_BODY', 'Request body must be a JSON object.');
  }

  const input = body as Record<string, unknown>;
  const fields = Object.keys(input);
  const invalidField = fields.find((field) => !PROFILE_FIELDS.has(field));

  if (invalidField) {
    return validationError('INVALID_PROFILE_FIELD', 'The request contains a field that cannot be updated.');
  }
  if (fields.length === 0) {
    return validationError('EMPTY_PROFILE_UPDATE', 'At least one profile field is required.');
  }

  const data: ProfileUpdateData = {};

  if (Object.prototype.hasOwnProperty.call(input, 'name')) {
    if (typeof input.name !== 'string') {
      return validationError('INVALID_NAME', 'Name must be a string between 1 and 50 characters.');
    }

    const name = input.name.trim();
    if (name.length < 1 || name.length > 50) {
      return validationError('INVALID_NAME', 'Name must be a string between 1 and 50 characters.');
    }
    data.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'gender')) {
    if (input.gender === null) {
      data.gender = null;
    } else if (typeof input.gender === 'string' && GENDER_VALUES.has(input.gender as Gender)) {
      data.gender = input.gender as Gender;
    } else {
      return validationError('INVALID_GENDER', 'Gender must be FEMALE, MALE, OTHER, or null.');
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'birthDate')) {
    if (input.birthDate === null) {
      data.birthDate = null;
    } else if (typeof input.birthDate === 'string' && BIRTH_DATE_PATTERN.test(input.birthDate)) {
      const birthDate = new Date(`${input.birthDate}T00:00:00.000Z`);
      const today = new Date().toISOString().slice(0, 10);

      if (
        Number.isNaN(birthDate.getTime()) ||
        birthDate.toISOString().slice(0, 10) !== input.birthDate ||
        input.birthDate > today
      ) {
        return validationError('INVALID_BIRTH_DATE', 'Birth date must be a valid date that is not in the future.');
      }
      data.birthDate = birthDate;
    } else {
      return validationError('INVALID_BIRTH_DATE', 'Birth date must use YYYY-MM-DD or be null.');
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'region')) {
    if (input.region === null) {
      data.region = null;
    } else if (typeof input.region === 'string') {
      const region = input.region.trim();
      if (!region) {
        data.region = null;
      } else if (region.length > 100 || CONTROL_CHARACTER_PATTERN.test(region)) {
        return validationError('INVALID_REGION', 'Region must be 100 characters or fewer and contain no control characters.');
      } else {
        data.region = region;
      }
    } else {
      return validationError('INVALID_REGION', 'Region must be a string or null.');
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'phone')) {
    if (input.phone === null) {
      data.phone = null;
    } else if (typeof input.phone === 'string') {
      const trimmedPhone = input.phone.trim();
      if (!trimmedPhone) {
        data.phone = null;
      } else {
        const phone = trimmedPhone.replace(/[-\s]/g, '');
        if (!PHONE_PATTERN.test(phone)) {
          return validationError('INVALID_PHONE', 'Phone number must contain 8 to 15 digits.');
        }
        data.phone = phone;
      }
    } else {
      return validationError('INVALID_PHONE', 'Phone number must be a string or null.');
    }
  }

  return { ok: true, data };
}

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/profile', authenticateJwt, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ code: 'AUTHENTICATION_REQUIRED', error: 'Authentication required.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: profileSelect,
    });

    if (!user) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', error: 'User not found.' });
    }

    return res.status(200).json({ profile: serializeProfile(user) });
  } catch (error) {
    console.error('Profile lookup failed.');
    return res.status(500).json({ code: 'PROFILE_LOOKUP_FAILED', error: 'Unable to load profile.' });
  }
});

router.patch('/profile', authenticateJwt, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ code: 'AUTHENTICATION_REQUIRED', error: 'Authentication required.' });
  }

  const validation = validateProfileUpdate(req.body);
  if (!validation.ok) {
    return res.status(400).json({ code: validation.code, error: validation.error });
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: validation.data,
      select: profileSelect,
    });

    return res.status(200).json({ profile: serializeProfile(user) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ code: 'USER_NOT_FOUND', error: 'User not found.' });
    }

    console.error('Profile update failed.');
    return res.status(500).json({ code: 'PROFILE_UPDATE_FAILED', error: 'Unable to update profile.' });
  }
});

export default router;

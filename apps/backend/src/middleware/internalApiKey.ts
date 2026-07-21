import { timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';

function keysMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function requireInternalApiKey(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) {
    return res.status(503).json({
      code: 'INTERNAL_API_UNAVAILABLE',
      error: 'Internal API is not configured.',
    });
  }

  const actual = req.header('x-internal-api-key');
  if (!actual || !keysMatch(actual, expected)) {
    return res.status(401).json({
      code: 'INVALID_INTERNAL_API_KEY',
      error: 'A valid internal API key is required.',
    });
  }

  return next();
}

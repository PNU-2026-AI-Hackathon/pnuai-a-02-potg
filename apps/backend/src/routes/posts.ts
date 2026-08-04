import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

type CommunityPostResponse = {
  id: string;
  boardSlug: string;
  type: string;
  title: string;
  content: string;
  author: string;
  createdAt: string;
  tags: string[];
};

type CreateCommunityPostBody = {
  boardSlug?: string;
  type?: string;
  title?: string;
  content?: string;
  author?: string;
  tags?: unknown;
  password?: string;
};

type UpdateCommunityPostBody = {
  title?: string;
  content?: string;
  password?: string;
};

const DEFAULT_BOARD_SLUG = 'library-news';
const DEFAULT_POST_TYPE = 'normal';
const VALID_BOARD_SLUGS = new Set(['library-news', 'free', 'proposals']);
const VALID_POST_TYPES = new Set(['notice', 'normal']);
const MIN_PASSWORD_LENGTH = 4;
const MAX_PASSWORD_LENGTH = 64;
const MAX_TITLE_LENGTH = 100;
const MAX_CONTENT_LENGTH = 5000;

const router = Router();

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readPassword(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function readTags(value: unknown) {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}

function serializePost(post: {
  id: string;
  boardSlug: string;
  type: string;
  title: string;
  content: string;
  author: string;
  createdAt: Date;
  tags: string[];
}): CommunityPostResponse {
  return {
    id: post.id,
    boardSlug: post.boardSlug,
    type: post.type,
    title: post.title,
    content: post.content,
    author: post.author,
    createdAt: post.createdAt.toISOString(),
    tags: post.tags,
  };
}

function isPasswordLengthValid(password: string) {
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
}

async function verifyPostPassword(passwordHash: string | null, password: unknown) {
  const candidate = readPassword(password);
  return Boolean(passwordHash && candidate && (await bcrypt.compare(candidate, passwordHash)));
}

router.get('/', async (req: Request, res: Response) => {
  const boardSlug = readString(req.query.boardSlug) || DEFAULT_BOARD_SLUG;
  const search = readString(req.query.search);
  const type = readString(req.query.type);

  if (!VALID_BOARD_SLUGS.has(boardSlug)) {
    return res.status(400).json({
      code: 'INVALID_BOARD_SLUG',
      error: 'boardSlug must be library-news, free, or proposals.',
    });
  }

  if (type && !VALID_POST_TYPES.has(type)) {
    return res.status(400).json({
      code: 'INVALID_POST_TYPE',
      error: 'type must be notice or normal.',
    });
  }

  const where: Prisma.CommunityPostWhereInput = {
    boardSlug,
    ...(type ? { type } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { content: { contains: search, mode: 'insensitive' } },
            { author: { contains: search, mode: 'insensitive' } },
            { tags: { has: search } },
          ],
        }
      : {}),
  };

  try {
    const posts = await prisma.communityPost.findMany({
      where,
      orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
    });
    return res.status(200).json({ posts: posts.map(serializePost) });
  } catch (error) {
    console.error('Community post list lookup failed:', error);
    return res.status(500).json({ code: 'POST_LIST_FAILED', error: 'Unable to load posts.' });
  }
});

router.get('/:postId', async (req: Request<{ postId: string }>, res: Response) => {
  try {
    const post = await prisma.communityPost.findUnique({ where: { id: req.params.postId } });
    if (!post) return res.status(404).json({ code: 'POST_NOT_FOUND', error: 'Post not found.' });
    return res.status(200).json({ post: serializePost(post) });
  } catch (error) {
    console.error('Community post detail lookup failed:', error);
    return res.status(500).json({ code: 'POST_DETAIL_FAILED', error: 'Unable to load post.' });
  }
});

router.post('/', async (req: Request<{}, {}, CreateCommunityPostBody>, res: Response) => {
  const boardSlug = readString(req.body.boardSlug) || DEFAULT_BOARD_SLUG;
  const requestedType = readString(req.body.type) || DEFAULT_POST_TYPE;
  const title = readString(req.body?.title);
  const content = readString(req.body?.content);
  const author = readString(req.body.author) || '\uBAA8\uC774\uB77C \uC0AC\uC6A9\uC790';
  const password = readPassword(req.body.password);
  const requestedTags = readTags(req.body.tags);
  const tags = boardSlug === 'free' && requestedTags.length === 0 ? ['자유글'] : requestedTags;

  if (!VALID_BOARD_SLUGS.has(boardSlug)) {
    return res.status(400).json({ code: 'INVALID_BOARD_SLUG', error: 'Invalid boardSlug.' });
  }
  if (!VALID_POST_TYPES.has(requestedType)) {
    return res.status(400).json({ code: 'INVALID_POST_TYPE', error: 'Invalid post type.' });
  }
  if (!title || !content) {
    return res.status(400).json({ code: 'REQUIRED_FIELDS_MISSING', error: 'title and content are required.' });
  }
  if (title.length > MAX_TITLE_LENGTH || content.length > MAX_CONTENT_LENGTH) {
    return res.status(400).json({ code: 'POST_TOO_LONG', error: 'title or content is too long.' });
  }
  if (boardSlug === 'free' && !isPasswordLengthValid(password)) {
    return res.status(400).json({
      code: 'INVALID_POST_PASSWORD',
      error: `password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`,
    });
  }

  try {
    const passwordHash = boardSlug === 'free' ? await bcrypt.hash(password, 10) : null;
    const post = await prisma.communityPost.create({
      data: { boardSlug, type: requestedType, title, content, author, tags, passwordHash },
    });
    return res.status(201).json({ post: serializePost(post) });
  } catch (error) {
    console.error('Community post creation failed:', error);
    return res.status(500).json({ code: 'POST_CREATE_FAILED', error: 'Unable to create post.' });
  }
});

async function updatePost(
  req: Request<{ postId: string }, {}, UpdateCommunityPostBody>,
  res: Response,
) {
  const title = readString(req.body?.title);
  const content = readString(req.body?.content);

  if (!title || !content) {
    return res.status(400).json({ code: 'REQUIRED_FIELDS_MISSING', error: 'title and content are required.' });
  }
  if (title.length > MAX_TITLE_LENGTH || content.length > MAX_CONTENT_LENGTH) {
    return res.status(400).json({ code: 'POST_TOO_LONG', error: 'title or content is too long.' });
  }

  try {
    const post = await prisma.communityPost.findUnique({ where: { id: req.params.postId } });
    if (!post) return res.status(404).json({ code: 'POST_NOT_FOUND', error: 'Post not found.' });
    if (!(await verifyPostPassword(post.passwordHash, req.body?.password))) {
      return res.status(403).json({ code: 'INVALID_POST_PASSWORD', error: 'Invalid password.' });
    }

    const updatedPost = await prisma.communityPost.update({
      where: { id: post.id },
      data: { title, content },
    });
    return res.status(200).json({ post: serializePost(updatedPost) });
  } catch (error) {
    console.error('Community post update failed:', error);
    return res.status(500).json({ code: 'POST_UPDATE_FAILED', error: 'Unable to update post.' });
  }
}

router.patch('/:postId', updatePost);
router.put('/:postId', updatePost);

router.delete(
  '/:postId',
  async (req: Request<{ postId: string }, {}, { password?: string }>, res: Response) => {
    try {
      const post = await prisma.communityPost.findUnique({ where: { id: req.params.postId } });
      if (!post) return res.status(404).json({ code: 'POST_NOT_FOUND', error: 'Post not found.' });
      if (!(await verifyPostPassword(post.passwordHash, req.body?.password))) {
        return res.status(403).json({ code: 'INVALID_POST_PASSWORD', error: 'Invalid password.' });
      }

      await prisma.communityPost.delete({ where: { id: post.id } });
      return res.status(204).send();
    } catch (error) {
      console.error('Community post deletion failed:', error);
      return res.status(500).json({ code: 'POST_DELETE_FAILED', error: 'Unable to delete post.' });
    }
  },
);

export default router;

import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
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
};

const DEFAULT_BOARD_SLUG = 'library-news';
const DEFAULT_POST_TYPE = 'normal';
const VALID_BOARD_SLUGS = new Set(['library-news', 'free', 'proposals']);
const VALID_POST_TYPES = new Set(['notice', 'normal']);

const router = Router();

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

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
    const post = await prisma.communityPost.findUnique({
      where: { id: req.params.postId },
    });

    if (!post) {
      return res.status(404).json({ code: 'POST_NOT_FOUND', error: 'Post not found.' });
    }

    return res.status(200).json({ post: serializePost(post) });
  } catch (error) {
    console.error('Community post detail lookup failed:', error);
    return res.status(500).json({ code: 'POST_DETAIL_FAILED', error: 'Unable to load post.' });
  }
});

router.post('/', async (req: Request<{}, {}, CreateCommunityPostBody>, res: Response) => {
  const boardSlug = readString(req.body.boardSlug) || DEFAULT_BOARD_SLUG;
  const requestedType = readString(req.body.type) || DEFAULT_POST_TYPE;
  const title = readString(req.body.title);
  const content = readString(req.body.content);
  const author = readString(req.body.author) || '\uBAA8\uC774\uB77C \uC0AC\uC6A9\uC790';
  const tags = readTags(req.body.tags);

  if (!VALID_BOARD_SLUGS.has(boardSlug)) {
    return res.status(400).json({
      code: 'INVALID_BOARD_SLUG',
      error: 'boardSlug must be library-news, free, or proposals.',
    });
  }

  if (!VALID_POST_TYPES.has(requestedType)) {
    return res.status(400).json({ code: 'INVALID_POST_TYPE', error: 'type must be notice or normal.' });
  }

  if (!boardSlug || !title || !content) {
    return res.status(400).json({ error: 'boardSlug, title, and content are required' });
  }

  try {
    const post = await prisma.communityPost.create({
      data: {
        boardSlug,
        type: requestedType,
        title,
        content,
        author,
        tags,
      },
    });

    return res.status(201).json({ post: serializePost(post) });
  } catch (error) {
    console.error('Community post creation failed:', error);
    return res.status(500).json({ code: 'POST_CREATE_FAILED', error: 'Unable to create post.' });
  }
});

export default router;

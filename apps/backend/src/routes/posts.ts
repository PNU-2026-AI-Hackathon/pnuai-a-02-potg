import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { authenticateJwt, authenticateOptionalJwt } from '../middleware/auth';

type CommunityPostResponse = {
  id: string;
  boardSlug: string;
  type: string;
  title: string;
  content: string;
  author: string;
  createdAt: string;
  tags: string[];
  likeCount: number;
  commentCount: number;
  isOwner: boolean;
  canDelete: boolean;
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
  type?: string;
  tags?: unknown;
  password?: string;
};

type CreateCommunityCommentBody = {
  content?: string;
  author?: string;
  parentId?: string;
};

const DEFAULT_BOARD_SLUG = 'library-news';
const DEFAULT_POST_TYPE = 'normal';
const VALID_BOARD_SLUGS = new Set(['library-news', 'ideas']);
const VALID_POST_TYPES = new Set(['notice', 'normal']);
const MAX_TITLE_LENGTH = 100;
const MAX_CONTENT_LENGTH = 2_000_000;
const MAX_COMMENT_LENGTH = 2000;

const router = Router();

router.use(authenticateOptionalJwt);

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
  authorId?: string | null;
  _count?: { likes: number; comments: number };
}, viewerId?: string, viewerRole?: string): CommunityPostResponse {
  return {
    id: post.id,
    boardSlug: post.boardSlug,
    type: post.type,
    title: post.title,
    content: post.content,
    author: post.author,
    createdAt: post.createdAt.toISOString(),
    tags: post.tags,
    likeCount: post._count?.likes ?? 0,
    commentCount: post._count?.comments ?? 0,
    isOwner: Boolean(viewerId && (post.authorId === viewerId || canManageLibraryNews(post.boardSlug, viewerRole))),
    canDelete: Boolean(viewerId && (post.authorId === viewerId || canModeratePosts(viewerRole))),
  };
}

function canManageLibraryNews(boardSlug: string, accountType?: string) {
  return boardSlug === 'library-news' && (accountType === 'LIBRARIAN' || accountType === 'ADMIN');
}

function canModeratePosts(accountType?: string) {
  return accountType === 'LIBRARIAN' || accountType === 'ADMIN';
}

async function verifyPostPassword(passwordHash: string | null, password: unknown) {
  const candidate = readPassword(password);
  return Boolean(passwordHash && candidate && (await bcrypt.compare(candidate, passwordHash)));
}

router.get('/', async (req: Request, res: Response) => {
  const boardSlug = readString(req.query.boardSlug) || DEFAULT_BOARD_SLUG;
  const search = readString(req.query.search);
  const type = readString(req.query.type);
  const sort = readString(req.query.sort);
  const requestedLimit = Number.parseInt(readString(req.query.limit), 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : undefined;

  if (!VALID_BOARD_SLUGS.has(boardSlug)) {
    return res.status(400).json({
      code: 'INVALID_BOARD_SLUG',
      error: 'boardSlug must be library-news or ideas.',
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
      include: { _count: { select: { likes: true, comments: true } } },
      orderBy: sort === 'likes'
        ? [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }]
        : [{ type: 'asc' }, { createdAt: 'desc' }],
      ...(limit ? { take: limit } : {}),
    });
    return res.status(200).json({ posts: posts.map((post) => serializePost(post, req.user?.id, req.user?.accountType)) });
  } catch (error) {
    console.error('Community post list lookup failed:', error);
    return res.status(500).json({ code: 'POST_LIST_FAILED', error: 'Unable to load posts.' });
  }
});

router.get('/:postId', async (req: Request<{ postId: string }>, res: Response) => {
  try {
    const post = await prisma.communityPost.findUnique({
      where: { id: req.params.postId },
      include: { _count: { select: { likes: true, comments: true } } },
    });
    if (!post) return res.status(404).json({ code: 'POST_NOT_FOUND', error: 'Post not found.' });
    return res.status(200).json({ post: serializePost(post, req.user?.id, req.user?.accountType) });
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
  const author = req.user?.name || readString(req.body.author) || '\uBAA8\uC774\uB77C \uC0AC\uC6A9\uC790';
  const tags = readTags(req.body.tags);

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

  try {
    /**
     * 비밀번호로 글을 지키던 게시판은 자유 게시판뿐이었고 그 게시판은 없어졌다.
     * 새 글은 로그인한 사람의 것으로만 남는다. verifyPostPassword 는 지우지 않는다 —
     * 예전에 비밀번호로 쓴 글이 DB에 남아 있고, 그 주인이 지울 길까지 막을 이유는 없다.
     */
    const post = await prisma.communityPost.create({
      data: { boardSlug, type: requestedType, title, content, author, tags, passwordHash: null, authorId: req.user?.id },
    });
    return res.status(201).json({ post: serializePost(post, req.user?.id, req.user?.accountType) });
  } catch (error) {
    console.error('Community post creation failed:', error);
    return res.status(500).json({ code: 'POST_CREATE_FAILED', error: 'Unable to create post.' });
  }
});

router.get('/:postId/comments', async (req: Request<{ postId: string }>, res: Response) => {
  try {
    const post = await prisma.communityPost.findUnique({
      where: { id: req.params.postId },
      select: { id: true },
    });
    if (!post) return res.status(404).json({ code: 'POST_NOT_FOUND', error: 'Post not found.' });

    const comments = await prisma.communityComment.findMany({
      where: { postId: post.id },
      orderBy: { createdAt: 'asc' },
    });
    return res.status(200).json({
      comments: comments.map((comment) => ({
        ...comment,
        isOwner: Boolean(req.user && comment.authorId === req.user.id),
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Community comment list lookup failed:', error);
    return res.status(500).json({ code: 'COMMENT_LIST_FAILED', error: 'Unable to load comments.' });
  }
});

router.get('/:postId/activity', async (req: Request<{ postId: string }>, res: Response) => {
  try {
    const post = await prisma.communityPost.findUnique({
      where: { id: req.params.postId },
      select: {
        id: true,
        _count: { select: { likes: true, saves: true } },
        likes: { where: { userId: req.user?.id ?? '' }, select: { userId: true } },
        saves: { where: { userId: req.user?.id ?? '' }, select: { userId: true } },
      },
    });
    if (!post) return res.status(404).json({ code: 'POST_NOT_FOUND', error: 'Post not found.' });
    return res.status(200).json({
      activity: {
        likeCount: post._count.likes,
        saveCount: post._count.saves,
        liked: post.likes.length > 0,
        saved: post.saves.length > 0,
      },
    });
  } catch (error) {
    console.error('Community post activity lookup failed:', error);
    return res.status(500).json({ code: 'POST_ACTIVITY_FAILED', error: 'Unable to load post activity.' });
  }
});

router.put('/:postId/like', authenticateJwt, async (req: Request<{ postId: string }>, res: Response) => {
  await setPostActivity(req, res, 'like', true);
});
router.delete('/:postId/like', authenticateJwt, async (req: Request<{ postId: string }>, res: Response) => {
  await setPostActivity(req, res, 'like', false);
});
router.put('/:postId/save', authenticateJwt, async (req: Request<{ postId: string }>, res: Response) => {
  await setPostActivity(req, res, 'save', true);
});
router.delete('/:postId/save', authenticateJwt, async (req: Request<{ postId: string }>, res: Response) => {
  await setPostActivity(req, res, 'save', false);
});

async function setPostActivity(
  req: Request<{ postId: string }>,
  res: Response,
  kind: 'like' | 'save',
  active: boolean,
) {
  if (!req.user) return res.status(401).json({ code: 'AUTHENTICATION_REQUIRED', error: 'Authentication required.' });

  const key = { userId_postId: { userId: req.user.id, postId: req.params.postId } };
  try {
    if (kind === 'like') {
      if (active) await prisma.communityPostLike.upsert({ where: key, create: key.userId_postId, update: {} });
      else await prisma.communityPostLike.deleteMany({ where: key.userId_postId });
    } else if (active) {
      await prisma.communityPostSave.upsert({ where: key, create: key.userId_postId, update: {} });
    } else {
      await prisma.communityPostSave.deleteMany({ where: key.userId_postId });
    }
    return res.status(200).json({ active });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return res.status(404).json({ code: 'POST_NOT_FOUND', error: 'Post not found.' });
    }
    console.error('Community post activity update failed:', error);
    return res.status(500).json({ code: 'POST_ACTIVITY_UPDATE_FAILED', error: 'Unable to update post activity.' });
  }
}

router.post(
  '/:postId/comments',
  async (req: Request<{ postId: string }, {}, CreateCommunityCommentBody>, res: Response) => {
    const content = readString(req.body.content);
    const author = req.user?.name || readString(req.body.author) || '\uBAA8\uC774\uB77C \uC0AC\uC6A9\uC790';
    const parentId = readString(req.body.parentId) || null;

    if (!content) {
      return res.status(400).json({ code: 'COMMENT_REQUIRED', error: 'content is required.' });
    }
    if (content.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ code: 'COMMENT_TOO_LONG', error: 'comment is too long.' });
    }

    try {
      const post = await prisma.communityPost.findUnique({
        where: { id: req.params.postId },
        select: { id: true },
      });
      if (!post) return res.status(404).json({ code: 'POST_NOT_FOUND', error: 'Post not found.' });

      if (parentId) {
        const parent = await prisma.communityComment.findFirst({
          where: { id: parentId, postId: post.id },
          select: { id: true },
        });
        if (!parent) {
          return res.status(400).json({ code: 'INVALID_PARENT_COMMENT', error: 'Parent comment not found.' });
        }
      }

      const comment = await prisma.communityComment.create({
        data: { postId: post.id, parentId, content, author, authorId: req.user?.id },
      });
      return res.status(201).json({
        comment: {
          ...comment,
          createdAt: comment.createdAt.toISOString(),
          updatedAt: comment.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      console.error('Community comment creation failed:', error);
      return res.status(500).json({ code: 'COMMENT_CREATE_FAILED', error: 'Unable to create comment.' });
    }
  },
);

async function updatePost(
  req: Request<{ postId: string }, {}, UpdateCommunityPostBody>,
  res: Response,
) {
  const title = readString(req.body?.title);
  const content = readString(req.body?.content);
  const requestedType = readString(req.body?.type);
  const requestedTags = Array.isArray(req.body?.tags) ? readTags(req.body.tags) : undefined;

  if (!title || !content) {
    return res.status(400).json({ code: 'REQUIRED_FIELDS_MISSING', error: 'title and content are required.' });
  }
  if (title.length > MAX_TITLE_LENGTH || content.length > MAX_CONTENT_LENGTH) {
    return res.status(400).json({ code: 'POST_TOO_LONG', error: 'title or content is too long.' });
  }

  try {
    const post = await prisma.communityPost.findUnique({ where: { id: req.params.postId } });
    if (!post) return res.status(404).json({ code: 'POST_NOT_FOUND', error: 'Post not found.' });
    if (post.boardSlug === 'library-news' && requestedType && !VALID_POST_TYPES.has(requestedType)) {
      return res.status(400).json({ code: 'INVALID_POST_TYPE', error: 'Invalid post type.' });
    }
    const canEdit = req.user?.id === post.authorId || canManageLibraryNews(post.boardSlug, req.user?.accountType) || await verifyPostPassword(post.passwordHash, req.body?.password);
    if (!canEdit) {
      return res.status(403).json({ code: 'INVALID_POST_PASSWORD', error: 'Invalid password.' });
    }

    const updatedPost = await prisma.communityPost.update({
      where: { id: post.id },
      data: {
        title,
        content,
        ...(post.boardSlug === 'library-news' && requestedType ? { type: requestedType } : {}),
        ...(requestedTags ? { tags: requestedTags } : {}),
      },
    });
    return res.status(200).json({ post: serializePost(updatedPost, req.user?.id, req.user?.accountType) });
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
      const canDelete = req.user?.id === post.authorId || canModeratePosts(req.user?.accountType) || await verifyPostPassword(post.passwordHash, req.body?.password);
      if (!canDelete) {
        return res.status(403).json({ code: 'POST_DELETE_FORBIDDEN', error: 'You do not have permission to delete this post.' });
      }

      await prisma.communityPost.delete({ where: { id: post.id } });
      return res.status(204).send();
    } catch (error) {
      console.error('Community post deletion failed:', error);
      return res.status(500).json({ code: 'POST_DELETE_FAILED', error: 'Unable to delete post.' });
    }
  },
);

router.patch('/:postId/comments/:commentId', authenticateJwt, async (req: Request<{ postId: string; commentId: string }, {}, { content?: string }>, res: Response) => {
  if (!req.user) return res.status(401).json({ code: 'AUTHENTICATION_REQUIRED', error: 'Authentication required.' });
  const content = readString(req.body.content);
  if (!content || content.length > MAX_COMMENT_LENGTH) {
    return res.status(400).json({ code: 'INVALID_COMMENT', error: 'Comment content is required and must be 2000 characters or fewer.' });
  }
  try {
    const comment = await prisma.communityComment.findFirst({ where: { id: req.params.commentId, postId: req.params.postId } });
    if (!comment) return res.status(404).json({ code: 'COMMENT_NOT_FOUND', error: 'Comment not found.' });
    if (comment.authorId !== req.user.id) return res.status(403).json({ code: 'FORBIDDEN', error: 'You can only edit your own comment.' });
    const updated = await prisma.communityComment.update({ where: { id: comment.id }, data: { content } });
    return res.status(200).json({ comment: { ...updated, isOwner: true, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() } });
  } catch (error) {
    console.error('Community comment update failed:', error);
    return res.status(500).json({ code: 'COMMENT_UPDATE_FAILED', error: 'Unable to update comment.' });
  }
});

router.delete('/:postId/comments/:commentId', authenticateJwt, async (req: Request<{ postId: string; commentId: string }>, res: Response) => {
  if (!req.user) return res.status(401).json({ code: 'AUTHENTICATION_REQUIRED', error: 'Authentication required.' });
  try {
    const comment = await prisma.communityComment.findFirst({ where: { id: req.params.commentId, postId: req.params.postId } });
    if (!comment) return res.status(404).json({ code: 'COMMENT_NOT_FOUND', error: 'Comment not found.' });
    if (comment.authorId !== req.user.id) return res.status(403).json({ code: 'FORBIDDEN', error: 'You can only delete your own comment.' });
    await prisma.communityComment.delete({ where: { id: comment.id } });
    return res.status(204).send();
  } catch (error) {
    console.error('Community comment deletion failed:', error);
    return res.status(500).json({ code: 'COMMENT_DELETE_FAILED', error: 'Unable to delete comment.' });
  }
});

export default router;

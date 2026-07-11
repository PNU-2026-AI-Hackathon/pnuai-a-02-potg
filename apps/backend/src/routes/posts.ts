import { randomUUID } from 'crypto';
import { Router, Request, Response } from 'express';

type BoardPost = {
  id: string;
  title: string;
  content: string;
  category: string;
  author: string;
  createdAt: string;
  updatedAt?: string;
};

type BoardComment = {
  id: string;
  postId: string;
  content: string;
  author: string;
  createdAt: string;
};

type CreatePostBody = {
  title?: string;
  content?: string;
  category?: string;
  author?: string;
};

type UpdatePostBody = Partial<CreatePostBody>;

type CreateCommentBody = {
  content?: string;
  author?: string;
};

const CATEGORY_ALL = '\uC804\uCCB4';
const CATEGORY_NOTICE = '\uACF5\uC9C0';
const CATEGORY_NEWS = '\uC18C\uC2DD';
const CATEGORY_SUGGESTION = '\uC81C\uC548';

const posts: BoardPost[] = [
  {
    id: 'post-1',
    title: '\uC791\uC740\uB3C4\uC11C\uAD00 \uC8FC\uB9D0 \uB3C5\uC11C \uBAA8\uC784\uC744 \uC81C\uC548\uD569\uB2C8\uB2E4',
    content:
      '\uC9C0\uC5ED \uC8FC\uBBFC\uC774 \uD568\uAED8 \uCC45\uC744 \uC77D\uACE0 \uC774\uC57C\uAE30\uB97C \uB098\uB204\uB294 \uBAA8\uC784\uC744 \uC5F4\uBA74 \uC88B\uACA0\uC2B5\uB2C8\uB2E4.',
    category: CATEGORY_SUGGESTION,
    author: '\uAE40\uBAA8\uC774\uB77C',
    createdAt: '2026-06-26T09:00:00.000Z',
  },
  {
    id: 'post-2',
    title: '7\uC6D4 \uCCAD\uC18C\uB144 AI \uB3C5\uC11C \uBA58\uD1A0\uB9C1 \uCC38\uC5EC\uC790\uB97C \uBAA8\uC9D1\uD569\uB2C8\uB2E4',
    content:
      '\uCCAD\uC18C\uB144\uC744 \uB300\uC0C1\uC73C\uB85C \uD55C AI \uB3C5\uC11C \uBA58\uD1A0\uB9C1 \uD504\uB85C\uADF8\uB7A8 \uCC38\uC5EC\uC790\uB97C \uBAA8\uC9D1\uD569\uB2C8\uB2E4.',
    category: CATEGORY_NEWS,
    author: '\uBAA8\uC774\uB77C \uC6B4\uC601\uD300',
    createdAt: '2026-06-25T02:30:00.000Z',
  },
  {
    id: 'post-3',
    title: '\uAC8C\uC2DC\uD310 \uC774\uC6A9 \uC548\uB0B4',
    content:
      '\uBAA8\uC774\uB77C \uAC8C\uC2DC\uD310\uC740 \uACF5\uC9C0, \uC9C0\uC5ED \uC18C\uC2DD, \uC8FC\uBBFC \uC81C\uC548\uC744 \uD568\uAED8 \uACF5\uC720\uD558\uB294 \uACF5\uAC04\uC785\uB2C8\uB2E4.',
    category: CATEGORY_NOTICE,
    author: '\uAD00\uB9AC\uC790',
    createdAt: '2026-06-24T01:10:00.000Z',
  },
];

const comments: BoardComment[] = [
  {
    id: 'comment-1',
    postId: 'post-1',
    content: '\uC88B\uC740 \uC81C\uC548\uC785\uB2C8\uB2E4. \uC8FC\uB9D0\uC5D0 \uCC38\uC5EC\uD560 \uC218 \uC788\uB294 \uC2DC\uAC04\uB300\uB3C4 \uD568\uAED8 \uACF5\uC720\uB418\uBA74 \uC88B\uACA0\uC5B4\uC694.',
    author: '\uBAA8\uC774\uB77C \uC0AC\uC6A9\uC790',
    createdAt: '2026-06-26T10:15:00.000Z',
  },
  {
    id: 'comment-2',
    postId: 'post-3',
    content: '\uAC8C\uC2DC\uD310 \uBD84\uB958\uAC00 \uC788\uC5B4\uC11C \uC18C\uC2DD\uC744 \uCC3E\uAE30 \uD3B8\uD558\uB124\uC694.',
    author: '\uC774\uC6A9\uC790',
    createdAt: '2026-06-24T03:20:00.000Z',
  },
];

const router = Router();

function findPost(postId: string) {
  return posts.find((post) => post.id === postId);
}

function findPostIndex(postId: string) {
  return posts.findIndex((post) => post.id === postId);
}

router.get('/', (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';

  const filteredPosts = posts
    .filter((post) => {
      const matchesCategory = !category || category === CATEGORY_ALL || post.category === category;
      const matchesSearch =
        !search ||
        [post.title, post.content, post.category, post.author].some((value) =>
          value.toLowerCase().includes(search),
        );

      return matchesCategory && matchesSearch;
    })
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

  res.json({ posts: filteredPosts });
});

router.post('/', (req: Request<{}, {}, CreatePostBody>, res: Response) => {
  const title = req.body.title?.trim();
  const content = req.body.content?.trim();
  const category = req.body.category?.trim();
  const author = req.body.author?.trim() || '\uBAA8\uC774\uB77C \uC0AC\uC6A9\uC790';

  if (!title || !content || !category) {
    return res.status(400).json({ error: 'title, content, and category are required' });
  }

  const post: BoardPost = {
    id: randomUUID(),
    title,
    content,
    category,
    author,
    createdAt: new Date().toISOString(),
  };

  posts.unshift(post);

  return res.status(201).json({ post });
});

router.get('/:postId', (req, res) => {
  const post = findPost(req.params.postId);

  if (!post) {
    return res.status(404).json({ error: 'post not found' });
  }

  return res.json({ post });
});

router.put(
  '/:postId',
  (req: Request<{ postId: string }, {}, UpdatePostBody>, res: Response) => {
    const post = findPost(req.params.postId);

    if (!post) {
      return res.status(404).json({ error: 'post not found' });
    }

    const title = req.body.title?.trim();
    const content = req.body.content?.trim();
    const category = req.body.category?.trim();
    const author = req.body.author?.trim();

    if (req.body.title !== undefined && !title) {
      return res.status(400).json({ error: 'title cannot be empty' });
    }

    if (req.body.content !== undefined && !content) {
      return res.status(400).json({ error: 'content cannot be empty' });
    }

    if (req.body.category !== undefined && !category) {
      return res.status(400).json({ error: 'category cannot be empty' });
    }

    if (title) {
      post.title = title;
    }

    if (content) {
      post.content = content;
    }

    if (category) {
      post.category = category;
    }

    if (author) {
      post.author = author;
    }

    post.updatedAt = new Date().toISOString();

    return res.json({ post });
  },
);

router.delete('/:postId', (req, res) => {
  const postIndex = findPostIndex(req.params.postId);

  if (postIndex === -1) {
    return res.status(404).json({ error: 'post not found' });
  }

  const [deletedPost] = posts.splice(postIndex, 1);

  for (let index = comments.length - 1; index >= 0; index -= 1) {
    if (comments[index].postId === deletedPost.id) {
      comments.splice(index, 1);
    }
  }

  return res.json({ post: deletedPost });
});

router.get('/:postId/comments', (req, res) => {
  const post = findPost(req.params.postId);

  if (!post) {
    return res.status(404).json({ error: 'post not found' });
  }

  const postComments = comments
    .filter((comment) => comment.postId === post.id)
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));

  return res.json({ comments: postComments });
});

router.post(
  '/:postId/comments',
  (req: Request<{ postId: string }, {}, CreateCommentBody>, res: Response) => {
    const post = findPost(req.params.postId);

    if (!post) {
      return res.status(404).json({ error: 'post not found' });
    }

    const content = req.body.content?.trim();
    const author = req.body.author?.trim() || '\uBAA8\uC774\uB77C \uC0AC\uC6A9\uC790';

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const comment: BoardComment = {
      id: randomUUID(),
      postId: post.id,
      content,
      author,
      createdAt: new Date().toISOString(),
    };

    comments.push(comment);

    return res.status(201).json({ comment });
  },
);

export default router;

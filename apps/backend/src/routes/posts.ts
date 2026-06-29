import { randomUUID } from 'crypto';
import { Router, Request, Response } from 'express';

type BoardPost = {
  id: string;
  title: string;
  content: string;
  category: string;
  author: string;
  createdAt: string;
};

type CreatePostBody = {
  title?: string;
  content?: string;
  category?: string;
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

const router = Router();

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

export default router;

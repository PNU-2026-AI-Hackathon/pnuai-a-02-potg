"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CommunitySectionBreadcrumb from "@/components/community/CommunitySectionBreadcrumb";

/**
 * tags 를 옵셔널로 둔 것은 백엔드가 늘 준다고 믿을 수 없기 때문이다. 예전 판의 백엔드가
 * 붙어 있으면 이 자리에 아무것도 오지 않았고, 그때 `tags[0]` 하나가 터지면서 글 목록이
 * 통째로 비었다. 값 하나가 비는 것과 게시판이 열리지 않는 것은 무게가 다르다.
 */
type ApiPost = {
  id: string;
  boardSlug: string;
  title: string;
  content: string;
  author: string;
  createdAt: string;
  tags?: string[];
  isOwner: boolean;
  canDelete: boolean;
};
type ApiComment = {
  id: string;
  postId: string;
  parentId: string | null;
  content: string;
  author: string;
  createdAt: string;
};
type Topic = {
  id: string;
  title: string;
  body: string;
  author: string;
  role: string;
  category: string;
  votes: number;
  createdAt: string;
  isOwner: boolean;
  canDelete: boolean;
};
type Reply = {
  id: string;
  author: string;
  role: string;
  createdAt: string;
  body: string;
  votes: number;
  depth: number;
  parentId: string | null;
  parentAuthor?: string;
};
type TopicActivity = {
  likeCount: number;
  saveCount: number;
  liked: boolean;
  saved: boolean;
};

const emptyTopicActivity: TopicActivity = {
  likeCount: 0,
  saveCount: 0,
  liked: false,
  saved: false,
};

const topicCategories = [
  "미술·공예",
  "독서·글쓰기",
  "음악·공연",
  "영어·외국어",
  "역사·인문",
  "진로·디지털",
  "과학·실험",
  "요리",
];

type IdeaIconName =
  | "home"
  | "chevron"
  | "bulb"
  | "users"
  | "tag"
  | "search"
  | "bookmark"
  | "message"
  | "close"
  | "plus";

function IdeaIcon({ name }: { name: IdeaIconName }) {
  const paths: Record<IdeaIconName, React.ReactNode> = {
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    bulb: (
      <>
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M8.2 14.5A7 7 0 1 1 15.8 14.5c-1.1.8-1.5 1.8-1.5 3.5h-4.6c0-1.7-.4-2.7-1.5-3.5Z" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    tag: (
      <>
        <path d="M20.6 13.6 11 23.2 1.8 14V2h12l9.2 9.2Z" />
        <circle cx="7" cy="8" r="1.5" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    bookmark: <path d="M6 3h12v18l-6-4-6 4Z" />,
    message: (
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
    ),
    close: (
      <>
        <path d="m6 6 12 12" />
        <path d="m18 6-12 12" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
  };
  return (
    <svg className="ideaIcon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function formatRelativeTime(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function mapPost(post: ApiPost): Topic {
  const category = Array.isArray(post.tags) ? post.tags[0] : undefined;
  return {
    id: post.id,
    title: post.title,
    body: post.content,
    author: post.author,
    role: "동네 주민",
    category: category || "주제 없음",
    votes: 0,
    createdAt: post.createdAt,
    isOwner: post.isOwner,
    canDelete: post.canDelete,
  };
}

function mapComments(comments: ApiComment[]) {
  const authors = new Map(
    comments.map((comment) => [comment.id, comment.author]),
  );
  return comments.map(
    (comment): Reply => ({
      id: comment.id,
      author: comment.author,
      role: "동네 주민",
      createdAt: comment.createdAt,
      body: comment.content,
      votes: 0,
      depth: comment.parentId ? 1 : 0,
      parentId: comment.parentId,
      parentAuthor: comment.parentId
        ? authors.get(comment.parentId)
        : undefined,
    }),
  );
}

function orderReplies(
  replies: Reply[],
  sort: "좋아요 순" | "최신순",
  likedReplyIds: string[],
) {
  const replyIds = new Set(replies.map((reply) => reply.id));
  const childrenByParent = new Map<string, Reply[]>();

  replies.forEach((reply) => {
    if (!reply.parentId || !replyIds.has(reply.parentId)) return;
    const children = childrenByParent.get(reply.parentId) ?? [];
    children.push(reply);
    childrenByParent.set(reply.parentId, children);
  });

  const roots = replies
    .filter((reply) => !reply.parentId || !replyIds.has(reply.parentId))
    .sort((left, right) =>
      sort === "좋아요 순"
        ? right.votes +
          Number(likedReplyIds.includes(right.id)) -
          (left.votes + Number(likedReplyIds.includes(left.id)))
        : Date.parse(right.createdAt) - Date.parse(left.createdAt),
    );

  const ordered: Reply[] = [];
  const appendWithChildren = (reply: Reply) => {
    ordered.push(reply);
    (childrenByParent.get(reply.id) ?? []).forEach(appendWithChildren);
  };

  roots.forEach(appendWithChildren);
  return ordered;
}

export default function IdeaThreadBoard() {
  /**
   * 기획서에 쓸 의제를 고르러 온 상태인지.
   *
   * 평소에는 이 버튼을 띄우지 않는다. 사서라도 그냥 읽으러 왔을 때는 글마다 「선택하기」가
   * 붙어 있으면 방해가 된다. 기준은 누구냐가 아니라 지금 고르러 왔느냐다.
   *
   * 계정 종류를 보지 않는 이유는, 눌러 봐야 스튜디오로 갈 뿐이고 그쪽이 이미 로그인을
   * 요구하기 때문이다. 주민이 주소를 직접 쳐도 잃는 것이 없다.
   */
  const searchParams = useSearchParams();
  const router = useRouter();
  const isPicking = searchParams.get("pick") === "studio";
  const requestedTopicId = searchParams.get("topic");
  const pickTopic = (id: string) =>
    router.push(`/studio?agenda=${encodeURIComponent(id)}`);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [repliesByTopic, setRepliesByTopic] = useState<Record<string, Reply[]>>(
    {},
  );
  const [sort, setSort] = useState<"인기순" | "최신순">("최신순");
  const [replySort, setReplySort] = useState<"좋아요 순" | "최신순">("최신순");
  const [category, setCategory] = useState("전체 주제");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detailWidth, setDetailWidth] = useState(460);
  const [isDetailClosing, setIsDetailClosing] = useState(false);
  const [likedTopics, setLikedTopics] = useState<string[]>([]);
  const [scrappedTopics, setScrappedTopics] = useState<string[]>([]);
  const [likedReplies, setLikedReplies] = useState<string[]>([]);
  const [reply, setReply] = useState("");
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    author: string;
  } | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [deletingTopic, setDeletingTopic] = useState<Topic | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    body: "",
    category: topicCategories[0],
  });
  const [editDraft, setEditDraft] = useState({ title: "", body: "", category: topicCategories[0] });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [editError, setEditError] = useState("");
  const closeTimer = useRef<number | null>(null);

  const loadIdeas = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/posts?boardSlug=ideas", {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data?.error || "아이디어를 불러오지 못했습니다.");
      const loadedTopics = ((data.posts || []) as ApiPost[]).map(mapPost);
      const topicEntries = await Promise.all(
        loadedTopics.map(async (topic) => {
          const [commentsResponse, activityResponse] = await Promise.all([
            fetch(`/api/posts/${encodeURIComponent(topic.id)}/comments`, { cache: "no-store" }),
            fetch(`/api/posts/${encodeURIComponent(topic.id)}/activity`, { cache: "no-store" }),
          ]);
          const commentsData = commentsResponse.ok ? await commentsResponse.json() : { comments: [] };
          const activityData = activityResponse.ok ? await activityResponse.json() : { activity: emptyTopicActivity };
          return {
            topicId: topic.id,
            replies: mapComments((commentsData.comments || []) as ApiComment[]),
            activity: activityData.activity as TopicActivity,
          };
        }),
      );
      const activityByTopic = new Map(topicEntries.map((entry) => [entry.topicId, entry.activity]));
      setTopics(loadedTopics.map((topic) => ({
        ...topic,
        votes: activityByTopic.get(topic.id)?.likeCount ?? 0,
      })));
      setRepliesByTopic(Object.fromEntries(topicEntries.map((entry) => [entry.topicId, entry.replies])));
      setLikedTopics(topicEntries.filter((entry) => entry.activity.liked).map((entry) => entry.topicId));
      setScrappedTopics(topicEntries.filter((entry) => entry.activity.saved).map((entry) => entry.topicId));
      setSelected((current) => {
        if (requestedTopicId && loadedTopics.some((topic) => topic.id === requestedTopicId)) {
          return requestedTopicId;
        }
        if (current && loadedTopics.some((topic) => topic.id === current))
          return current;
        return window.matchMedia("(max-width: 767px)").matches
          ? null
          : (loadedTopics[0]?.id ?? null);
      });
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "아이디어를 불러오지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [requestedTopicId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadIdeas();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadIdeas]);

  const categories = [
    "전체 주제",
    ...Array.from(
      new Set([
        ...topicCategories,
        ...topics.map((topic) => topic.category).filter(Boolean),
      ]),
    ),
  ];
  const normalizedQuery = query.trim().toLocaleLowerCase("ko");
  const ordered = useMemo(
    () =>
      topics
        .filter(
          (topic) => category === "전체 주제" || topic.category === category,
        )
        .filter(
          (topic) =>
            !normalizedQuery ||
            `${topic.title} ${topic.body}`
              .toLocaleLowerCase("ko")
              .includes(normalizedQuery),
        )
        .sort((left, right) =>
          sort === "인기순"
            ? right.votes - left.votes
            : Date.parse(right.createdAt) - Date.parse(left.createdAt),
        ),
    [topics, category, normalizedQuery, sort],
  );
  const active =
    selected === null
      ? null
      : (topics.find((topic) => topic.id === selected) ?? null);
  const activeReplies = active ? (repliesByTopic[active.id] ?? []) : [];
  const orderedReplies = orderReplies(activeReplies, replySort, likedReplies);
  async function toggleTopicActivity(id: string, kind: "like" | "save") {
    const state = kind === "like" ? likedTopics : scrappedTopics;
    const setState = kind === "like" ? setLikedTopics : setScrappedTopics;
    const active = state.includes(id);

    setActionError("");
    setState((items) => active ? items.filter((item) => item !== id) : [...items, id]);
    if (kind === "like") {
      setTopics((items) => items.map((topic) => topic.id === id
        ? { ...topic, votes: Math.max(0, topic.votes + (active ? -1 : 1)) }
        : topic));
    }

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(id)}/${kind}`, {
        method: active ? "DELETE" : "PUT",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(response.status === 401 ? "로그인 후 이용해 주세요." : data?.error || "활동을 저장하지 못했습니다.");
      }
    } catch (error) {
      setState((items) => active ? [...items, id] : items.filter((item) => item !== id));
      if (kind === "like") {
        setTopics((items) => items.map((topic) => topic.id === id
          ? { ...topic, votes: Math.max(0, topic.votes + (active ? 1 : -1)) }
          : topic));
      }
      setActionError(error instanceof Error ? error.message : "활동을 저장하지 못했습니다.");
    }
  }
  const toggleTopicLike = (id: string) => void toggleTopicActivity(id, "like");
  const toggleTopicScrap = (id: string) => void toggleTopicActivity(id, "save");
  const selectTopic = (id: string) => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    setIsDetailClosing(false);
    setSelected(id);
    setActionError("");
  };
  const closeDetail = () => {
    setIsDetailClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setSelected(null);
      setIsDetailClosing(false);
      closeTimer.current = null;
    }, 320);
  };
  const resizeDetail = (clientX: number, element: HTMLElement) => {
    const workspace = element.closest<HTMLElement>(".threadWorkspace");
    if (!workspace) return;
    const bounds = workspace.getBoundingClientRect();
    const maximum = Math.max(440, Math.min(720, bounds.width - 440));
    setDetailWidth(
      Math.round(Math.max(440, Math.min(maximum, bounds.right - clientX))),
    );
  };

  const submitReply = async () => {
    if (!active || !reply.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setActionError("");
    try {
      const response = await fetch(
        `/api/posts/${encodeURIComponent(active.id)}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: reply.trim(),
            author: "모이라 사용자",
            parentId: replyingTo?.id,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data?.error || "댓글을 등록하지 못했습니다.");
      const created = mapComments([data.comment as ApiComment])[0];
      if (!created) throw new Error("댓글 응답 형식이 올바르지 않습니다.");
      if (replyingTo) created.parentAuthor = replyingTo.author;
      setRepliesByTopic((current) => ({
        ...current,
        [active.id]: [...(current[active.id] ?? []), created],
      }));
      setReply("");
      setReplyingTo(null);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "댓글을 등록하지 못했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitTopic = async () => {
    if (!draft.title.trim() || !draft.body.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setActionError("");
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardSlug: "ideas",
          type: "normal",
          title: draft.title.trim(),
          content: draft.body.trim(),
          author: "모이라 사용자",
          tags: [draft.category],
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data?.error || "아이디어를 등록하지 못했습니다.");
      const created = mapPost(data.post as ApiPost);
      setTopics((items) => [created, ...items]);
      setRepliesByTopic((current) => ({ ...current, [created.id]: [] }));
      setSelected(created.id);
      setCategory("전체 주제");
      setDraft({ title: "", body: "", category: topicCategories[0] });
      setIsCreateOpen(false);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "아이디어를 등록하지 못했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditTopic = (topic: Topic) => {
    setEditError("");
    setEditDraft({ title: topic.title, body: topic.body, category: topic.category });
    setEditingTopicId(topic.id);
  };

  const submitEditTopic = async () => {
    if (!editingTopicId || !editDraft.title.trim() || !editDraft.body.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setEditError("");
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(editingTopicId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editDraft.title.trim(), content: editDraft.body.trim(), tags: [editDraft.category] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "아이디어를 수정하지 못했습니다.");
      const updated = mapPost(data.post as ApiPost);
      setTopics((items) => items.map((item) => item.id === updated.id ? updated : item));
      setEditingTopicId(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "아이디어를 수정하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteTopic = async (topic: Topic) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setActionError("");
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(topic.id)}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "아이디어를 삭제하지 못했습니다.");
      }
      setTopics((items) => items.filter((item) => item.id !== topic.id));
      setRepliesByTopic((current) => {
        const next = { ...current };
        delete next[topic.id];
        return next;
      });
      setSelected(null);
      setDeletingTopic(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "아이디어를 삭제하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="ideaThreadPage">
      <div className="ideaThreadShell">
        <CommunitySectionBreadcrumb current="우리동네 아이디어" />
        <section className="ideaHero">
          <div className="ideaHeroCopy">
            <p className="ideaEyebrow">MOIRA IDEA LAB · THREAD</p>
            <h1>
              같이 말할수록
              <br />
              아이디어는 선명해져요.
            </h1>
            <p>
              우리 동네에 필요한 변화와 다양한 아이디어를 자유롭게 제안하고,
              <br className="ideaHeroBreak" /> 함께 의견을 나눠보세요.
            </p>
          </div>
          <div className="ideaHeroVisual" aria-hidden="true">
            <span className="ideaVisualBulb">
              <IdeaIcon name="bulb" />
            </span>
            <span className="ideaVisualBubble ideaVisualBubbleOne">
              좋은 생각!
            </span>
            <span className="ideaVisualBubble ideaVisualBubbleTwo">
              함께 더해요
            </span>
            <i />
            <i />
            <i />
          </div>
        </section>
        {/* 고르러 온 상태임을 알려 준다. 버튼만 늘어나 있으면 왜 생겼는지 알 수 없다. */}
        {isPicking && (
          <div className="ideaPickBanner" role="status">
            <p>
              <strong>기획서에 참고할 주민 아이디어를 고르는 중입니다.</strong>{" "}
              마음에 드는 글의 선택 버튼을 누르면 MOIRA STUDIO로 돌아갑니다.
            </p>
            <button onClick={() => router.push("/studio")} type="button">
              고르지 않고 돌아가기
            </button>
          </div>
        )}
        {loadError && (
          <div className="threadLoadState" role="alert">
            <p>{loadError}</p>
            <button onClick={() => void loadIdeas()} type="button">
              다시 시도
            </button>
          </div>
        )}
        {isLoading ? (
          <div
            className="threadSkeleton"
            role="status"
            aria-label="아이디어를 불러오는 중입니다"
          >
            <div />
            <div />
            <div />
          </div>
        ) : (
          <div
            className={`threadWorkspace ${active ? "" : "isDetailClosed"} ${isDetailClosing ? "isClosing" : ""}`}
            style={
              active
                ? {
                    gridTemplateColumns: `minmax(0, 1fr) 12px minmax(440px, ${detailWidth}px)`,
                  }
                : undefined
            }
          >
            <section className="threadFeed" aria-label="아이디어 목록">
              <div className="threadToolbar">
                <div
                  className="threadTabs"
                  role="tablist"
                  aria-label="정렬 방식"
                >
                  {(["인기순", "최신순"] as const).map((item) => (
                    <button
                      aria-selected={sort === item}
                      className={sort === item ? "isActive" : ""}
                      key={item}
                      onClick={() => setSort(item)}
                      role="tab"
                      type="button"
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <div className="threadTools">
                  <select
                    aria-label="주제 필터"
                    className="threadFilter"
                    onChange={(event) => setCategory(event.target.value)}
                    value={category}
                  >
                    {categories.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                  <label className="threadSearch">
                    <IdeaIcon name="search" />
                    <span className="srOnly">아이디어 검색</span>
                    <input
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="아이디어 제목, 내용 검색"
                      type="search"
                      value={query}
                    />
                  </label>
                </div>
              </div>
              <div
                className="threadCards"
                role="listbox"
                aria-label="아이디어 목록"
              >
                {ordered.map((topic) => (
                  <article
                    aria-selected={selected === topic.id}
                    className={`threadCard ${selected === topic.id ? "isSelected" : ""}`}
                    key={topic.id}
                    onClick={() => selectTopic(topic.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectTopic(topic.id);
                      }
                    }}
                    role="option"
                    tabIndex={0}
                  >
                    <button
                      aria-label={`${topic.title} 좋아요`}
                      aria-pressed={likedTopics.includes(topic.id)}
                      className={`voteBox ${likedTopics.includes(topic.id) ? "isLiked" : ""}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleTopicLike(topic.id);
                      }}
                      type="button"
                    >
                      <span aria-hidden="true">◇</span>
                      <strong>{topic.votes}</strong>
                      <small>좋아요</small>
                    </button>
                    <div className="threadCardBody">
                      <div className="threadCardFlags">
                        <span>{topic.category}</span>
                        {isPicking && (
                          <button
                            className="ideaPickButton"
                            onClick={(event) => {
                              event.stopPropagation();
                              pickTopic(topic.id);
                            }}
                            type="button"
                          >
                            이 의제 선택하기
                          </button>
                        )}
                        <button
                          aria-label={`${topic.title} ${scrappedTopics.includes(topic.id) ? "스크랩 해제" : "스크랩"}`}
                          aria-pressed={scrappedTopics.includes(topic.id)}
                          className={`threadCardScrap ${scrappedTopics.includes(topic.id) ? "isScrapped" : ""}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleTopicScrap(topic.id);
                          }}
                          type="button"
                        >
                          <IdeaIcon name="bookmark" />
                        </button>
                      </div>
                      <h2>{topic.title}</h2>
                      <p>{topic.body}</p>
                      <footer>
                        <span className="ideaAvatar">{topic.author[0]}</span>
                        <span>
                          <strong>{topic.author}</strong> · {topic.role}
                        </span>
                        <span className="threadCommentCount">
                          <IdeaIcon name="message" />
                          {(repliesByTopic[topic.id] ?? []).length}
                        </span>
                        <time dateTime={topic.createdAt}>
                          {formatRelativeTime(topic.createdAt)}
                        </time>
                      </footer>
                    </div>
                  </article>
                ))}
              </div>
              {ordered.length === 0 && (
                <div className="threadEmpty">
                  <IdeaIcon name={topics.length ? "search" : "bulb"} />
                  <strong>
                    {topics.length
                      ? "검색 결과가 없습니다."
                      : "아직 등록된 아이디어가 없습니다."}
                  </strong>
                  <p>
                    {topics.length
                      ? "다른 검색어나 주제를 선택해 주세요."
                      : "새로운 아이디어가 등록되면 이곳에서 확인할 수 있습니다."}
                  </p>
                </div>
              )}
            </section>
            {active && (
              <div
                className="threadResizeHandle"
                role="separator"
                aria-label="아이디어 목록과 본문 너비 조절"
                aria-orientation="vertical"
                aria-valuemin={440}
                aria-valuemax={720}
                aria-valuenow={detailWidth}
                tabIndex={0}
                onKeyDown={(event) => {
                  const workspace = event.currentTarget.closest<HTMLElement>(
                    ".threadWorkspace",
                  );
                  if (!workspace) return;
                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    resizeDetail(
                      workspace.getBoundingClientRect().right - detailWidth - 20,
                      event.currentTarget,
                    );
                  }
                  if (event.key === "ArrowRight") {
                    event.preventDefault();
                    resizeDetail(
                      workspace.getBoundingClientRect().right - detailWidth + 20,
                      event.currentTarget,
                    );
                  }
                }}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  resizeDetail(event.clientX, event.currentTarget);
                }}
                onPointerMove={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId))
                    resizeDetail(event.clientX, event.currentTarget);
                }}
                onPointerUp={(event) =>
                  event.currentTarget.releasePointerCapture(event.pointerId)
                }
              >
                <span />
              </div>
            )}
            {active && (
              <aside
                className={`threadDetail ${isDetailClosing ? "isClosing" : "isOpening"}`}
                aria-label="선택한 아이디어 토론"
              >
                <div className="threadDetailHeader">
                  <span>{active.category}</span>
                  <button
                    aria-label="상세 닫기"
                    onClick={closeDetail}
                    type="button"
                  >
                    <IdeaIcon name="close" />
                  </button>
                </div>
                <h2>{active.title}</h2>
                <p>{active.body}</p>
                {actionError && <p className="threadActionError" role="alert">{actionError}</p>}
                <div className="threadTopicActions">
                  <button
                    aria-pressed={likedTopics.includes(active.id)}
                    className={
                      likedTopics.includes(active.id) ? "isActive" : ""
                    }
                    onClick={() => toggleTopicLike(active.id)}
                    type="button"
                  >
                    <span>♡</span> 좋아요{" "}
                    <strong>{active.votes}</strong>
                  </button>
                  <button
                    aria-pressed={scrappedTopics.includes(active.id)}
                    className={
                      scrappedTopics.includes(active.id) ? "isActive" : ""
                    }
                    onClick={() => toggleTopicScrap(active.id)}
                    type="button"
                  >
                    <IdeaIcon name="bookmark" />{" "}
                    {scrappedTopics.includes(active.id) ? "스크랩됨" : "스크랩"}
                  </button>
                  {isPicking && (
                    <button
                      className="ideaPickButton"
                      onClick={() => pickTopic(active.id)}
                      type="button"
                    >
                      이 의제로 기획서 만들기
                    </button>
                  )}
                  {(active.isOwner || active.canDelete) && (
                    <div className="threadOwnerActions" aria-label="내 아이디어 관리">
                      {active.isOwner && <button type="button" onClick={() => openEditTopic(active)}>수정</button>}
                      {active.canDelete && <button type="button" className="isDanger" disabled={isSubmitting} onClick={() => { setActionError(""); setDeletingTopic(active); }}>삭제</button>}
                    </div>
                  )}
                </div>
                <div className="threadAuthor">
                  <span className="ideaAvatar">{active.author[0]}</span>
                  <div>
                    <strong>{active.author}</strong>
                    <small>
                      {active.role} · {formatRelativeTime(active.createdAt)}
                    </small>
                  </div>
                </div>
                <div className="threadDiscussionTitle">
                  <strong>
                    대화 <span>{activeReplies.length}</span>
                  </strong>
                  <button
                    onClick={() =>
                      setReplySort((value) =>
                        value === "좋아요 순" ? "최신순" : "좋아요 순",
                      )
                    }
                    type="button"
                  >
                    {replySort} <span aria-hidden="true">↕</span>
                  </button>
                </div>
                <div className="replyList">
                  {orderedReplies.map((item) => (
                    <article
                      className={item.depth ? "isNested" : ""}
                      key={item.id}
                    >
                      <div>
                        <span className="ideaAvatar">{item.author[0]}</span>
                        <strong>{item.author}</strong>
                        <small>
                          {item.role} · {formatRelativeTime(item.createdAt)}
                        </small>
                      </div>
                      {item.parentAuthor && (
                        <span className="replyTarget">
                          @{item.parentAuthor}에게 답글
                        </span>
                      )}
                      <p>{item.body}</p>
                      <footer>
                        <button
                          className={
                            likedReplies.includes(item.id) ? "isLiked" : ""
                          }
                          onClick={() =>
                            setLikedReplies((items) =>
                              items.includes(item.id)
                                ? items.filter((id) => id !== item.id)
                                : [...items, item.id],
                            )
                          }
                          type="button"
                        >
                          ♡{" "}
                          {item.votes + Number(likedReplies.includes(item.id))}
                        </button>
                        <button
                          onClick={() => {
                            setReplyingTo({ id: item.id, author: item.author });
                            setReply("");
                          }}
                          type="button"
                        >
                          답글
                        </button>
                      </footer>
                    </article>
                  ))}
                </div>
                {activeReplies.length === 0 && (
                  <div className="threadEmpty threadReplyEmpty">
                    <IdeaIcon name="message" />
                    <strong>아직 댓글이 없어요.</strong>
                    <p>첫 번째 의견을 남겨보세요!</p>
                  </div>
                )}
                <form
                  className="replyComposer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitReply();
                  }}
                >
                  <div>
                    <label htmlFor="thread-reply">
                      {replyingTo
                        ? `${replyingTo.author}님에게 답글`
                        : "의견 남기기"}
                    </label>
                    {replyingTo && (
                      <button onClick={() => setReplyingTo(null)} type="button">
                        답글 취소
                      </button>
                    )}
                  </div>
                  <textarea
                    id="thread-reply"
                    maxLength={2000}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="아이디어가 더 좋아질 수 있는 생각을 나눠주세요."
                    value={reply}
                  />
                  {actionError && (
                    <p className="threadActionError" role="alert">
                      {actionError}
                    </p>
                  )}
                  <button
                    disabled={!reply.trim() || isSubmitting}
                    type="submit"
                  >
                    {isSubmitting
                      ? "등록 중…"
                      : replyingTo
                        ? "답글 남기기"
                        : "댓글 남기기"}
                  </button>
                </form>
              </aside>
            )}
          </div>
        )}
        <section className="ideaGuide">
          <span>
            <IdeaIcon name="bulb" />
          </span>
          <p>
            <strong>커뮤니티 기본 예절을 지켜주세요.</strong> 서로의 관점을
            존중하고, 비방이나 혐오 표현은 삼가며 개인정보를 공유하지 마세요.
          </p>
        </section>
        <button
          className="ideaFloatingButton"
          onClick={() => {
            setActionError("");
            setIsCreateOpen(true);
          }}
          type="button"
        >
          <span>
            <IdeaIcon name="plus" />
          </span>{" "}
          새 아이디어
        </button>
        {isCreateOpen && (
          <div
            className="ideaCreateModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="idea-create-title"
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitTopic();
              }}
            >
              <button
                aria-label="닫기"
                className="ideaCreateClose"
                onClick={() => setIsCreateOpen(false)}
                type="button"
              >
                ×
              </button>
              <p>NEW IDEA</p>
              <h2 id="idea-create-title">
                동네에 필요한 행사를 제안해 주세요.
              </h2>
              <label>
                주제
                <select
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      category: event.target.value,
                    }))
                  }
                  value={draft.category}
                >
                  {topicCategories.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                제목
                <input
                  maxLength={100}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      title: event.target.value,
                    }))
                  }
                  placeholder="아이디어를 한 문장으로 알려주세요."
                  value={draft.title}
                />
              </label>
              <label>
                내용
                <textarea
                  maxLength={5000}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      body: event.target.value,
                    }))
                  }
                  placeholder="어떤 행사인지 자유롭게 적어주세요."
                  value={draft.body}
                />
              </label>
              {actionError && (
                <p className="threadActionError" role="alert">
                  {actionError}
                </p>
              )}
              <div>
                <button
                  disabled={isSubmitting}
                  onClick={() => setIsCreateOpen(false)}
                  type="button"
                >
                  취소
                </button>
                <button
                  disabled={
                    !draft.title.trim() || !draft.body.trim() || isSubmitting
                  }
                  type="submit"
                >
                  {isSubmitting ? "등록 중…" : "아이디어 등록"}
                </button>
              </div>
            </form>
          </div>
        )}
        {editingTopicId && (
          <div className="ideaCreateModal" role="dialog" aria-modal="true" aria-labelledby="idea-edit-title">
            <form onSubmit={(event) => { event.preventDefault(); void submitEditTopic(); }}>
              <button aria-label="수정 창 닫기" className="ideaCreateClose" onClick={() => setEditingTopicId(null)} type="button">×</button>
              <p>EDIT IDEA</p>
              <h2 id="idea-edit-title">아이디어를 수정해 주세요.</h2>
              <label>주제<select value={editDraft.category} onChange={(event) => setEditDraft((value) => ({ ...value, category: event.target.value }))}>{topicCategories.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>제목<input maxLength={100} value={editDraft.title} onChange={(event) => setEditDraft((value) => ({ ...value, title: event.target.value }))} /></label>
              <label>내용<textarea maxLength={5000} value={editDraft.body} onChange={(event) => setEditDraft((value) => ({ ...value, body: event.target.value }))} /></label>
              {editError && <p className="threadActionError" role="alert">{editError}</p>}
              <div>
                <button disabled={isSubmitting} onClick={() => setEditingTopicId(null)} type="button">취소</button>
                <button disabled={!editDraft.title.trim() || !editDraft.body.trim() || isSubmitting} type="submit">{isSubmitting ? "수정 중…" : "수정 완료"}</button>
              </div>
            </form>
          </div>
        )}
        {deletingTopic && (
          <div className="ideaDeleteModal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSubmitting) setDeletingTopic(null); }}>
            <section role="alertdialog" aria-modal="true" aria-labelledby="idea-delete-title" aria-describedby="idea-delete-description">
              <span className="ideaDeleteIcon" aria-hidden="true">!</span>
              <p>DELETE IDEA</p>
              <h2 id="idea-delete-title">이 아이디어를 삭제하시겠어요?</h2>
              <strong>{deletingTopic.title}</strong>
              <p id="idea-delete-description">삭제한 아이디어와 댓글은 다시 복구할 수 없습니다.</p>
              {actionError && <p className="threadActionError" role="alert">{actionError}</p>}
              <div>
                <button type="button" disabled={isSubmitting} onClick={() => setDeletingTopic(null)}>취소</button>
                <button type="button" className="isDanger" disabled={isSubmitting} onClick={() => void deleteTopic(deletingTopic)}>{isSubmitting ? "삭제 중…" : "삭제하기"}</button>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

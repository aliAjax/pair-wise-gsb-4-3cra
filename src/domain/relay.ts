// 接力判定：拆段、领取、录音、点评、退回级联。全部为纯函数，不碰存储与界面。
import type {
  Claim,
  Lesson,
  RecordingVersion,
  RelayState,
  Segment,
  Student,
} from './types';

export const RULES = {
  FIRST_VACANCY: '学生只能领取首个空缺片段',
  PREV_MUST_PASS: '前一片段未通过时，后续片段不能录音',
  RETURN_CASCADE: '教师退回重读时，新录音另存版本，原片段及后续接力退回待重录，旧成绩不覆盖',
  ONE_ACTIVE: '同一片段每人只留一条有效录音',
  CANCEL_RELEASE: '取消领取会释放位置',
} as const;

export type SegmentStatus =
  | 'locked' // 前一片段未通过
  | 'open' // 空缺可领取（必为首个空缺）
  | 'claimed' // 已领取待录音
  | 'submitted' // 已录音待点评
  | 'returned' // 被退回待重录
  | 'passed'; // 已通过

export interface Blocker {
  objectName: string; // 受阻对应的对象（哪个片段、谁、进行到哪一步）
  rule: string; // 触发哪条规则
}

export interface SegmentView {
  segment: Segment;
  status: SegmentStatus;
  claim: Claim | null; // 当前有效领取
  claimer: Student | null;
  recording: RecordingVersion | null; // 领取人的有效录音
  versions: RecordingVersion[]; // 该片段全部历史版本（新→旧）
  blockers: Blocker[]; // locked 时给出对象与规则
}

export type Outcome =
  | { ok: true; state: RelayState }
  | { ok: false; error: { code: string; message: string; blockers?: Blocker[] } };

const ok = (state: RelayState): Outcome => ({ ok: true, state });
const fail = (code: string, message: string, blockers?: Blocker[]): Outcome => ({
  ok: false,
  error: { code, message, blockers },
});

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const nowIso = () => new Date().toISOString();

/** 课文拆段：按句读（。！？；…）切成有序片段，保留标点。 */
export function splitLessonText(raw: string): string[] {
  const parts = raw.match(/[^。！？；…]+[。！？；…]?/g) ?? [];
  return parts.map((p) => p.trim()).filter(Boolean);
}

export function findLessonOfSegment(state: RelayState, segmentId: string): Lesson | null {
  return state.lessons.find((l) => l.segments.some((s) => s.id === segmentId)) ?? null;
}

export function activeClaimOf(state: RelayState, segmentId: string): Claim | null {
  return (
    state.claims.find((c) => c.segmentId === segmentId && c.status === 'active') ?? null
  );
}

export function activeRecordingOf(
  state: RelayState,
  segmentId: string,
  studentId: string,
): RecordingVersion | null {
  return (
    state.recordings.find(
      (r) => r.segmentId === segmentId && r.studentId === studentId && r.active,
    ) ?? null
  );
}

export function isSegmentPassed(state: RelayState, segmentId: string): boolean {
  const claim = activeClaimOf(state, segmentId);
  if (!claim) return false;
  return activeRecordingOf(state, segmentId, claim.studentId)?.status === 'passed';
}

export function excerpt(text: string, max = 14): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** 计算单个片段的接力视图（状态、领取人、有效录音、受阻原因）。 */
export function getSegmentView(
  state: RelayState,
  lesson: Lesson,
  segment: Segment,
): SegmentView {
  const claim = activeClaimOf(state, segment.id);
  const claimer = claim
    ? state.students.find((s) => s.id === claim.studentId) ?? null
    : null;
  const recording = claimer
    ? activeRecordingOf(state, segment.id, claimer.id)
    : null;
  const versions = state.recordings
    .filter((r) => r.segmentId === segment.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  let status: SegmentStatus;
  if (recording?.status === 'passed') status = 'passed';
  else if (segment.order > 1 && !isPrevPassed(state, lesson, segment.order)) status = 'locked';
  else if (!claim) status = 'open';
  else if (!recording) status = 'claimed';
  else status = recording.status === 'pending' ? 'submitted' : 'returned';

  const blockers: Blocker[] = [];
  if (status === 'locked') {
    const prev = lesson.segments.find((s) => s.order === segment.order - 1);
    if (prev) {
      const prevClaim = activeClaimOf(state, prev.id);
      const prevClaimer = prevClaim
        ? state.students.find((s) => s.id === prevClaim.studentId) ?? null
        : null;
      const prevRec = prevClaimer
        ? activeRecordingOf(state, prev.id, prevClaimer.id)
        : null;
      const stage = !prevClaim
        ? '待领取'
        : !prevRec
          ? '待录音'
          : prevRec.status === 'pending'
            ? '待教师点评'
            : prevRec.status === 'returned'
              ? '被退回待重录'
              : '未通过';
      blockers.push({
        objectName: `片段 ${prev.order}「${excerpt(prev.text)}」· ${
          prevClaimer ? prevClaimer.name : '暂无领取人'
        } · ${stage}`,
        rule: RULES.PREV_MUST_PASS,
      });
    }
  }
  return { segment, status, claim, claimer, recording, versions, blockers };
}

function isPrevPassed(state: RelayState, lesson: Lesson, order: number): boolean {
  const prev = lesson.segments.find((s) => s.order === order - 1);
  return prev ? isSegmentPassed(state, prev.id) : true;
}

export function getLessonView(state: RelayState, lesson: Lesson): SegmentView[] {
  return lesson.segments.map((s) => getSegmentView(state, lesson, s));
}

/** 首个空缺片段（状态为 open 的那一段，不变量保证至多一个）。 */
export function firstVacancy(state: RelayState, lesson: Lesson): SegmentView | null {
  return getLessonView(state, lesson).find((v) => v.status === 'open') ?? null;
}

// ---------- 领取 ----------

export function claimSegment(
  state: RelayState,
  lessonId: string,
  segmentId: string,
  studentId: string,
): Outcome {
  const lesson = state.lessons.find((l) => l.id === lessonId);
  const segment = lesson?.segments.find((s) => s.id === segmentId);
  if (!lesson || !segment) return fail('NOT_FOUND', '找不到对应的课文片段。');

  const view = getSegmentView(state, lesson, segment);
  if (view.status === 'locked') {
    return fail(
      'SEGMENT_LOCKED',
      `片段 ${segment.order} 暂时不能领取：${RULES.FIRST_VACANCY}。`,
      view.blockers,
    );
  }
  if (view.status !== 'open') {
    return fail(
      'SEGMENT_TAKEN',
      `片段 ${segment.order} 已由 ${view.claimer?.name ?? '其他同学'} 领取，不能重复占位。`,
    );
  }

  const claim: Claim = {
    id: uid('claim'),
    segmentId,
    studentId,
    status: 'active',
    claimedAt: nowIso(),
    releasedAt: null,
    releaseReason: null,
  };
  return ok({ ...state, claims: [...state.claims, claim] });
}

/** 取消领取：释放位置。待点评/已通过的录音不允许取消；退回中的有效录音一并失效（历史版本保留）。 */
export function cancelClaim(state: RelayState, claimId: string): Outcome {
  const claim = state.claims.find((c) => c.id === claimId);
  if (!claim || claim.status !== 'active') return fail('NOT_FOUND', '这条领取记录已不存在。');

  const rec = activeRecordingOf(state, claim.segmentId, claim.studentId);
  if (rec?.status === 'pending') {
    return fail('UNDER_REVIEW', '录音正在等待教师点评，暂时不能取消领取。');
  }
  if (rec?.status === 'passed') {
    return fail('ALREADY_PASSED', '该片段已通过，接力继续向前，不能取消领取。');
  }

  const claims = state.claims.map((c) =>
    c.id === claimId
      ? { ...c, status: 'released' as const, releasedAt: nowIso(), releaseReason: 'cancelled' as const }
      : c,
  );
  const recordings = state.recordings.map((r) =>
    rec && r.id === rec.id ? { ...r, active: false } : r,
  );
  return ok({ ...state, claims, recordings });
}

// ---------- 录音 ----------

/** 提交录音：新录音另存版本，同一片段本人的旧有效录音转为历史版本（不删除、不覆盖成绩）。 */
export function submitRecording(
  state: RelayState,
  segmentId: string,
  studentId: string,
  seconds: number,
): Outcome {
  const lesson = findLessonOfSegment(state, segmentId);
  const segment = lesson?.segments.find((s) => s.id === segmentId);
  if (!lesson || !segment) return fail('NOT_FOUND', '找不到对应的课文片段。');

  const claim = activeClaimOf(state, segmentId);
  if (!claim || claim.studentId !== studentId) {
    return fail('NOT_CLAIMED', '只有领取该片段的同学才能录音。');
  }
  if (segment.order > 1 && !isPrevPassed(state, lesson, segment.order)) {
    const view = getSegmentView(state, lesson, segment);
    return fail(
      'PREV_NOT_PASSED',
      `片段 ${segment.order} 暂时不能录音：${RULES.PREV_MUST_PASS}。`,
      view.blockers,
    );
  }

  const mine = state.recordings.filter(
    (r) => r.segmentId === segmentId && r.studentId === studentId,
  );
  const version = mine.reduce((max, r) => Math.max(max, r.version), 0) + 1;
  const recording: RecordingVersion = {
    id: uid('rec'),
    segmentId,
    studentId,
    version,
    seconds: Math.max(1, Math.round(seconds)),
    createdAt: nowIso(),
    status: 'pending',
    score: null,
    comment: null,
    active: true,
  };
  const recordings = state.recordings
    .map((r) =>
      r.segmentId === segmentId && r.studentId === studentId && r.active
        ? { ...r, active: false }
        : r,
    )
    .concat(recording);
  return ok({ ...state, recordings });
}

// ---------- 教师点评 ----------

export interface ReviewDecision {
  pass: boolean;
  score?: number;
  comment?: string;
}

/**
 * 教师点评。
 * 通过：打分并放行下一片段。
 * 退回：该生需重读，新录音另存版本；后续片段的有效录音转为历史（旧成绩不覆盖）、领取释放，接力退回待重录。
 */
export function reviewRecording(
  state: RelayState,
  recordingId: string,
  decision: ReviewDecision,
): Outcome {
  const rec = state.recordings.find((r) => r.id === recordingId);
  if (!rec || !rec.active) return fail('NOT_FOUND', '这条录音已不是有效版本，无法点评。');

  if (decision.pass) {
    if (rec.status !== 'pending') return fail('ALREADY_REVIEWED', '这条录音已经点评过了。');
    const score = decision.score;
    if (score == null || Number.isNaN(score) || score < 0 || score > 100) {
      return fail('SCORE_REQUIRED', '通过时需要给出 0–100 的成绩。');
    }
    const recordings = state.recordings.map((r) =>
      r.id === rec.id
        ? { ...r, status: 'passed' as const, score: Math.round(score), comment: decision.comment?.trim() || null }
        : r,
    );
    return ok({ ...state, recordings });
  }

  // 退回重读
  if (rec.status === 'returned') return fail('ALREADY_RETURNED', '这条录音已经处于退回状态。');
  const comment = decision.comment?.trim();
  if (!comment) return fail('COMMENT_REQUIRED', '退回重读时需要写明评语，告诉学生问题在哪。');

  const lesson = findLessonOfSegment(state, rec.segmentId);
  const segment = lesson?.segments.find((s) => s.id === rec.segmentId);
  if (!lesson || !segment) return fail('NOT_FOUND', '找不到对应的课文片段。');

  const laterIds = new Set(
    lesson.segments.filter((s) => s.order > segment.order).map((s) => s.id),
  );

  const recordings = state.recordings.map((r) => {
    if (r.id === rec.id) {
      // 状态置为退回，但保留原成绩与版本记录（旧成绩不覆盖）
      return { ...r, status: 'returned' as const, comment };
    }
    // 后续接力的有效录音退回待重录：转为历史版本，成绩保留不覆盖
    if (laterIds.has(r.segmentId) && r.active) return { ...r, active: false };
    return r;
  });
  const claims = state.claims.map((c) =>
    laterIds.has(c.segmentId) && c.status === 'active'
      ? {
          ...c,
          status: 'released' as const,
          releasedAt: nowIso(),
          releaseReason: 'returned-cascade' as const,
        }
      : c,
  );
  return ok({ ...state, recordings, claims });
}

// ---------- 统计 ----------

export function lessonStats(state: RelayState, lesson: Lesson) {
  const views = getLessonView(state, lesson);
  const passed = views.filter((v) => v.status === 'passed').length;
  const vacancy = views.find((v) => v.status === 'open') ?? null;
  const pendingReview = views.filter((v) => v.status === 'submitted').length;
  return { total: views.length, passed, vacancy, pendingReview, views };
}

export function studentStats(state: RelayState, lesson: Lesson, studentId: string) {
  const views = getLessonView(state, lesson);
  const mine = views.filter((v) => v.claim?.studentId === studentId);
  const activeRecordings = state.recordings.filter(
    (r) =>
      r.studentId === studentId &&
      r.active &&
      lesson.segments.some((s) => s.id === r.segmentId),
  );
  return {
    claimed: mine.length,
    passed: mine.filter((v) => v.status === 'passed').length,
    toRedo: mine.filter((v) => v.status === 'returned').length,
    waitingReview: mine.filter((v) => v.status === 'submitted').length,
    activeRecordings: activeRecordings.length,
  };
}

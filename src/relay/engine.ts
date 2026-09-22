// 接力判定层：全部规则以纯函数实现，输入状态与课文资料，输出新状态或受阻原因。
import type { Lesson, Segment, Student } from '../data/lessons';

export type RecordingStatus = 'pending' | 'passed' | 'returned' | 'superseded';

export interface Recording {
  id: string;
  segmentId: string;
  studentId: string;
  version: number;
  seconds: number;
  score: number | null;
  status: RecordingStatus;
  note?: string;
  createdAt: string;
}

export interface Claim {
  segmentId: string;
  studentId: string;
  claimedAt: string;
}

export interface RelayState {
  lessonId: string;
  claims: Claim[];
  recordings: Recording[];
}

export const emptyRelayState = (lessonId: string): RelayState => ({
  lessonId,
  claims: [],
  recordings: [],
});

/** 受阻结果：始终携带受阻对象与对应规则，供界面展示。 */
export interface RuleBlock {
  ok: false;
  rule: string;
  objectType: '片段' | '学生' | '录音';
  objectLabel: string;
  detail: string;
}
export type RuleResult = { ok: true } | RuleBlock;

const block = (
  rule: string,
  objectType: RuleBlock['objectType'],
  objectLabel: string,
  detail: string,
): RuleBlock => ({ ok: false, rule, objectType, objectLabel, detail });

export const isBlock = (x: unknown): x is RuleBlock =>
  typeof x === 'object' && x !== null && (x as RuleBlock).ok === false;

export const orderedSegments = (lesson: Lesson): Segment[] =>
  [...lesson.segments].sort((a, b) => a.order - b.order);

export const segmentLabel = (lesson: Lesson, segmentId: string): string => {
  const seg = lesson.segments.find(s => s.id === segmentId);
  return seg ? `片段 ${seg.order}` : '未知片段';
};

/** 同一片段每人只留一条有效录音：取每人每片的最高版本。 */
export function activeRecordingMap(state: RelayState): Map<string, Recording> {
  const map = new Map<string, Recording>();
  for (const r of state.recordings) {
    const key = `${r.segmentId}::${r.studentId}`;
    const cur = map.get(key);
    if (!cur || r.version > cur.version) map.set(key, r);
  }
  return map;
}

export function activeRecordingsFor(state: RelayState, segmentId: string): Recording[] {
  return [...activeRecordingMap(state).values()].filter(r => r.segmentId === segmentId);
}

const claimOf = (state: RelayState, segmentId: string) =>
  state.claims.find(c => c.segmentId === segmentId);

const hasActive = (state: RelayState, segmentId: string, status: RecordingStatus) =>
  activeRecordingsFor(state, segmentId).some(r => r.status === status);

/** 首个空缺片段：按顺序第一个未通过、无待审录音且无人领取的片段。 */
export function firstOpenSegmentId(state: RelayState, lesson: Lesson): string | null {
  for (const seg of orderedSegments(lesson)) {
    if (hasActive(state, seg.id, 'passed')) continue;
    if (hasActive(state, seg.id, 'pending')) continue;
    if (claimOf(state, seg.id)) continue;
    return seg.id;
  }
  return null;
}

export type SegmentStatus = 'passed' | 'pending' | 'returned' | 'claimed' | 'open' | 'locked';

export function segmentStatus(state: RelayState, lesson: Lesson, segmentId: string): SegmentStatus {
  if (hasActive(state, segmentId, 'passed')) return 'passed';
  if (hasActive(state, segmentId, 'pending')) return 'pending';
  if (claimOf(state, segmentId)) return 'claimed';
  if (hasActive(state, segmentId, 'returned')) return 'returned';
  return firstOpenSegmentId(state, lesson) === segmentId ? 'open' : 'locked';
}

export function canClaim(
  state: RelayState,
  lesson: Lesson,
  students: Student[],
  studentId: string,
  segmentId: string,
): RuleResult {
  const seg = lesson.segments.find(s => s.id === segmentId);
  if (!seg) return block('片段不存在', '片段', segmentId, '该片段不在当前课文中。');
  const label = segmentLabel(lesson, segmentId);
  if (hasActive(state, segmentId, 'passed'))
    return block('已通过片段不可再领取', '片段', label, '该片段已有通过的有效录音，接力继续向后进行。');
  if (hasActive(state, segmentId, 'pending'))
    return block('待审核片段不可领取', '片段', label, '该片段的录音正在等待教师审核。');
  const claim = claimOf(state, segmentId);
  if (claim) {
    const holder = students.find(s => s.id === claim.studentId)?.name ?? claim.studentId;
    return block('片段已被领取', '学生', holder, `该片段正由 ${holder} 持有，可等待其完成或取消领取。`);
  }
  const mine = state.claims.find(c => c.studentId === studentId);
  if (mine)
    return block('每人同时只能领取一个片段', '片段', segmentLabel(lesson, mine.segmentId), '请先完成或取消当前领取，再领取新的片段。');
  const firstOpen = firstOpenSegmentId(state, lesson);
  if (firstOpen !== segmentId)
    return block(
      '只能领取首个空缺片段',
      '片段',
      firstOpen ? segmentLabel(lesson, firstOpen) : '无空缺',
      firstOpen
        ? `当前首个空缺为${segmentLabel(lesson, firstOpen)}，请按接力顺序领取。`
        : '全部片段均已完成或正在进行中。',
    );
  return { ok: true };
}

export function canRecord(
  state: RelayState,
  lesson: Lesson,
  students: Student[],
  studentId: string,
  segmentId: string,
): RuleResult {
  const seg = lesson.segments.find(s => s.id === segmentId);
  if (!seg) return block('片段不存在', '片段', segmentId, '该片段不在当前课文中。');
  const label = segmentLabel(lesson, segmentId);
  const claim = claimOf(state, segmentId);
  if (!claim || claim.studentId !== studentId) {
    const holder = claim ? students.find(s => s.id === claim.studentId)?.name ?? claim.studentId : null;
    return block('只有领取人可录音', '片段', label, holder ? `该片段由 ${holder} 领取。` : '请先在接力轨道领取该片段。');
  }
  for (const prev of orderedSegments(lesson)) {
    if (prev.order >= seg.order) break;
    if (!hasActive(state, prev.id, 'passed'))
      return block('前一片段未通过，后续不能录音', '片段', segmentLabel(lesson, prev.id), `${segmentLabel(lesson, prev.id)}尚未通过审核，完成前序接力后才能录制本片段。`);
  }
  return { ok: true };
}

export function claimSegment(
  state: RelayState,
  lesson: Lesson,
  students: Student[],
  studentId: string,
  segmentId: string,
): RelayState | RuleBlock {
  const check = canClaim(state, lesson, students, studentId, segmentId);
  if (!check.ok) return check;
  return {
    ...state,
    claims: [...state.claims, { segmentId, studentId, claimedAt: new Date().toISOString() }],
  };
}

/** 取消领取即释放位置；已有待审录音时须先等审核结束。 */
export function cancelClaim(
  state: RelayState,
  lesson: Lesson,
  studentId: string,
  segmentId: string,
): RelayState | RuleBlock {
  const label = segmentLabel(lesson, segmentId);
  const claim = claimOf(state, segmentId);
  if (!claim || claim.studentId !== studentId)
    return block('只能取消自己的领取', '片段', label, '该片段当前不由你持有。');
  if (hasActive(state, segmentId, 'pending'))
    return block('待审核录音存在时不能取消领取', '录音', `${label} · 待审核录音`, '请等待教师完成审核后再释放位置。');
  return {
    ...state,
    claims: state.claims.filter(c => !(c.segmentId === segmentId && c.studentId === studentId)),
  };
}

/** 提交录音：另存为新版本；同一人同一片段的旧待审录音转为失效，历史版本与成绩保留。 */
export function submitRecording(
  state: RelayState,
  lesson: Lesson,
  students: Student[],
  studentId: string,
  segmentId: string,
  seconds: number,
): { state: RelayState; recording: Recording } | RuleBlock {
  const check = canRecord(state, lesson, students, studentId, segmentId);
  if (!check.ok) return check;
  const existing = state.recordings.filter(r => r.segmentId === segmentId && r.studentId === studentId);
  const version = existing.reduce((m, r) => Math.max(m, r.version), 0) + 1;
  const recordings = state.recordings.map(r =>
    r.segmentId === segmentId && r.studentId === studentId && r.status === 'pending'
      ? { ...r, status: 'superseded' as RecordingStatus }
      : r,
  );
  const recording: Recording = {
    id: `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${segmentId}-${studentId}-v${version}`,
    segmentId,
    studentId,
    version,
    seconds,
    score: null,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  return { state: { ...state, recordings: [...recordings, recording] }, recording };
}

/**
 * 教师审核。通过：成绩写入该版本并释放领取位置。
 * 退回：本片段及后续接力的有效录音全部退回待重录，旧版本与成绩保留不覆盖。
 */
export function reviewRecording(
  state: RelayState,
  lesson: Lesson,
  recordingId: string,
  decision: 'pass' | 'return',
  score?: number,
  note?: string,
): { state: RelayState; cascaded: number } | RuleBlock {
  const rec = state.recordings.find(r => r.id === recordingId);
  if (!rec) return block('录音不存在', '录音', recordingId, '该录音版本不在当前记录中。');
  const label = `${segmentLabel(lesson, rec.segmentId)} · v${rec.version}`;
  if (decision === 'pass') {
    return {
      state: {
        ...state,
        recordings: state.recordings.map(r =>
          r.id === recordingId ? { ...r, status: 'passed' as RecordingStatus, score: score ?? r.score } : r,
        ),
        claims: state.claims.filter(c => c.segmentId !== rec.segmentId),
      },
      cascaded: 0,
    };
  }
  const seg = lesson.segments.find(s => s.id === rec.segmentId);
  if (!seg) return block('片段不存在', '片段', rec.segmentId, '该录音对应的片段不在当前课文中。');
  const laterIds = new Set(lesson.segments.filter(s => s.order >= seg.order).map(s => s.id));
  const active = activeRecordingMap(state);
  const returnedIds = new Set(
    [...active.values()]
      .filter(r => laterIds.has(r.segmentId) && (r.status === 'pending' || r.status === 'passed'))
      .map(r => r.id),
  );
  returnedIds.add(rec.id);
  return {
    state: {
      ...state,
      recordings: state.recordings.map(r =>
        returnedIds.has(r.id)
          ? {
              ...r,
              status: 'returned' as RecordingStatus,
              score: r.id === rec.id ? score ?? r.score : r.score,
              note: r.id === rec.id ? note : r.note,
            }
          : r,
      ),
      claims: state.claims.filter(c => !laterIds.has(c.segmentId)),
    },
    cascaded: returnedIds.size,
  };
}

/** 退回影响的后续接力条数（含目标录音本身），供界面预告。 */
export function returnCascadeCount(state: RelayState, lesson: Lesson, recordingId: string): number {
  const rec = state.recordings.find(r => r.id === recordingId);
  const seg = rec && lesson.segments.find(s => s.id === rec.segmentId);
  if (!rec || !seg) return 0;
  const laterIds = new Set(lesson.segments.filter(s => s.order >= seg.order).map(s => s.id));
  return [...activeRecordingMap(state).values()].filter(
    r => laterIds.has(r.segmentId) && (r.status === 'pending' || r.status === 'passed'),
  ).length;
}

export function relayProgress(state: RelayState, lesson: Lesson) {
  const segs = orderedSegments(lesson);
  const statusOf = (s: Segment) => segmentStatus(state, lesson, s.id);
  return {
    total: segs.length,
    passed: segs.filter(s => statusOf(s) === 'passed').length,
    pending: segs.filter(s => statusOf(s) === 'pending').length,
    returned: segs.filter(s => statusOf(s) === 'returned').length,
    claimed: state.claims.length,
  };
}

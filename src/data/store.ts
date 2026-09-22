// 持久化：localStorage 读写与初始数据。重开后课文、片段、学生、版本与接力顺序保持一致。
import { LESSONS, STUDENTS } from './lessons';
import type { RelayState } from '../domain/types';

const STORAGE_KEY = 'reading-relay-state-v1';

/** 初始接力进度：一篇已推进、一篇有待点评、一篇有待重录，便于打开即看到完整规则。 */
export function seedState(): RelayState {
  const t = (hm: string) => `2026-09-22T${hm}:00`;
  return {
    lessons: LESSONS,
    students: STUDENTS,
    claims: [
      { id: 'c1', segmentId: 'l1-s1', studentId: 'stu1', status: 'active', claimedAt: t('08:12'), releasedAt: null, releaseReason: null },
      { id: 'c2', segmentId: 'l1-s2', studentId: 'stu2', status: 'active', claimedAt: t('08:20'), releasedAt: null, releaseReason: null },
      { id: 'c3', segmentId: 'l2-s1', studentId: 'stu3', status: 'active', claimedAt: t('08:40'), releasedAt: null, releaseReason: null },
    ],
    recordings: [
      { id: 'r1', segmentId: 'l1-s1', studentId: 'stu1', version: 1, seconds: 14, createdAt: t('08:15'), status: 'passed', score: 92, comment: '气息稳定，“天下奇观”的赞叹感读出来了。', active: true },
      { id: 'r2', segmentId: 'l1-s2', studentId: 'stu2', version: 1, seconds: 11, createdAt: t('08:26'), status: 'pending', score: null, comment: null, active: true },
      { id: 'r3', segmentId: 'l2-s1', studentId: 'stu3', version: 1, seconds: 16, createdAt: t('08:47'), status: 'returned', score: null, comment: '“田田”的叠音要读得轻快一些，再录一版。', active: true },
    ],
  };
}

function isValidState(value: unknown): value is RelayState {
  if (!value || typeof value !== 'object') return false;
  const s = value as RelayState;
  return (
    Array.isArray(s.lessons) &&
    Array.isArray(s.students) &&
    Array.isArray(s.claims) &&
    Array.isArray(s.recordings)
  );
}

export function loadState(): RelayState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed: unknown = JSON.parse(raw);
    return isValidState(parsed) ? parsed : seedState();
  } catch {
    return seedState();
  }
}

export function saveState(state: RelayState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时静默失败，界面仍可正常使用
  }
}

export function resetState(): RelayState {
  const fresh = seedState();
  saveState(fresh);
  return fresh;
}

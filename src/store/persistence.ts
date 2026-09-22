// 持久化层：负责接力状态的读写与校验，保证重开后课文、片段、学生、版本与接力顺序一致。
import type { Lesson, Student } from '../data/lessons';
import type { RelayState } from '../relay/engine';

const KEY = 'reading-relay/v1';

/** 读取本地状态；若课文、片段或学生对不上（资料已变更），视为无效并丢弃。 */
export function loadRelayState(lesson: Lesson, students: Student[]): RelayState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RelayState;
    if (parsed.lessonId !== lesson.id) return null;
    if (!Array.isArray(parsed.claims) || !Array.isArray(parsed.recordings)) return null;
    const segIds = new Set(lesson.segments.map(s => s.id));
    const stuIds = new Set(students.map(s => s.id));
    const valid =
      parsed.claims.every(c => segIds.has(c.segmentId) && stuIds.has(c.studentId)) &&
      parsed.recordings.every(r => segIds.has(r.segmentId) && stuIds.has(r.studentId));
    return valid ? parsed : null;
  } catch {
    return null;
  }
}

export function saveRelayState(state: RelayState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时保持静默，界面状态仍然可用
  }
}

export function resetRelayState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

// 领域模型：课文、片段、学生、领取、录音版本

export interface Segment {
  id: string;
  order: number; // 在课文中的顺序，从 1 开始
  text: string;
  hint: string; // 朗读提示
}

export interface Lesson {
  id: string;
  title: string;
  author: string;
  grade: string; // 适用年级
  source: string; // 课文出处
  rawText: string; // 原文（拆分依据）
  segments: Segment[]; // 有序片段
}

export interface Student {
  id: string;
  name: string;
  initials: string;
  color: string; // 头像底色
}

export type RecordingStatus = 'pending' | 'passed' | 'returned';

export interface RecordingVersion {
  id: string;
  segmentId: string;
  studentId: string;
  version: number; // 该学生在此片段上的第几版，从 1 递增
  seconds: number;
  createdAt: string; // ISO 时间
  status: RecordingStatus;
  score: number | null; // 通过后由教师打分；退回后仍保留在版本档案里（旧成绩不覆盖）
  comment: string | null; // 教师评语
  active: boolean; // 同一片段每人只有一条 active 有效录音，历史版本保留不覆盖
}

export type ClaimStatus = 'active' | 'released';

export interface Claim {
  id: string;
  segmentId: string;
  studentId: string;
  status: ClaimStatus;
  claimedAt: string;
  releasedAt: string | null;
  releaseReason: 'cancelled' | 'returned-cascade' | null; // 主动取消 / 教师退回牵连
}

export interface RelayState {
  lessons: Lesson[];
  students: Student[];
  claims: Claim[];
  recordings: RecordingVersion[];
}

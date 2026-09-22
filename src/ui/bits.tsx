// 共享界面小组件：状态徽章、头像、模拟声波、提示条。
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { SegmentStatus } from '../domain/relay';
import type { RecordingStatus, Student } from '../domain/types';
import type { Toast } from './useRelayStore';

export const SEGMENT_STATUS_META: Record<SegmentStatus, { label: string; className: string }> = {
  locked: { label: '未解锁', className: 'pill locked' },
  open: { label: '待领取', className: 'pill open' },
  claimed: { label: '待录音', className: 'pill claimed' },
  submitted: { label: '待点评', className: 'pill submitted' },
  returned: { label: '待重录', className: 'pill returned' },
  passed: { label: '已通过', className: 'pill passed' },
};

export const RECORDING_STATUS_META: Record<RecordingStatus, { label: string; className: string }> = {
  pending: { label: '待点评', className: 'pill submitted' },
  passed: { label: '已通过', className: 'pill passed' },
  returned: { label: '已退回', className: 'pill returned' },
};

export function StatusPill({ status }: { status: SegmentStatus }) {
  const meta = SEGMENT_STATUS_META[status];
  return <span className={meta.className}>{meta.label}</span>;
}

export function Avatar({ student, size = 28 }: { student: Student; size?: number }) {
  return (
    <span
      className="avatar-dot"
      style={{
        width: size,
        height: size,
        background: `${student.color}1f`,
        color: student.color,
        fontSize: size * 0.42,
      }}
    >
      {student.initials}
    </span>
  );
}

const BARS = Array.from({ length: 56 }, (_, i) => 16 + ((i * 29) % 46));

export function Wave({ live = false, tall = false }: { live?: boolean; tall?: boolean }) {
  return (
    <div className={tall ? 'wave tall' : 'wave'}>
      {BARS.map((h, i) => (
        <i
          key={i}
          className={live ? 'live' : ''}
          style={{ height: `${h * (live ? 0.45 + ((i % 5) / 7) : 0.42)}%` }}
        />
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Toasts({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={t.kind === 'error' ? 'toast error' : 'toast ok'}>
          {t.kind === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

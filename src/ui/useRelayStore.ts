// 界面与持久化之间的桥：状态变更即落盘，操作失败弹出提示。
import { useCallback, useEffect, useState } from 'react';
import type { Outcome } from '../domain/relay';
import type { RelayState } from '../domain/types';
import { loadState, resetState, saveState } from '../data/store';

export interface Toast {
  id: number;
  kind: 'ok' | 'error';
  text: string;
}

export function useRelayStore() {
  const [state, setState] = useState<RelayState>(loadState);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const pushToast = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts, { id, kind, text }]);
    window.setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 4200);
  }, []);

  /** 应用一次领域操作：成功落盘，失败提示（含受阻对象与规则）。 */
  const apply = useCallback(
    (outcome: Outcome, successText?: string) => {
      if (outcome.ok) {
        setState(outcome.state);
        if (successText) pushToast('ok', successText);
      } else {
        const blocked = outcome.error.blockers
          ?.map((b) => `${b.objectName}（${b.rule}）`)
          .join('；');
        pushToast('error', blocked ? `${outcome.error.message} 受阻：${blocked}` : outcome.error.message);
      }
      return outcome.ok;
    },
    [pushToast],
  );

  const reset = useCallback(() => {
    setState(resetState());
    pushToast('ok', '已恢复初始接力数据。');
  }, [pushToast]);

  return { state, apply, reset, toasts };
}

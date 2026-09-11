import { useState, useEffect } from 'react';
import { getAccessToken } from '../../../auth/session';
import { refreshSession, request } from '../../../auth/apiClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const statuses = new Set(['PENDING', 'GENERATING', 'IN_PROGRESS', 'EVALUATING', 'COMPLETED', 'FAILED']);
export const useInterviewSSE = (sessionId: string) => {
  const [sseStatus, setSseStatus] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let refreshed = false;
    const update = (status: unknown) => {
      if (typeof status === 'string' && statuses.has(status) && !controller.signal.aborted) setSseStatus(status);
    };
    const poll = async () => {
      if (controller.signal.aborted) return;
      try {
        const data = await request<{status: string}>(`interviews/${sessionId}`, { signal: controller.signal });
        update(data.status);
        if (['COMPLETED','FAILED'].includes(data.status)) return;
      } catch { if (!controller.signal.aborted) setError(new Error('Không thể tải trạng thái phiên.')); }
      if (!controller.signal.aborted) pollTimer = setTimeout(poll, 5000);
    };
    const connect = async (attempt = 0): Promise<void> => {
      try {
        const token = getAccessToken();
        const response = await fetch(`${API_URL}/interviews/${sessionId}/stream`, {
          headers: { Authorization: `Bearer ${token ?? ''}`, Accept: 'text/event-stream' }, signal: controller.signal,
        });
        if (response.status === 401 && !refreshed) {
          refreshed = true; await refreshSession();
          if (!controller.signal.aborted) return connect(attempt);
          return;
        }
        if (!response.ok || !response.body) throw new Error('Stream unavailable');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let pending = '';
        try {
          while (!controller.signal.aborted) {
            const { done, value } = await reader.read();
            if (done) break;
            pending += decoder.decode(value, { stream: true }).replaceAll('\r\n','\n');
            if (pending.length > 8192) throw new Error('Invalid stream');
            const frames = pending.split('\n\n'); pending = frames.pop() ?? '';
            for (const frame of frames) {
              const line = frame.split('\n').find(l => l.startsWith('data: '));
              if (!line) continue;
              const data = JSON.parse(line.slice(6));
              update(data.status);
              if (['COMPLETED','FAILED'].includes(data.status)) return;
            }
          }
        } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
        if (!controller.signal.aborted) throw new Error('Stream ended');
      } catch {
        if (controller.signal.aborted) return;
        if (attempt < 3) retryTimer = setTimeout(() => { void connect(attempt + 1); }, 1000 * 2 ** attempt);
        else { setError(new Error('Đang kiểm tra trạng thái định kỳ.')); void poll(); }
      }
    };
    void connect();
    return () => { controller.abort(); clearTimeout(retryTimer); clearTimeout(pollTimer); };
  }, [sessionId]);
  return { sseStatus, sseError: error };
};

import { useEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '../../../auth/apiClient';
import { interviewApi } from '../../../services/api/interviewApi';

export interface InterviewStatusEvent {
  sessionId: string;
  status: string;
  version: number;
  updatedAt?: string;
}

export const parseStatusEvent = (block: string): InterviewStatusEvent | null => {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as InterviewStatusEvent;
    return typeof parsed.status === 'string' && Number.isInteger(parsed.version) ? parsed : null;
  } catch {
    return null;
  }
};

export const useInterviewSSE = (sessionId: string) => {
  const [statusEvent, setStatusEvent] = useState<InterviewStatusEvent | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const latestVersionRef = useRef(-1);

  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pollingTimer: ReturnType<typeof setInterval> | undefined;
    let retries = 0;

    const accept = (candidate: InterviewStatusEvent) => {
      if (candidate.version <= latestVersionRef.current) return;
      latestVersionRef.current = candidate.version;
      setStatusEvent(candidate);
      setError(null);
    };

    const poll = async () => {
      try {
        const persisted = await interviewApi.fetchInterviewSession(sessionId);
        accept({
          sessionId,
          status: persisted.status,
          version: persisted.version,
          updatedAt: persisted.updatedAt
        });
      } catch {
        setError(new Error('Không thể đồng bộ trạng thái phỏng vấn'));
      }
    };

    const startPolling = () => {
      if (pollingTimer) return;
      void poll();
      pollingTimer = setInterval(() => void poll(), 5_000);
    };

    const connect = async (): Promise<void> => {
      try {
        const response = await authenticatedFetch(`interviews/${sessionId}/stream`, {
          headers: {
            Accept: 'text/event-stream',
            ...(latestVersionRef.current >= 0
              ? { 'Last-Event-ID': String(latestVersionRef.current) }
              : {})
          },
          signal: controller.signal
        });
        if (!response.ok || !response.body) throw new Error('Stream unavailable');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = blocks.pop() ?? '';
          blocks.forEach((block) => {
            const parsed = parseStatusEvent(block);
            if (parsed) accept(parsed);
          });
          if (done) break;
        }
        if (!controller.signal.aborted) throw new Error('Stream disconnected');
      } catch {
        if (controller.signal.aborted) return;
        if (retries < 3) {
          const delay = 1_000 * (2 ** retries);
          retries += 1;
          retryTimer = setTimeout(() => void connect(), delay);
        } else {
          setError(new Error('Luồng trạng thái bị ngắt; đang chuyển sang polling'));
          startPolling();
        }
      }
    };

    void connect();
    return () => {
      controller.abort();
      if (retryTimer) clearTimeout(retryTimer);
      if (pollingTimer) clearInterval(pollingTimer);
    };
  }, [sessionId]);

  return {
    sseStatus: statusEvent?.status ?? null,
    sseVersion: statusEvent?.version ?? null,
    sseError: error
  };
};

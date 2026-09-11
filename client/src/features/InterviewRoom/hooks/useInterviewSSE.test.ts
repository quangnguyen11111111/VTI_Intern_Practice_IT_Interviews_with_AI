import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../auth/apiClient', () => ({ authenticatedFetch: vi.fn() }));
vi.mock('../../../services/api/interviewApi', () => ({
  interviewApi: { fetchInterviewSession: vi.fn() }
}));

import { authenticatedFetch } from '../../../auth/apiClient';
import { interviewApi } from '../../../services/api/interviewApi';
import { parseStatusEvent, useInterviewSSE } from './useInterviewSSE';

const authenticatedFetchMock = vi.mocked(authenticatedFetch);
const pollingMock = vi.mocked(interviewApi.fetchInterviewSession);

const disconnectedStream = (version: number, status: string) => {
  const payload = `event: session.status\nid: ${version}\ndata: ${JSON.stringify({
    sessionId: 'session-1',
    status,
    version
  })}\n\n`;
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(payload));
      controller.close();
    }
  }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
};

describe('authenticated interview status convergence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    authenticatedFetchMock.mockImplementation(async () => disconnectedStream(4, 'EVALUATING'));
    pollingMock.mockResolvedValue({
      _id: 'session-1',
      status: 'COMPLETED',
      version: 5,
      updatedAt: '2026-09-09T00:00:00.000Z'
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('parses versioned SSE data and ignores comments', () => {
    expect(parseStatusEvent(': heartbeat')).toBeNull();
    expect(parseStatusEvent('id: 2\ndata: {"sessionId":"s","status":"IN_PROGRESS","version":2}'))
      .toMatchObject({ status: 'IN_PROGRESS', version: 2 });
  });

  it('falls back after three reconnects and converges to the newer persisted polling version', async () => {
    const { result, unmount } = renderHook(() => useInterviewSSE('session-1'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7_100);
    });

    expect(authenticatedFetchMock).toHaveBeenCalledTimes(4);
    for (const [path, init] of authenticatedFetchMock.mock.calls) {
      expect(String(path)).not.toContain('token');
      expect(String(path)).not.toContain('access_token');
      expect(new Headers(init?.headers).get('Accept')).toBe('text/event-stream');
    }
    expect(pollingMock).toHaveBeenCalledWith('session-1');
    expect(result.current.sseStatus).toBe('COMPLETED');
    expect(result.current.sseVersion).toBe(5);
    unmount();
  });
});

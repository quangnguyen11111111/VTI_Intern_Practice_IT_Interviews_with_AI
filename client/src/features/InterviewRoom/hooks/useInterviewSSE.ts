import { useState, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const useInterviewSSE = (sessionId: string) => {
  const [sseStatus, setSseStatus] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  useEffect(() => {
    if (!sessionId) return;

    const connectSSE = () => {
      const url = `${API_URL}/interviews/${sessionId}/stream`;
      
      const source = new EventSource(url);
      eventSourceRef.current = source;

      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status) {
            setSseStatus(data.status);
            // reset retry count on successful message
            retryCountRef.current = 0;
          }
          if (data.error) {
            setError(new Error(data.error));
            source.close();
          }
        } catch (err) {
          console.error('Failed to parse SSE message', err);
        }
      };

      source.onerror = (err) => {
        console.error('SSE Error:', err);
        source.close();
        
        // Manual retry logic (EventSource does this automatically, but sometimes it fails completely or we want limited retries before falling back)
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current += 1;
          console.log(`Retrying SSE connection... Attempt ${retryCountRef.current}`);
          setTimeout(connectSSE, 3000);
        } else {
          setError(new Error('SSE connection failed after maximum retries. Falling back...'));
        }
      };
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [sessionId]);

  return { sseStatus, sseError: error };
};

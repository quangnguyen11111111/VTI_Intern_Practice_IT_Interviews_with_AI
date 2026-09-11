import { EventEmitter } from 'node:events';
import { describe, it, expect, vi } from 'vitest';
const workers = vi.hoisted(() => ({ instances: [] as any[] }));
vi.mock('node:worker_threads', () => ({ Worker: class extends EventEmitter {
  stdout = { resume: vi.fn() }; stderr = { resume: vi.fn() };
  terminate = vi.fn().mockResolvedValue(0);
  constructor(public program: string, public options: any) { super(); workers.instances.push(this); }
} }));
import { parseIsolated } from '../src/utils/parsers/isolated-parser';
describe('SEC-03 parser resource isolation', () => {
  it('terminates a stuck worker at 5 seconds, discards diagnostics and has no runtime environment', async () => {
    vi.useFakeTimers();
    try {
      const result=expect(parseIsolated(Buffer.from('%PDF-1.4'), 'pdf')).rejects.toMatchObject({code:'FILE_PARSE_FAILED',statusCode:422});
      await vi.advanceTimersByTimeAsync(4999);
      const worker=workers.instances.at(-1);
      expect(worker.terminate).not.toHaveBeenCalled();
      expect(worker.options.env).toEqual({});
      expect(worker.options.resourceLimits.maxOldGenerationSizeMb).toBe(96);
      expect(worker.options.stdout).toBe(true); expect(worker.options.stderr).toBe(true);
      await vi.advanceTimersByTimeAsync(1); await result;
      expect(worker.terminate).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  });
});

import { useCallback, useEffect, useRef, useState } from 'react';

import { listJobs, type JobsError } from '@/lib/jobs';
import { shouldCommitRequest } from '@/lib/request-guard';
import type { Job, JobFilter } from '@/types/jobs';

export function useJobs(filters: JobFilter) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<JobsError | null>(null);
  const latestRequestId = useRef(0);
  const activeController = useRef<AbortController | null>(null);
  const serialized = JSON.stringify(filters);

  const reload = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    setLoading(true); setError(null);
    const result = await listJobs(JSON.parse(serialized) as JobFilter, undefined, controller.signal);
    if (!shouldCommitRequest(requestId, latestRequestId.current, controller.signal)) return;
    setJobs(result.data); setError(result.error); setLoading(false);
  }, [serialized]);

  useEffect(() => {
    const timer = setTimeout(() => void reload(), 0);
    return () => { clearTimeout(timer); activeController.current?.abort(); };
  }, [reload]);
  return { jobs, loading, error, reload };
}

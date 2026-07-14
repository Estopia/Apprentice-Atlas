import { useCallback, useEffect, useState } from 'react';

import { listJobs, type JobsError } from '@/lib/jobs';
import type { Job, JobFilter } from '@/types/jobs';

export function useJobs(filters: JobFilter) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<JobsError | null>(null);
  const serialized = JSON.stringify(filters);

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    const result = await listJobs(JSON.parse(serialized) as JobFilter);
    setJobs(result.data); setError(result.error); setLoading(false);
  }, [serialized]);

  useEffect(() => {
    const timer = setTimeout(() => void reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);
  return { jobs, loading, error, reload };
}

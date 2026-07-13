export type JobStatus = 'active' | 'expired' | 'invalid';

export interface Job {
  id: string;
  title: string;
  company: string;
  country: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  jobType: string;
  level: string;
  category: string;
  tags: string[];
  rawDescription: string;
  requirements: string[];
  sourceUrl: string;
  sourceName: string;
  status: JobStatus;
  lastSeenAt: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobFilter {
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  category?: string;
  jobType?: string;
  level?: string;
  tags?: string[];
  search?: string;
  status?: JobStatus;
}

export interface JobExplanation {
  jobId: string;
  locale: 'de' | 'en';
  summary: string;
  fitReasons: string[];
  considerations: string[];
  generatedAt: string;
}

export interface JobQuestionAnswer {
  jobId: string;
  locale: 'de' | 'en';
  question: string;
  answer: string;
  grounded: boolean;
  generatedAt: string;
}

export interface FavoriteJob {
  id: string;
  userId: string;
  jobId: string;
  createdAt: string;
  job?: Job;
}

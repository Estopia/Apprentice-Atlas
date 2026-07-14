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
  sourceUrl: string | null;
  applicationUrl: string | null;
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
  language: 'de' | 'en';
  summary: string;
  goodIf: string[];
  notSoGoodIf: string[];
  fitReasons?: string[];
  considerations?: string[];
  generatedAt: string;
}

export interface JobQuestionAnswer {
  jobId: string;
  language: 'de' | 'en';
  question: string;
  answer: string;
  knownFromPosting: boolean;
  notSpecified: boolean;
  status: 'grounded' | 'unknown';
  evidence: string[];
  grounded?: boolean;
  generatedAt: string;
}

export interface FavoriteJob {
  id: string;
  userId: string;
  jobId: string;
  createdAt: string;
  job?: Job;
}

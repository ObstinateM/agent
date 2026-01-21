import { logger } from '../../src/utils/logger.js';

export interface RadarrMovie {
  id: number;
  title: string;
  originalTitle: string;
  sortTitle: string;
  status: string;
  overview: string;
  studio?: string;
  year: number;
  path: string;
  qualityProfileId: number;
  monitored: boolean;
  minimumAvailability: string;
  tmdbId: number;
  imdbId?: string;
  titleSlug: string;
  rootFolderPath?: string;
  genres: string[];
  tags: number[];
  added: string;
  ratings: { votes: number; value: number };
  hasFile: boolean;
  isAvailable: boolean;
  movieFile?: {
    id: number;
    relativePath: string;
    size: number;
    quality: { quality: { name: string } };
  };
  images: Array<{ coverType: string; url: string; remoteUrl?: string }>;
  runtime: number;
}

export interface RadarrSearchResult {
  title: string;
  originalTitle: string;
  sortTitle: string;
  status: string;
  overview: string;
  studio?: string;
  year: number;
  tmdbId: number;
  imdbId?: string;
  titleSlug: string;
  genres: string[];
  ratings: { votes: number; value: number };
  images: Array<{ coverType: string; url: string; remoteUrl?: string }>;
  runtime: number;
}

export interface RadarrQueueItem {
  id: number;
  movieId: number;
  movie: { title: string; year: number };
  quality: { quality: { name: string } };
  size: number;
  sizeleft: number;
  status: string;
  trackedDownloadStatus?: string;
  trackedDownloadState?: string;
  statusMessages?: Array<{ title: string; messages: string[] }>;
  timeleft?: string;
  estimatedCompletionTime?: string;
  downloadClient?: string;
  protocol: string;
  title: string;
}

export interface RadarrQueueResponse {
  page: number;
  pageSize: number;
  sortKey: string;
  sortDirection: string;
  totalRecords: number;
  records: RadarrQueueItem[];
}

export interface RadarrQualityProfile {
  id: number;
  name: string;
}

export interface RadarrRootFolder {
  id: number;
  path: string;
  accessible: boolean;
  freeSpace: number;
}

export interface AddMovieOptions {
  qualityProfileId: number;
  rootFolderPath: string;
  monitored?: boolean;
  minimumAvailability?: 'announced' | 'inCinemas' | 'released' | 'tba';
  searchForMovie?: boolean;
  tags?: number[];
}

export interface RadarrClientOptions {
  baseUrl: string;
  apiKey: string;
  basicAuth?: {
    username: string;
    password: string;
  };
}

/**
 * API client for Radarr.
 */
export class RadarrApiClient {
  private baseUrl: string;
  private apiKey: string;
  private basicAuth?: { username: string; password: string };

  constructor(options: RadarrClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.basicAuth = options.basicAuth;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api/v3${endpoint}`;
    const headers: Record<string, string> = {
      'X-Api-Key': this.apiKey,
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.basicAuth) {
      const credentials = Buffer.from(`${this.basicAuth.username}:${this.basicAuth.password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Radarr API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Radarr API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Search for movies by term.
   */
  async searchMovie(term: string): Promise<RadarrSearchResult[]> {
    return this.request<RadarrSearchResult[]>(`/movie/lookup?term=${encodeURIComponent(term)}`);
  }

  /**
   * Get all movies in library.
   */
  async getMovies(): Promise<RadarrMovie[]> {
    return this.request<RadarrMovie[]>('/movie');
  }

  /**
   * Get a specific movie by ID.
   */
  async getMovieById(id: number): Promise<RadarrMovie> {
    return this.request<RadarrMovie>(`/movie/${id}`);
  }

  /**
   * Add a new movie.
   */
  async addMovie(searchResult: RadarrSearchResult, options: AddMovieOptions): Promise<RadarrMovie> {
    const body = {
      ...searchResult,
      qualityProfileId: options.qualityProfileId,
      rootFolderPath: options.rootFolderPath,
      monitored: options.monitored ?? true,
      minimumAvailability: options.minimumAvailability ?? 'released',
      addOptions: {
        searchForMovie: options.searchForMovie ?? true,
      },
      tags: options.tags ?? [],
    };

    return this.request<RadarrMovie>('/movie', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get download queue.
   */
  async getQueue(page = 1, pageSize = 20): Promise<RadarrQueueResponse> {
    return this.request<RadarrQueueResponse>(`/queue?page=${page}&pageSize=${pageSize}&includeMovie=true`);
  }

  /**
   * Get quality profiles.
   */
  async getQualityProfiles(): Promise<RadarrQualityProfile[]> {
    return this.request<RadarrQualityProfile[]>('/qualityprofile');
  }

  /**
   * Get root folders.
   */
  async getRootFolders(): Promise<RadarrRootFolder[]> {
    return this.request<RadarrRootFolder[]>('/rootfolder');
  }
}

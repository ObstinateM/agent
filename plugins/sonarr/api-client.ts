import { logger } from '../../src/utils/logger.js';

export interface SonarrSeries {
  id: number;
  title: string;
  sortTitle: string;
  status: string;
  overview: string;
  network?: string;
  year: number;
  path: string;
  qualityProfileId: number;
  languageProfileId?: number;
  seasonFolder: boolean;
  monitored: boolean;
  tvdbId: number;
  tvRageId?: number;
  imdbId?: string;
  titleSlug: string;
  rootFolderPath?: string;
  genres: string[];
  tags: number[];
  added: string;
  ratings: { votes: number; value: number };
  statistics?: {
    seasonCount: number;
    episodeFileCount: number;
    episodeCount: number;
    totalEpisodeCount: number;
    sizeOnDisk: number;
    percentOfEpisodes: number;
  };
  images: Array<{ coverType: string; url: string; remoteUrl?: string }>;
  seasons: Array<{
    seasonNumber: number;
    monitored: boolean;
    statistics?: {
      episodeFileCount: number;
      episodeCount: number;
      totalEpisodeCount: number;
      sizeOnDisk: number;
      percentOfEpisodes: number;
    };
  }>;
}

export interface SonarrSearchResult {
  title: string;
  sortTitle: string;
  status: string;
  overview: string;
  network?: string;
  year: number;
  tvdbId: number;
  tvRageId?: number;
  imdbId?: string;
  titleSlug: string;
  genres: string[];
  ratings: { votes: number; value: number };
  images: Array<{ coverType: string; url: string; remoteUrl?: string }>;
  seasons: Array<{ seasonNumber: number; monitored: boolean }>;
}

export interface SonarrQueueItem {
  id: number;
  seriesId: number;
  episodeId: number;
  series: { title: string };
  episode: { title: string; seasonNumber: number; episodeNumber: number };
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

export interface SonarrQueueResponse {
  page: number;
  pageSize: number;
  sortKey: string;
  sortDirection: string;
  totalRecords: number;
  records: SonarrQueueItem[];
}

export interface SonarrQualityProfile {
  id: number;
  name: string;
}

export interface SonarrRootFolder {
  id: number;
  path: string;
  accessible: boolean;
  freeSpace: number;
}

export interface AddSeriesOptions {
  qualityProfileId: number;
  rootFolderPath: string;
  monitored?: boolean;
  seasonFolder?: boolean;
  searchForMissingEpisodes?: boolean;
  tags?: number[];
}

export interface SonarrClientOptions {
  baseUrl: string;
  apiKey: string;
  basicAuth?: {
    username: string;
    password: string;
  };
}

/**
 * API client for Sonarr.
 */
export class SonarrApiClient {
  private baseUrl: string;
  private apiKey: string;
  private basicAuth?: { username: string; password: string };

  constructor(options: SonarrClientOptions) {
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
      logger.error(`Sonarr API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Sonarr API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Search for series by term.
   */
  async searchSeries(term: string): Promise<SonarrSearchResult[]> {
    return this.request<SonarrSearchResult[]>(`/series/lookup?term=${encodeURIComponent(term)}`);
  }

  /**
   * Get all series in library.
   */
  async getSeries(): Promise<SonarrSeries[]> {
    return this.request<SonarrSeries[]>('/series');
  }

  /**
   * Get a specific series by ID.
   */
  async getSeriesById(id: number): Promise<SonarrSeries> {
    return this.request<SonarrSeries>(`/series/${id}`);
  }

  /**
   * Add a new series.
   */
  async addSeries(searchResult: SonarrSearchResult, options: AddSeriesOptions): Promise<SonarrSeries> {
    const body = {
      ...searchResult,
      qualityProfileId: options.qualityProfileId,
      rootFolderPath: options.rootFolderPath,
      monitored: options.monitored ?? true,
      seasonFolder: options.seasonFolder ?? true,
      addOptions: {
        searchForMissingEpisodes: options.searchForMissingEpisodes ?? true,
      },
      tags: options.tags ?? [],
    };

    return this.request<SonarrSeries>('/series', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get download queue.
   */
  async getQueue(page = 1, pageSize = 20): Promise<SonarrQueueResponse> {
    return this.request<SonarrQueueResponse>(`/queue?page=${page}&pageSize=${pageSize}&includeEpisode=true&includeSeries=true`);
  }

  /**
   * Get quality profiles.
   */
  async getQualityProfiles(): Promise<SonarrQualityProfile[]> {
    return this.request<SonarrQualityProfile[]>('/qualityprofile');
  }

  /**
   * Get root folders.
   */
  async getRootFolders(): Promise<SonarrRootFolder[]> {
    return this.request<SonarrRootFolder[]>('/rootfolder');
  }
}

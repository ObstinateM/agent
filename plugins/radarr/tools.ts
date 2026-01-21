import { z } from 'zod';
import { Tool } from '../../src/types/plugin.js';
import { RadarrApiClient, RadarrSearchResult } from './api-client.js';
import { logger } from '../../src/utils/logger.js';

function wrapExecute<T>(
  toolName: string,
  fn: (params: T) => Promise<string>
): (params: unknown) => Promise<string> {
  return async (params: unknown): Promise<string> => {
    try {
      return await fn(params as T);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Tool ${toolName} failed:`, error);
      return `Error: ${errorMessage}`;
    }
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function createTools(client: RadarrApiClient): Tool[] {
  let cachedSearchResults: Map<number, RadarrSearchResult> = new Map();

  return [
    {
      definition: {
        name: 'radarr_search_movie',
        description:
          'Search for movies to add to Radarr. Returns a list of matching movies with their TMDB IDs. Use this before adding a movie to find the correct one.',
        parameters: z.object({
          query: z.string().describe('Search query (movie name)'),
        }),
      },
      execute: wrapExecute('radarr_search_movie', async (params: { query: string }) => {
        const { query } = params;
        const results = await client.searchMovie(query);

        if (results.length === 0) {
          return `No movies found for "${query}"`;
        }

        cachedSearchResults.clear();
        results.forEach((r) => cachedSearchResults.set(r.tmdbId, r));

        const formatted = results.slice(0, 10).map((r) => {
          const year = r.year ? ` (${r.year})` : '';
          const runtime = r.runtime ? ` - ${r.runtime} min` : '';
          const studio = r.studio ? ` - ${r.studio}` : '';
          return `- ${r.title}${year}${runtime}${studio}\n  TMDB ID: ${r.tmdbId}`;
        });

        return `Found ${results.length} movies:\n\n${formatted.join('\n\n')}`;
      }),
    },

    {
      definition: {
        name: 'radarr_add_movie',
        description:
          'Add a movie to Radarr. You must search for the movie first using radarr_search_movie to get the TMDB ID.',
        parameters: z.object({
          tmdb_id: z.number().describe('TMDB ID of the movie (from search results)'),
          quality_profile: z.string().optional().describe('Quality profile name (e.g., "HD-1080p", "Any"). If not specified, uses the first available profile.'),
          root_folder: z.string().optional().describe('Root folder path for the movie. If not specified, uses the first available root folder.'),
          monitored: z.boolean().optional().describe('Whether to monitor the movie for availability (default: true)'),
          minimum_availability: z
            .enum(['announced', 'inCinemas', 'released', 'tba'])
            .optional()
            .describe('When the movie becomes available: announced, inCinemas, released (default), tba'),
          search_for_movie: z.boolean().optional().describe('Whether to search for the movie after adding (default: true)'),
        }),
      },
      execute: wrapExecute('radarr_add_movie', async (params: {
        tmdb_id: number;
        quality_profile?: string;
        root_folder?: string;
        monitored?: boolean;
        minimum_availability?: 'announced' | 'inCinemas' | 'released' | 'tba';
        search_for_movie?: boolean;
      }) => {
        const { tmdb_id, quality_profile, root_folder, monitored, minimum_availability, search_for_movie } = params;

        const searchResult = cachedSearchResults.get(tmdb_id);
        if (!searchResult) {
          const freshResults = await client.searchMovie(tmdb_id.toString());
          const found = freshResults.find((r) => r.tmdbId === tmdb_id);
          if (!found) {
            return `Movie with TMDB ID ${tmdb_id} not found. Please search first using radarr_search_movie.`;
          }
          cachedSearchResults.set(tmdb_id, found);
        }

        const movieData = cachedSearchResults.get(tmdb_id)!;

        const [qualityProfiles, rootFolders] = await Promise.all([
          client.getQualityProfiles(),
          client.getRootFolders(),
        ]);

        let qualityProfileId: number;
        if (quality_profile) {
          const profile = qualityProfiles.find(
            (p) => p.name.toLowerCase() === quality_profile.toLowerCase()
          );
          if (!profile) {
            const available = qualityProfiles.map((p) => p.name).join(', ');
            return `Quality profile "${quality_profile}" not found. Available profiles: ${available}`;
          }
          qualityProfileId = profile.id;
        } else {
          qualityProfileId = qualityProfiles[0].id;
        }

        let rootFolderPath: string;
        if (root_folder) {
          const folder = rootFolders.find((f) => f.path === root_folder);
          if (!folder) {
            const available = rootFolders.map((f) => f.path).join(', ');
            return `Root folder "${root_folder}" not found. Available folders: ${available}`;
          }
          rootFolderPath = folder.path;
        } else {
          rootFolderPath = rootFolders[0].path;
        }

        const added = await client.addMovie(movieData, {
          qualityProfileId,
          rootFolderPath,
          monitored: monitored ?? true,
          minimumAvailability: minimum_availability ?? 'released',
          searchForMovie: search_for_movie ?? true,
        });

        return `Added "${added.title}" (${added.year}) to Radarr\n` +
          `- ID: ${added.id}\n` +
          `- Path: ${added.path}\n` +
          `- Runtime: ${added.runtime} min\n` +
          `- Monitored: ${added.monitored}\n` +
          `- Minimum Availability: ${added.minimumAvailability}\n` +
          `- Quality Profile: ${qualityProfiles.find((p) => p.id === qualityProfileId)?.name}`;
      }),
    },

    {
      definition: {
        name: 'radarr_list_movies',
        description: 'List all movies currently in Radarr library.',
        parameters: z.object({
          limit: z.number().optional().describe('Maximum number of movies to return (default: 20)'),
        }),
      },
      execute: wrapExecute('radarr_list_movies', async (params: { limit?: number }) => {
        const { limit = 20 } = params;
        const movies = await client.getMovies();

        if (movies.length === 0) {
          return 'No movies in Radarr library';
        }

        const formatted = movies.slice(0, limit).map((m) => {
          const hasFile = m.hasFile ? 'Downloaded' : 'Missing';
          const size = m.movieFile ? formatBytes(m.movieFile.size) : 'N/A';
          const quality = m.movieFile?.quality?.quality?.name || 'N/A';
          const monitored = m.monitored ? 'Monitored' : 'Not monitored';
          return `- ${m.title} (${m.year}) [${m.status}]\n  ${hasFile} | ${quality} | ${size} | ${monitored}`;
        });

        const total = movies.length;
        const showing = Math.min(limit, total);
        return `Movies in library (${showing}/${total}):\n\n${formatted.join('\n\n')}`;
      }),
    },

    {
      definition: {
        name: 'radarr_get_queue',
        description: 'Get the current download queue in Radarr. Shows movies being downloaded or waiting.',
        parameters: z.object({
          limit: z.number().optional().describe('Maximum number of queue items to return (default: 20)'),
        }),
      },
      execute: wrapExecute('radarr_get_queue', async (params: { limit?: number }) => {
        const { limit = 20 } = params;
        const queue = await client.getQueue(1, limit);

        if (queue.records.length === 0) {
          return 'Download queue is empty';
        }

        const formatted = queue.records.map((item) => {
          const movie = item.movie;
          const progress = item.size > 0
            ? `${Math.round(((item.size - item.sizeleft) / item.size) * 100)}%`
            : 'N/A';
          const timeLeft = item.timeleft || 'Unknown';
          const status = item.trackedDownloadState || item.status;

          let statusMessages = '';
          if (item.statusMessages && item.statusMessages.length > 0) {
            statusMessages = `\n  Warning: ${item.statusMessages.map((m) => m.title).join(', ')}`;
          }

          return `- ${movie.title} (${movie.year})\n  ${progress} | ${formatBytes(item.size - item.sizeleft)}/${formatBytes(item.size)} | ETA: ${timeLeft} | ${status}${statusMessages}`;
        });

        return `Download Queue (${queue.records.length}/${queue.totalRecords} items):\n\n${formatted.join('\n\n')}`;
      }),
    },

    {
      definition: {
        name: 'radarr_get_profiles',
        description: 'Get available quality profiles and root folders in Radarr. Use this to see options when adding a movie.',
        parameters: z.object({}),
      },
      execute: wrapExecute('radarr_get_profiles', async () => {
        const [qualityProfiles, rootFolders] = await Promise.all([
          client.getQualityProfiles(),
          client.getRootFolders(),
        ]);

        const profiles = qualityProfiles.map((p) => `- ${p.name} (ID: ${p.id})`).join('\n');
        const folders = rootFolders.map((f) => {
          const free = formatBytes(f.freeSpace);
          const status = f.accessible ? 'accessible' : 'not accessible';
          return `- ${f.path} (${free} free, ${status})`;
        }).join('\n');

        return `Quality Profiles:\n${profiles}\n\nRoot Folders:\n${folders}`;
      }),
    },
  ];
}

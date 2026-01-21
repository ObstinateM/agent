import { z } from 'zod';
import { Tool } from '../../src/types/plugin.js';
import { SonarrApiClient, SonarrSearchResult } from './api-client.js';
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

export function createTools(client: SonarrApiClient): Tool[] {
  let cachedSearchResults: Map<number, SonarrSearchResult> = new Map();

  return [
    {
      definition: {
        name: 'sonarr_search_series',
        description:
          'Search for TV series to add to Sonarr. Returns a list of matching series with their TVDB IDs. Use this before adding a series to find the correct one.',
        parameters: z.object({
          query: z.string().describe('Search query (series name)'),
        }),
      },
      execute: wrapExecute('sonarr_search_series', async (params: { query: string }) => {
        const { query } = params;
        const results = await client.searchSeries(query);

        if (results.length === 0) {
          return `No series found for "${query}"`;
        }

        cachedSearchResults.clear();
        results.forEach((r) => cachedSearchResults.set(r.tvdbId, r));

        const formatted = results.slice(0, 10).map((r) => {
          const year = r.year ? ` (${r.year})` : '';
          const network = r.network ? ` - ${r.network}` : '';
          const status = r.status ? ` [${r.status}]` : '';
          return `- ${r.title}${year}${network}${status}\n  TVDB ID: ${r.tvdbId}`;
        });

        return `Found ${results.length} series:\n\n${formatted.join('\n\n')}`;
      }),
    },

    {
      definition: {
        name: 'sonarr_add_series',
        description:
          'Add a TV series to Sonarr. You must search for the series first using sonarr_search_series to get the TVDB ID.',
        parameters: z.object({
          tvdb_id: z.number().describe('TVDB ID of the series (from search results)'),
          quality_profile: z.string().optional().describe('Quality profile name (e.g., "HD-1080p", "Any"). If not specified, uses the first available profile.'),
          root_folder: z.string().optional().describe('Root folder path for the series. If not specified, uses the first available root folder.'),
          monitored: z.boolean().optional().describe('Whether to monitor the series for new episodes (default: true)'),
          season_folder: z.boolean().optional().describe('Whether to use season folders (default: true)'),
          search_for_missing: z.boolean().optional().describe('Whether to search for missing episodes after adding (default: true)'),
        }),
      },
      execute: wrapExecute('sonarr_add_series', async (params: {
        tvdb_id: number;
        quality_profile?: string;
        root_folder?: string;
        monitored?: boolean;
        season_folder?: boolean;
        search_for_missing?: boolean;
      }) => {
        const { tvdb_id, quality_profile, root_folder, monitored, season_folder, search_for_missing } = params;

        const searchResult = cachedSearchResults.get(tvdb_id);
        if (!searchResult) {
          const freshResults = await client.searchSeries(tvdb_id.toString());
          const found = freshResults.find((r) => r.tvdbId === tvdb_id);
          if (!found) {
            return `Series with TVDB ID ${tvdb_id} not found. Please search first using sonarr_search_series.`;
          }
          cachedSearchResults.set(tvdb_id, found);
        }

        const seriesData = cachedSearchResults.get(tvdb_id)!;

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

        const added = await client.addSeries(seriesData, {
          qualityProfileId,
          rootFolderPath,
          monitored: monitored ?? true,
          seasonFolder: season_folder ?? true,
          searchForMissingEpisodes: search_for_missing ?? true,
        });

        const seasonCount = added.seasons?.length ?? 0;
        return `Added "${added.title}" (${added.year}) to Sonarr\n` +
          `- ID: ${added.id}\n` +
          `- Path: ${added.path}\n` +
          `- Seasons: ${seasonCount}\n` +
          `- Monitored: ${added.monitored}\n` +
          `- Quality Profile: ${qualityProfiles.find((p) => p.id === qualityProfileId)?.name}`;
      }),
    },

    {
      definition: {
        name: 'sonarr_list_series',
        description: 'List all TV series currently in Sonarr library.',
        parameters: z.object({
          limit: z.number().optional().describe('Maximum number of series to return (default: 20)'),
        }),
      },
      execute: wrapExecute('sonarr_list_series', async (params: { limit?: number }) => {
        const { limit = 20 } = params;
        const series = await client.getSeries();

        if (series.length === 0) {
          return 'No series in Sonarr library';
        }

        const formatted = series.slice(0, limit).map((s) => {
          const stats = s.statistics;
          const episodes = stats
            ? `${stats.episodeFileCount}/${stats.totalEpisodeCount} episodes`
            : 'N/A';
          const size = stats ? formatBytes(stats.sizeOnDisk) : 'N/A';
          const monitored = s.monitored ? 'Monitored' : 'Not monitored';
          return `- ${s.title} (${s.year}) [${s.status}]\n  ${episodes} | ${size} | ${monitored}`;
        });

        const total = series.length;
        const showing = Math.min(limit, total);
        return `Series in library (${showing}/${total}):\n\n${formatted.join('\n\n')}`;
      }),
    },

    {
      definition: {
        name: 'sonarr_get_queue',
        description: 'Get the current download queue in Sonarr. Shows episodes being downloaded or waiting.',
        parameters: z.object({
          limit: z.number().optional().describe('Maximum number of queue items to return (default: 20)'),
        }),
      },
      execute: wrapExecute('sonarr_get_queue', async (params: { limit?: number }) => {
        const { limit = 20 } = params;
        const queue = await client.getQueue(1, limit);

        if (queue.records.length === 0) {
          return 'Download queue is empty';
        }

        const formatted = queue.records.map((item) => {
          const episode = item.episode;
          const epNum = `S${String(episode.seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')}`;
          const progress = item.size > 0
            ? `${Math.round(((item.size - item.sizeleft) / item.size) * 100)}%`
            : 'N/A';
          const timeLeft = item.timeleft || 'Unknown';
          const status = item.trackedDownloadState || item.status;

          let statusMessages = '';
          if (item.statusMessages && item.statusMessages.length > 0) {
            statusMessages = `\n  Warning: ${item.statusMessages.map((m) => m.title).join(', ')}`;
          }

          return `- ${item.series.title} - ${epNum}: ${episode.title}\n  ${progress} | ${formatBytes(item.size - item.sizeleft)}/${formatBytes(item.size)} | ETA: ${timeLeft} | ${status}${statusMessages}`;
        });

        return `Download Queue (${queue.records.length}/${queue.totalRecords} items):\n\n${formatted.join('\n\n')}`;
      }),
    },

    {
      definition: {
        name: 'sonarr_get_profiles',
        description: 'Get available quality profiles and root folders in Sonarr. Use this to see options when adding a series.',
        parameters: z.object({}),
      },
      execute: wrapExecute('sonarr_get_profiles', async () => {
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

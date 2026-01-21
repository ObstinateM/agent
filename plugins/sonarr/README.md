# Sonarr Plugin

Sonarr integration for TV series management. Allows searching for series, adding them to your library, and monitoring download status.

## Configuration

Add the following environment variables to your `.env` file:

```bash
# Sonarr URL (including port if needed)
SONARR_URL=http://localhost:8989

# Sonarr API Key (found in Settings > General > Security)
SONARR_API_KEY=your_sonarr_api_key_here

# Optional: Basic auth credentials if Sonarr is behind nginx basic auth
# SONARR_BASIC_AUTH_USER=myuser
# SONARR_BASIC_AUTH_PASS=mypassword
```

## Tools

### sonarr_search_series

Search for TV series to add to Sonarr.

**Parameters:**
- `query` (required): Search query (series name)

**Example:** Search for "Breaking Bad"

### sonarr_add_series

Add a TV series to Sonarr. You must search first to get the TVDB ID.

**Parameters:**
- `tvdb_id` (required): TVDB ID from search results
- `quality_profile` (optional): Quality profile name (e.g., "HD-1080p")
- `root_folder` (optional): Root folder path
- `monitored` (optional): Monitor for new episodes (default: true)
- `season_folder` (optional): Use season folders (default: true)
- `search_for_missing` (optional): Search for missing episodes (default: true)

### sonarr_list_series

List all TV series in your Sonarr library.

**Parameters:**
- `limit` (optional): Maximum number of series to return (default: 20)

### sonarr_get_queue

Get the current download queue.

**Parameters:**
- `limit` (optional): Maximum items to return (default: 20)

### sonarr_get_profiles

Get available quality profiles and root folders.

## Usage Examples

1. **Search and add a series:**
   - First: `sonarr_search_series` with query "The Last of Us"
   - Then: `sonarr_add_series` with the TVDB ID from results

2. **Check download progress:**
   - Use `sonarr_get_queue` to see active downloads

3. **View library:**
   - Use `sonarr_list_series` to see all monitored series

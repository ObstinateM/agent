# Radarr Plugin

Radarr integration for movie management. Allows searching for movies, adding them to your library, and monitoring download status.

## Configuration

Add the following environment variables to your `.env` file:

```bash
# Radarr URL (including port if needed)
RADARR_URL=http://localhost:7878

# Radarr API Key (found in Settings > General > Security)
RADARR_API_KEY=your_radarr_api_key_here

# Optional: Basic auth credentials if Radarr is behind nginx basic auth
# RADARR_BASIC_AUTH_USER=myuser
# RADARR_BASIC_AUTH_PASS=mypassword
```

## Tools

### radarr_search_movie

Search for movies to add to Radarr.

**Parameters:**
- `query` (required): Search query (movie name)

**Example:** Search for "Inception"

### radarr_add_movie

Add a movie to Radarr. You must search first to get the TMDB ID.

**Parameters:**
- `tmdb_id` (required): TMDB ID from search results
- `quality_profile` (optional): Quality profile name (e.g., "HD-1080p")
- `root_folder` (optional): Root folder path
- `monitored` (optional): Monitor for availability (default: true)
- `minimum_availability` (optional): When to consider movie available: "announced", "inCinemas", "released" (default), "tba"
- `search_for_movie` (optional): Search for movie after adding (default: true)

### radarr_list_movies

List all movies in your Radarr library.

**Parameters:**
- `limit` (optional): Maximum number of movies to return (default: 20)

### radarr_get_queue

Get the current download queue.

**Parameters:**
- `limit` (optional): Maximum items to return (default: 20)

### radarr_get_profiles

Get available quality profiles and root folders.

## Usage Examples

1. **Search and add a movie:**
   - First: `radarr_search_movie` with query "The Matrix"
   - Then: `radarr_add_movie` with the TMDB ID from results

2. **Check download progress:**
   - Use `radarr_get_queue` to see active downloads

3. **View library:**
   - Use `radarr_list_movies` to see all monitored movies

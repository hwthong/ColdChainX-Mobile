const GOONG_PLACES_BASE_URL = 'https://rsapi.goong.io/Place/AutoComplete';
const GOONG_PLACE_DETAIL_URL = 'https://rsapi.goong.io/Place/Detail';
const GOONG_REST_API_KEY = process.env.EXPO_PUBLIC_GOONG_MAP_KEY?.trim();

type GoongAutocompleteResponse = {
  predictions?: Array<{
    description?: string;
    place_id?: string;
    structured_formatting?: {
      main_text?: string;
      secondary_text?: string;
    };
  }>;
  status?: string;
  error_message?: string;
};

export type GoongAddressSuggestion = {
  placeId: string;
  address: string;
  primaryText: string;
  secondaryText?: string;
};

type GoongPlaceDetailResponse = {
  result?: {
    place_id?: string;
    formatted_address?: string;
    name?: string;
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  };
  status?: string;
  error_message?: string;
};

export type GoongPlaceDetail = {
  placeId: string;
  address: string;
  name?: string;
  latitude: number;
  longitude: number;
};

export class GoongPlacesError extends Error {}

export function isAbortError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === 'object') {
    const errorObj = err as { name?: string; message?: string };
    if (errorObj.name === 'AbortError' || errorObj.name === 'CanceledError') return true;
    if (typeof errorObj.message === 'string' && /abort|cancel/i.test(errorObj.message)) return true;
  }
  return false;
}

// In-memory LRU caches to prevent redundant network calls and eliminate 429 rate limits
const MAX_CACHE_ENTRIES = 120;
const suggestionsCache = new Map<string, GoongAddressSuggestion[]>();
const placeDetailCache = new Map<string, GoongPlaceDetail>();

function setCacheItem<T>(cache: Map<string, T>, key: string, value: T) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, value);
}

async function fetchWithRetry(url: string, signal?: AbortSignal, maxRetries = 1): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    try {
      const response = await fetch(url, { signal });
      if (response.ok) return response;

      // Rate limited (429) -> wait briefly and retry once
      if (response.status === 429 && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        continue;
      }
      return response;
    } catch (err) {
      lastError = err;
      if (signal?.aborted || isAbortError(err)) {
        throw err;
      }
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        continue;
      }
    }
  }
  throw lastError;
}

export async function searchGoongAddressSuggestions(query: string, signal?: AbortSignal): Promise<GoongAddressSuggestion[]> {
  if (!GOONG_REST_API_KEY) {
    throw new GoongPlacesError('Goong Places is not configured.');
  }

  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  // Return from in-memory cache if available
  const cached = suggestionsCache.get(normalizedQuery);
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    api_key: GOONG_REST_API_KEY,
    input: query.trim(),
    limit: '6',
    more_compound: 'true',
  });

  const response = await fetchWithRetry(`${GOONG_PLACES_BASE_URL}?${params.toString()}`, signal, 1);
  if (!response.ok) {
    throw new GoongPlacesError(`Goong Places request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as GoongAutocompleteResponse;

  if (payload.status === 'ZERO_RESULTS' || !payload.predictions) {
    setCacheItem(suggestionsCache, normalizedQuery, []);
    return [];
  }

  if (payload.status === 'OVER_QUERY_LIMIT') {
    // Graceful degradation when rate limited
    return [];
  }

  const results = (payload.predictions ?? [])
    .map((prediction): GoongAddressSuggestion | null => {
      const address = prediction.description?.trim();
      if (!address || !prediction.place_id) return null;

      return {
        placeId: prediction.place_id,
        address,
        primaryText: prediction.structured_formatting?.main_text?.trim() || address,
        secondaryText: prediction.structured_formatting?.secondary_text?.trim() || undefined,
      };
    })
    .filter((prediction): prediction is GoongAddressSuggestion => prediction !== null)
    .slice(0, 6);

  setCacheItem(suggestionsCache, normalizedQuery, results);
  return results;
}

export async function getGoongPlaceDetail(placeId: string, signal?: AbortSignal): Promise<GoongPlaceDetail> {
  if (!GOONG_REST_API_KEY) {
    throw new GoongPlacesError('Goong Places is not configured.');
  }

  const normalizedPlaceId = placeId.trim();
  if (!normalizedPlaceId) {
    throw new GoongPlacesError('Goong place ID is required.');
  }

  // Return from in-memory cache if available
  const cached = placeDetailCache.get(normalizedPlaceId);
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    api_key: GOONG_REST_API_KEY,
    place_id: normalizedPlaceId,
  });

  const response = await fetchWithRetry(`${GOONG_PLACE_DETAIL_URL}?${params.toString()}`, signal, 1);
  if (!response.ok) {
    throw new GoongPlacesError(`Goong place detail request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as GoongPlaceDetailResponse;
  const result = payload.result;
  const latitude = result?.geometry?.location?.lat;
  const longitude = result?.geometry?.location?.lng;
  const address = result?.formatted_address?.trim();

  if (
    payload.status !== 'OK'
    || !result
    || !address
    || !isValidLatitude(latitude)
    || !isValidLongitude(longitude)
    || (latitude === 0 && longitude === 0)
  ) {
    throw new GoongPlacesError('Goong returned an invalid place detail.');
  }

  const detail: GoongPlaceDetail = {
    placeId: result.place_id?.trim() || normalizedPlaceId,
    address,
    name: result.name?.trim() || undefined,
    latitude,
    longitude,
  };

  setCacheItem(placeDetailCache, normalizedPlaceId, detail);
  return detail;
}

function isValidLatitude(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= -90
    && value <= 90;
}

function isValidLongitude(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= -180
    && value <= 180;
}

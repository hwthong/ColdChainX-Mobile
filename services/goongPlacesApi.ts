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
};

export type GoongPlaceDetail = {
  placeId: string;
  address: string;
  name?: string;
  latitude: number;
  longitude: number;
};

export class GoongPlacesError extends Error {}

export async function searchGoongAddressSuggestions(query: string, signal?: AbortSignal): Promise<GoongAddressSuggestion[]> {
  if (!GOONG_REST_API_KEY) {
    throw new GoongPlacesError('Goong Places is not configured.');
  }

  const params = new URLSearchParams({
    api_key: GOONG_REST_API_KEY,
    input: query.trim(),
    limit: '5',
    more_compound: 'true',
  });
  const response = await fetch(`${GOONG_PLACES_BASE_URL}?${params.toString()}`, { signal });
  if (!response.ok) {
    throw new GoongPlacesError('Goong Places request failed.');
  }

  const payload = (await response.json()) as GoongAutocompleteResponse;
  return (payload.predictions ?? [])
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
    .slice(0, 5);
}

export async function getGoongPlaceDetail(placeId: string, signal?: AbortSignal): Promise<GoongPlaceDetail> {
  if (!GOONG_REST_API_KEY) {
    throw new GoongPlacesError('Goong Places is not configured.');
  }

  const normalizedPlaceId = placeId.trim();
  if (!normalizedPlaceId) {
    throw new GoongPlacesError('Goong place ID is required.');
  }

  const params = new URLSearchParams({
    api_key: GOONG_REST_API_KEY,
    place_id: normalizedPlaceId,
  });
  const response = await fetch(`${GOONG_PLACE_DETAIL_URL}?${params.toString()}`, { signal });
  if (!response.ok) {
    throw new GoongPlacesError('Goong place detail request failed.');
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

  return {
    placeId: result.place_id?.trim() || normalizedPlaceId,
    address,
    name: result.name?.trim() || undefined,
    latitude,
    longitude,
  };
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

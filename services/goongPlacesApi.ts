const GOONG_PLACES_BASE_URL = 'https://rsapi.goong.io/Place/AutoComplete';
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

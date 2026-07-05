export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  rating?: number;
  totalRatings?: number;
  photoRef?: string;
  isOpen?: boolean;
  mapsUrl: string;
}

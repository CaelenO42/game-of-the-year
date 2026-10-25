export type IgdbGame = {
  id: number;
  age_ratings?: IgdbAgeRating[];
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  cover?: { image_id: string; }
  external_games?: IgdbExternalGame[];
  first_release_date?: number;
  franchises?: { name: string; }[];
  game_engines?: { name: string, description: string }[];
  genres?: { id: number }[];
  involved_companies?: IgdbInvolvedCompany[];
  name: string;
  platforms?: Pick<IgdbPlatform, "id">[];
  release_dates?: IgdbReleaseDate[];
  similar_games?: IgdbSimilarGame[];
  summary?: string;
  updated_at: number;
  websites?: IgdbWebsite[];
  total_rating_count?: number;
};

export type IgdbAgeRating = {
  id: number;
  organization: {
    id: number;
    name: string;
  }
  rating_category: {
    id: number;
    rating: string;
  }
}

export type IgdbExternalGame = {
  uid: string;
  external_game_source: {
    id: number;
    name: string;
  }
}

export type IgdbInvolvedCompany = {
  company: { name: string; };
  developer: boolean;
  porting: boolean;
  publisher: boolean;
  supporting: boolean;
}

export type IgdbPlatform = {
  id: number;
  abbreviation?: string;
  name: string;
  slug: string;
  summary?: string;
  platform_logo?: { image_id: string };
  platform_type?: { name: string };
}

export type IgdbReleaseDate = {
  date?: number;
  date_format: number;
  platform: number;
  release_region: { region: string };
}

export type IgdbSimilarGame = {
  name: string;
  cover?: { image_id: string };
}

export type IgdbWebsite = {
  trusted: boolean;
  url: string;
  type: { 
    id: number; 
    type: string 
  };
}

// Genre Type
export type IgdbGenre = {
  id: number;
  name: string;
  slug: string;
}
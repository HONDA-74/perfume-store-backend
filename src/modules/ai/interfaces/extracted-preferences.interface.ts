import { PerfumeGender } from '../../../common/types/enums/perfume-gender.enum';

export interface ExtractedPreferences {
  searchTerms?: string;
  gender?: PerfumeGender;
  minPrice?: number;
  maxPrice?: number;
  likedNotes: string[];
  dislikedNotes: string[];
}

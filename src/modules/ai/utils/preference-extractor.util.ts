import { PerfumeGender } from '../../../common/types/enums/perfume-gender.enum';
import { ExtractedPreferences } from '../interfaces/extracted-preferences.interface';

const LIKE_PATTERN = /i (?:love|like|enjoy|prefer)\s+([a-z\s]+)/gi;
const DISLIKE_PATTERN = /i (?:hate|dislike|don'?t like|can'?t stand)\s+([a-z\s]+)/gi;

const GENDER_HINTS: Array<{ pattern: RegExp; gender: PerfumeGender }> = [
  { pattern: /\b(girlfriend|wife|her|woman|women|feminine|she)\b/i, gender: PerfumeGender.FEMALE },
  { pattern: /\b(boyfriend|husband|him|man|men|masculine|he)\b/i, gender: PerfumeGender.MALE },
];

/**
 * Lightweight heuristic keyword extraction — not a full NLU pipeline. Feeds
 * a starting filter for product search; the LLM itself does the nuanced
 * interpretation via the RAG-augmented prompt (PromptBuilderService).
 */
export function extractPreferences(message: string): ExtractedPreferences {
  const liked: string[] = [];
  const disliked: string[] = [];

  for (const match of message.matchAll(LIKE_PATTERN)) {
    if (match[1]) liked.push(match[1].trim().split(/[.,!?]/)[0]);
  }
  for (const match of message.matchAll(DISLIKE_PATTERN)) {
    if (match[1]) disliked.push(match[1].trim().split(/[.,!?]/)[0]);
  }

  const genderHint = GENDER_HINTS.find(({ pattern }) => pattern.test(message));

  return {
    searchTerms: message,
    gender: genderHint?.gender,
    likedNotes: liked,
    dislikedNotes: disliked,
  };
}

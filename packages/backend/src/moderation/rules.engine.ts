import { Injectable } from '@nestjs/common';
import type { ModerationFlags, RuleEngineResult } from './moderation.types';
import { collapseForTokenScan, normalizeListingText } from './text-normalize';

/** Minimal profanity stems (RU/EN); extend via config file later if needed. */
const PROFANITY_STEMS_RU = [
  'хуй',
  'хуе',
  'хуя',
  'пизд',
  'еба',
  'ебу',
  'ебё',
  'ебе',
  'ёб',
  'бля',
  'муда',
  'сук',
  'гандон',
  'пидор',
  'пидр',
];

const PROFANITY_STEMS_EN = ['fuck', 'shit', 'cunt', 'dick', 'bitch', 'asshole'];

const VOWELS_GLOBAL = /[aeiouyаеёиоуыэюяAEIOUYАЕЁИОУЫЭЮЯ]/g;
const VOWEL_ONE = /[aeiouyаеёиоуыэюяAEIOUYАЕЁИОУЫЭЮЯ]/;
const KEYBOARD_JUNK = /asdf|qwer|zxcv|hjkl|dfgh|tyui|vbnm|йцук|фыва|ячсм/i;
const LATIN_RE = /[a-zA-Z]/;
const CYRILLIC_RE = /[а-яёА-ЯЁ]/;
const COMMON_WORDS_RE =
  /\b(и|в|на|с|по|для|как|это|или|не|от|до|из|при|the|and|for|with|from|are|you|this|that)\b/i;

@Injectable()
export class RulesEngine {
  evaluate(title: string, description: string): RuleEngineResult {
    const combined = normalizeListingText(`${title}\n${description}`);
    const scan = collapseForTokenScan(combined);
    const flags: ModerationFlags = {
      profanity: false,
      gibberish: false,
      spamLike: false,
    };
    const reasons: string[] = [];

    if (this.detectProfanity(scan)) {
      flags.profanity = true;
      reasons.push('rule:profanity_pattern');
    }

    const titleN = normalizeListingText(title);
    const gibCombined = this.gibberishScore(combined);
    const gibTitle =
      titleN.length >= 10 ? this.gibberishScore(titleN) : { score: 0 };
    const gibScore = Math.min(
      1,
      Math.max(
        gibCombined.score,
        gibTitle.score + (gibTitle.score >= 0.28 ? 0.14 : 0),
      ),
    );
    /** Catch noise without LLM when Ollama is slow/unavailable. */
    if (gibScore >= 0.42) {
      flags.gibberish = true;
      reasons.push(`rule:gibberish_heuristic(${gibScore.toFixed(2)})`);
    }

    const spam = this.spamLikeScore(combined);
    if (spam >= 0.75) {
      flags.spamLike = true;
      reasons.push(`rule:spam_like(${spam.toFixed(2)})`);
    }

    let severity: RuleEngineResult['severity'] = 'none';
    if (flags.profanity) {
      severity = 'hard_block';
    } else if (flags.gibberish || flags.spamLike) {
      severity = 'warn';
    }

    return { severity, reasons, flags };
  }

  private detectProfanity(scanLower: string): boolean {
    for (const stem of PROFANITY_STEMS_RU) {
      if (scanLower.includes(stem)) {
        return true;
      }
    }
    for (const stem of PROFANITY_STEMS_EN) {
      const re = new RegExp(`\\b${stem}`, 'i');
      if (re.test(scanLower)) {
        return true;
      }
    }
    return false;
  }

  private gibberishScore(text: string): { score: number } {
    const raw = text.replace(/\s/g, '');
    if (raw.length < 6) {
      return { score: 0 };
    }

    const letters = text.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '');
    const letterRatio = raw.length > 0 ? letters.length / raw.length : 0;
    const unique = new Set(raw.toLowerCase()).size;
    const uniqueRatio = raw.length > 0 ? unique / raw.length : 0;

    let score = 0;
    if (letterRatio < 0.35 && raw.length >= 12) {
      score += 0.45;
    }
    if (uniqueRatio < 0.22 && raw.length >= 12) {
      score += 0.35;
    }
    if (/(.)\1{6,}/.test(raw)) {
      score += 0.25;
    }

    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length >= 6) {
      const shortTok =
        tokens.filter((w) => w.length <= 2).length / tokens.length;
      if (shortTok > 0.55) {
        score += 0.2;
      }
    }

    const vowelCount = (letters.match(VOWELS_GLOBAL) ?? []).length;
    const vowelRatio = letters.length > 0 ? vowelCount / letters.length : 1;
    if (letters.length >= 14 && vowelRatio < 0.12) {
      score += 0.45;
    }
    if (letters.length >= 10 && vowelRatio < 0.08) {
      score += 0.35;
    }

    const maxConsonantRun = this.maxConsonantRun(letters);
    if (maxConsonantRun >= 7) {
      score += 0.4;
    }
    if (maxConsonantRun >= 5 && letters.length >= 20) {
      score += 0.2;
    }

    const singleToken = tokens.length === 1 ? (tokens[0] ?? '') : '';
    const singleLen = singleToken.replace(/\s/g, '').length;
    if (singleLen >= 24) {
      score += 0.42;
    } else if (singleLen >= 16) {
      score += 0.36;
    }

    score += this.longTokenLetterSalad(text);

    if (LATIN_RE.test(letters) && !CYRILLIC_RE.test(text) && raw.length >= 40) {
      if (!COMMON_WORDS_RE.test(text)) {
        score += 0.25;
      }
    }

    if (KEYBOARD_JUNK.test(text)) {
      score += 0.3;
    }

    const tokRun = this.maxConsonantRunInLongTokens(text);
    if (tokRun >= 6) {
      score += 0.42;
    } else if (tokRun >= 5) {
      score += 0.32;
    }

    const vowelless = this.vowellessLongTokenRatio(text);
    if (vowelless.ratio >= 0.42 && vowelless.count >= 5) {
      score += 0.48;
    } else if (vowelless.ratio >= 0.32 && vowelless.count >= 6) {
      score += 0.36;
    }

    score += this.repetitiveWordSalad(text);

    score += this.sparseFewWordHeuristic(letters.length, tokens.length);

    score += this.longTokenLetterSalad(text);

    return { score: Math.min(1, score) };
  }

  /** Almost no word boundaries despite lots of letters → pasted mash / single blob. */
  private sparseFewWordHeuristic(
    letterCount: number,
    tokenCount: number,
  ): number {
    if (letterCount >= 32 && tokenCount <= 2) {
      return 0.48;
    }
    if (letterCount >= 26 && tokenCount <= 2) {
      return 0.4;
    }
    return 0;
  }

  /**
   * Structured listing text (`Бренд: … Год: …`) still dominated by few long gibberish tokens.
   */
  private longTokenLetterSalad(text: string): number {
    const totalLetters = text.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '');
    if (totalLetters.length < 22) {
      return 0;
    }
    const longOnes = text
      .split(/\s+/)
      .map((t) => t.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, ''))
      .filter((L) => L.length >= 14);
    if (longOnes.length < 2) {
      return 0;
    }
    const inLong = longOnes.reduce((a, L) => a + L.length, 0);
    const ratio = inLong / totalLetters.length;
    if (ratio < 0.48) {
      return 0;
    }
    let digramPeak = 0;
    for (const L of longOnes) {
      digramPeak = Math.max(digramPeak, this.repeatedDigramScoreForWord(L));
    }
    if (digramPeak >= 0.28) {
      return 0.52;
    }
    if (ratio >= 0.55 && longOnes.length >= 2) {
      return 0.46;
    }
    if (longOnes.some((L) => L.length >= 22)) {
      return 0.4;
    }
    return 0;
  }

  /** Repeated letter-pairs inside one token (e.g. `ваипвваипв…`). */
  private repeatedDigramScoreForWord(L: string): number {
    const w = L.toLowerCase();
    if (w.length < 12) {
      return 0;
    }
    const counts = new Map<string, number>();
    for (let i = 0; i < w.length - 1; i++) {
      const d = w.slice(i, i + 2);
      if (!/[a-zа-яё]{2}/.test(d)) {
        continue;
      }
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    if (counts.size === 0) {
      return 0;
    }
    const max = Math.max(...counts.values());
    const denom = Math.max(1, w.length - 1);
    const share = max / denom;
    if (max >= 5 && share >= 0.18) {
      return 0.44;
    }
    if (max >= 4 && share >= 0.22) {
      return 0.38;
    }
    if (max >= 3 && share >= 0.28 && w.length <= 34) {
      return 0.32;
    }
    return 0;
  }

  /** Longest consonant-only run inside any single token (8+ letters). */
  private maxConsonantRunInLongTokens(text: string): number {
    let worst = 0;
    for (const rawTok of text.split(/\s+/)) {
      const letters = rawTok.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '');
      if (letters.length < 8) {
        continue;
      }
      worst = Math.max(worst, this.maxConsonantRun(letters));
    }
    return worst;
  }

  /**
   * Share of “words” (4+ letters) that contain **no** vowel letter — common in keyboard mash
   * across Latin and Cyrillic.
   */
  private vowellessLongTokenRatio(text: string): {
    ratio: number;
    count: number;
  } {
    const tokens = text.split(/\s+/).filter(Boolean);
    const longLetters = tokens
      .map((t) => t.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, ''))
      .filter((letters) => letters.length >= 4);
    if (longLetters.length === 0) {
      return { ratio: 0, count: 0 };
    }
    const bad = longLetters.filter(
      (letters) => !VOWEL_ONE.test(letters),
    ).length;
    return { ratio: bad / longLetters.length, count: longLetters.length };
  }

  /** Many tokens but few unique long words → spammy / generated noise. */
  private repetitiveWordSalad(text: string): number {
    const tokens = text
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.replace(/[^a-zа-яё0-9]/g, ''))
      .filter((t) => t.length >= 5);
    if (tokens.length < 12) {
      return 0;
    }
    const freq = new Map<string, number>();
    for (const t of tokens) {
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
    const maxRep = Math.max(...freq.values(), 0);
    const unique = freq.size;
    const diversity = unique / tokens.length;
    if (maxRep >= 6 && diversity < 0.18) {
      return 0.48;
    }
    if (maxRep >= 4 && diversity < 0.22) {
      return 0.34;
    }
    return 0;
  }

  private maxConsonantRun(lettersOnly: string): number {
    const s = lettersOnly.toLowerCase();
    let best = 0;
    let cur = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (!/[a-zа-яё]/.test(ch)) {
        cur = 0;
        continue;
      }
      if (VOWEL_ONE.test(ch)) {
        cur = 0;
      } else {
        cur += 1;
        if (cur > best) {
          best = cur;
        }
      }
    }
    return best;
  }

  private spamLikeScore(text: string): number {
    const nonAlnum = text.replace(/[a-zA-Zа-яА-ЯёЁ0-9\s]/g, '').length;
    const ratio = text.length > 0 ? nonAlnum / text.length : 0;
    const urlLike = (text.match(/https?:\/\//gi) ?? []).length;
    let s = 0;
    if (ratio > 0.35) {
      s += 0.55;
    }
    if (urlLike >= 3) {
      s += 0.35;
    }
    return Math.min(1, s);
  }
}

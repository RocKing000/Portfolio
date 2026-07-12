import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface BatchTranslateResponse {
  success: boolean;
  results: Array<{ original: string; translated: string; source: string }>;
}

@Injectable({ providedIn: 'root' })
export class TranslationApiService {
  private readonly cache = new Map<string, string>();
  private readonly baseUrl = 'http://localhost:8000';

  constructor(private http: HttpClient) {}

  async translateBatch(texts: string[], targetLang: string): Promise<string[]> {
    if (!texts.length) return [];

    const results: string[] = new Array(texts.length).fill('');
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    texts.forEach((text, i) => {
      const key = `${targetLang}::${text}`;
      const cached = this.cache.get(key);
      if (cached !== undefined) {
        results[i] = cached;
      } else {
        uncachedIndices.push(i);
        uncachedTexts.push(text);
      }
    });

    if (!uncachedTexts.length) return results;

    try {
      const response = await firstValueFrom(
        this.http.post<BatchTranslateResponse>(`${this.baseUrl}/translate/batch`, {
          texts: uncachedTexts,
          target_lang: targetLang,
          source_lang: 'en'
        })
      );

      if (response.success && response.results) {
        response.results.forEach((r, i) => {
          const origIdx = uncachedIndices[i];
          const translated = r.translated || texts[origIdx];
          results[origIdx] = translated;
          this.cache.set(`${targetLang}::${texts[origIdx]}`, translated);
        });
      } else {
        uncachedIndices.forEach(idx => { results[idx] = texts[idx]; });
      }
    } catch {
      uncachedIndices.forEach(idx => { results[idx] = texts[idx]; });
    }

    return results;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type: 'text' | 'results' | 'choices';
  data?: ChatResultData | ChatChoiceData;
}

export interface ChatResultData {
  results: AiErrorResult[];
}

export interface ChatChoiceData {
  choices: ChatChoice[];
}

export interface ChatChoice {
  label: string;
  action: 'navigate' | 'prompt' | 'search';
  target?: string;
  query?: string;
  message?: string;
}

interface AiErrorResult {
  errorId: string;
  errorCode: string;
  errorTitle: string;
  errorDescription: string;
  solution: string;
  rootCause?: string;
  severity: string;
  category: string;
  similarityScore: number;
  moduleName?: string;
  productName?: string;
}

interface ApiSearchResponse {
  success: boolean;
  message?: string;
  data: AiErrorResult[];
  timestamp: string;
}

interface AgentIntent {
  action: 'navigate' | 'search' | 'ask';
  target?: string;
  query?: string;
  confidence: number;
}

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private readonly router = inject(Router);
  private readonly http   = inject(HttpClient);

  private readonly LLM_URL   = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly LLM_MODEL = 'openai/gpt-oss-120b:free';

  readonly messages     = signal<ChatMessage[]>([]);
  readonly isProcessing = signal(false);

  constructor() {
    this.addText('assistant',
      'Welcome to SARGE Assistant. I can help you search for errors, navigate the platform, or answer questions about system features. How may I assist you?');
  }

  async sendMessage(userMessage: string): Promise<void> {
    this.addText('user', userMessage);
    this.isProcessing.set(true);

    try {
      const intent = await this.parseIntent(userMessage);
      await this.executeIntent(intent);
    } catch {
      this.addText('assistant',
        'I apologize for the inconvenience. An error occurred while processing your request. Please try again.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  clearChat(): void {
    this.messages.set([]);
    this.addText('assistant', 'Chat history has been cleared. How may I assist you?');
  }

  handleChoice(choice: ChatChoice): void {
    if (choice.action === 'navigate') {
      const extras = choice.query ? { queryParams: { q: choice.query } } : undefined;
      this.router.navigate([choice.target!], extras);
    } else if (choice.action === 'prompt' && choice.message) {
      this.addText('assistant', choice.message);
    } else if (choice.action === 'search' && choice.query) {
      this.isProcessing.set(true);
      this.handleSearch(choice.query).finally(() => this.isProcessing.set(false));
    }
  }

  // ── Intent parsing — LLM only sees the user's raw text ───────────────────

  private async parseIntent(userMessage: string): Promise<AgentIntent> {
    // Native fetch to bypass Angular's auth interceptor (same reason as before)
    try {
      const res = await fetch(this.LLM_URL, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${environment.openRouterApiKey}`,
          'HTTP-Referer':  window.location.origin,
          'X-Title':       'SARGE Platform'
        },
        body: JSON.stringify({
          model: this.LLM_MODEL,
          max_tokens: 100,
          temperature: 0.2,
          messages: [
            { role: 'system', content: this.intentSystemPrompt },
            { role: 'user',   content: userMessage }
          ]
        })
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('LLM intent error', res.status, err);
        return this.fallbackIntent(userMessage);
      }

      const data = await res.json();
      const text = (data?.choices?.[0]?.message?.content ?? '').trim();
      const json = text.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(json) as AgentIntent;

    } catch {
      return this.fallbackIntent(userMessage);
    }
  }

  private fallbackIntent(message: string): AgentIntent {
    const lower = message.toLowerCase();

    if (/show|open|go to|navigate|take me/.test(lower)) {
      if (lower.includes('dashboard'))                             return { action: 'navigate', target: 'dashboard',  confidence: 0.8 };
      if (lower.includes('signal'))                               return { action: 'navigate', target: 'signals',    confidence: 0.8 };
      if (lower.includes('analytic'))                             return { action: 'navigate', target: 'analytics',  confidence: 0.8 };
      if (lower.includes('search') || lower.includes('knowledge'))return { action: 'navigate', target: 'search',     confidence: 0.8 };
    }

    // Any message that isn't clearly navigation is treated as a search query.
    // This handles bare keywords ("gendr"), partial terms ("biometr"), and
    // natural-language questions ("what causes frozen errors").
    return { action: 'search', query: message.trim(), confidence: 0.65 };
  }

  private extractQuery(message: string): string {
    const code = message.match(/k-?\d+/i);
    if (code) return code[0];

    const keywords = ['cibil', 'kyc', 'biometric', 'enach', 'frozen', 'udyam', 'otp', 'mandate'];
    const found = keywords.find(k => message.toLowerCase().includes(k));
    if (found) return found;

    return message.replace(/search for|find|look for|help with/gi, '').trim();
  }

  // ── Intent execution — calls YOUR internal API ────────────────────────────

  private async executeIntent(intent: AgentIntent): Promise<void> {
    switch (intent.action) {
      case 'navigate':
        this.handleNavigation(intent.target ?? '');
        break;
      case 'search':
        await this.handleSearch(intent.query ?? '');
        break;
      default:
        this.addChoices('How may I assist you?', [
          { label: 'Search for errors',   action: 'prompt',   message: 'What error would you like to search for?' },
          { label: 'Go to Dashboard',     action: 'navigate', target: '/dashboard' },
          { label: 'Go to Signals',       action: 'navigate', target: '/signals' },
          { label: 'Open Knowledge Base', action: 'navigate', target: '/search' }
        ]);
    }
  }

  private handleNavigation(target: string): void {
    const routes: Record<string, string> = {
      dashboard: '/dashboard', signals:   '/signals',
      search:    '/search',    analytics: '/analytics'
    };
    const route = routes[target];
    if (route) {
      this.router.navigate([route]);
      this.addText('assistant', `Navigating to ${target.charAt(0).toUpperCase() + target.slice(1)} page.`);
    } else {
      this.addText('assistant', 'Navigation target not recognized. Please try again.');
    }
  }

  private async handleSearch(query: string): Promise<void> {
    if (!query) {
      this.addText('assistant', 'Please specify what you would like to search for.');
      return;
    }

    try {
      const response = await firstValueFrom(
        this.http.post<ApiSearchResponse>(`${environment.apiUrl}/api/v2/search`, {
          tenantCode: 'FEDERAL',
          query
        })
      );

      console.log('[Chatbot] raw API response:', response);

      // Low-confidence Kannada — server returns suggestions instead of results
      if ((response as any)?.needs_confirmation === true) {
        const suggestions: Array<{ kannada: string; english: string; confidence: number }> =
          (response as any).suggested_corrections ?? [];
        this.addText('assistant',
          `I could not confidently interpret "${query}". Did you mean one of the following?`);
        if (suggestions.length > 0) {
          this.addChoices('Choose the correct term:', suggestions.map(s => ({
            label: `${s.kannada} — ${s.english} (${Math.round(s.confidence * 100)}% match)`,
            action: 'search' as const,
            query: s.english,
          })));
        } else {
          this.addText('assistant', 'Please rephrase your query or use English keywords.');
        }
        return;
      }

      // The decrypted response may be the data array directly,
      // or wrapped in { success, data } — handle both.
      let results: AiErrorResult[];
      if (Array.isArray(response)) {
        results = response as unknown as AiErrorResult[];
      } else {
        results = (response as any)?.data ?? (response as any)?.results ?? [];
      }

      console.log('[Chatbot] resolved results:', results.length);

      // Show translation notice when Kannada input was interpreted
      const correctedQuery: string | null = (response as any)?.corrected_query ?? null;
      const displayQuery = correctedQuery ?? query;

      if (results.length === 0) {
        this.addText('assistant', `No results found for "${displayQuery}". Please try different keywords.`);
        return;
      }

      const introText = correctedQuery
        ? `Showing results for "${correctedQuery}" (interpreted from "${query}").`
        : `Found ${results.length} result${results.length !== 1 ? 's' : ''} for "${query}".`;
      this.addText('assistant', introText);
      this.addResults(results.slice(0, 5));
      this.addChoices('Would you like to do more?', [
        { label: 'View all in Search page',      action: 'navigate', target: '/search', query: displayQuery },
        { label: 'Search for something else',    action: 'prompt',   message: 'What else would you like to search for?' }
      ]);

    } catch (err) {
      console.error('[Chatbot] handleSearch error:', err);
      this.addText('assistant',
        'Unable to search at this time. Please try again or use the Search page directly.');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private addText(role: 'user' | 'assistant', content: string): void {
    this.messages.update(msgs => [
      ...msgs,
      { id: `${Date.now()}-${Math.random()}`, role, content, timestamp: new Date(), type: 'text' }
    ]);
  }

  private addResults(results: AiErrorResult[]): void {
    this.messages.update(msgs => [
      ...msgs,
      {
        id: `${Date.now()}-${Math.random()}`,
        role: 'assistant', content: '', timestamp: new Date(),
        type: 'results', data: { results } satisfies ChatResultData
      }
    ]);
  }

  private addChoices(content: string, choices: ChatChoice[]): void {
    this.messages.update(msgs => [
      ...msgs,
      {
        id: `${Date.now()}-${Math.random()}`,
        role: 'assistant', content, timestamp: new Date(),
        type: 'choices', data: { choices } satisfies ChatChoiceData
      }
    ]);
  }

  // ── LLM system prompt for intent parsing only ─────────────────────────────

  private readonly intentSystemPrompt = `You are an intent parser for a banking error management system. Return ONLY a JSON object.

Available actions:
- "navigate": user wants to go to a page
- "search": user wants to find errors or topics
- "ask": general question

Return format (strict JSON, no markdown):
{"action":"navigate|search|ask","target":"dashboard|signals|analytics|search","query":"search term","confidence":0.0-1.0}

Examples:
"Show me the dashboard" → {"action":"navigate","target":"dashboard","confidence":0.95}
"Find K-100 errors" → {"action":"search","query":"K-100","confidence":0.9}
"Search for CIBIL" → {"action":"search","query":"CIBIL","confidence":0.9}
"What causes frozen account errors" → {"action":"search","query":"frozen account","confidence":0.8}
"Go to analytics" → {"action":"navigate","target":"analytics","confidence":0.95}
"gendr" → {"action":"search","query":"gendr","confidence":0.75}
"biometr" → {"action":"search","query":"biometr","confidence":0.75}
"kyc issue" → {"action":"search","query":"kyc issue","confidence":0.85}

IMPORTANT: Any single word or short phrase that is not clearly navigation should be treated as a search query. Use "ask" only when the user is asking a meta question about the assistant itself.

Return ONLY valid JSON, nothing else.`;
}

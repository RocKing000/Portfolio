import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import {
  Subject, debounceTime, distinctUntilChanged,
  switchMap, takeUntil, of, catchError, EMPTY, timeout
} from 'rxjs';
import { ErrorService } from '../../core/services/error.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { TenantService } from '../../core/services/tenant.service';
import { LanguageService } from '../../core/services/language.service';
import { IdentifiedError } from '../../core/models/error.model';

@Component({
  selector: 'app-error-search',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatExpansionModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule
  ],
  templateUrl: './error-search.component.html',
  styleUrl: './error-search.component.scss'
})
export class ErrorSearchComponent implements OnInit, OnDestroy {
  private readonly errorSvc    = inject(ErrorService);
  private readonly analyticsSvc= inject(AnalyticsService);
  private readonly tenantSvc   = inject(TenantService);
  private readonly snackBar    = inject(MatSnackBar);
  private readonly destroy$    = new Subject<void>();
  readonly langSvc             = inject(LanguageService);

  readonly searchCtrl          = new FormControl('');
  readonly loading               = signal(false);
  readonly isFirstSearchLoading  = signal(false);
  readonly errors                = signal<IdentifiedError[]>([]);
  readonly searchDurationMs      = signal(0);
  readonly feedbackSent          = signal(new Set<string>());
  readonly detectedLang          = signal<'en' | 'kn' | 'mixed'>('en');
  readonly kannadaHintDismissed  = signal(false);
  readonly typoIndicator         = signal<{ typed: string; matched: string } | null>(null);

  isSearchFocused = false;
  private firstSearch = true;

  readonly quickChips: { key: string; value: string }[] = [
    { key: 'chip_k100',      value: 'K-100' },
    { key: 'chip_cibil',     value: 'CIBIL' },
    { key: 'chip_kyc',       value: 'KYC' },
    { key: 'chip_enach',     value: 'ENACH' },
    { key: 'chip_frozen',    value: 'Frozen' },
    { key: 'chip_biometric', value: 'Biometric' },
  ];

  get searchPlaceholder(): string {
    return this.langSvc.t('search_placeholder');
  }

  get showKannadaHint(): boolean {
    return this.detectedLang() !== 'en'
      && !this.langSvc.isKannada()
      && !this.kannadaHintDismissed();
  }

  ngOnInit(): void {
    this.searchCtrl.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(value => {
        const input = value?.trim() ?? '';
        if (input.length < 3) {
          this.errors.set([]);
          return EMPTY;
        }
        this.loading.set(true);
        this.isFirstSearchLoading.set(this.firstSearch);
        this.firstSearch = false;
        const tenant = this.tenantSvc.getTenant();
        return this.errorSvc.identifyError(tenant, input).pipe(
          timeout(60_000),
          catchError(() => {
            this.loading.set(false);
            return of(null);
          })
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe(response => {
      this.loading.set(false);
      if (response) {
        this.errors.set(response.errors);
        this.searchDurationMs.set(response.searchDurationMs);
        this.updateTypoIndicator(response.errors);
      }
    });

    // Kannada auto-detection — lightweight, runs on every keystroke
    this.searchCtrl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(v => {
      const text = v ?? '';
      const hasKn = /[ಀ-೿]/.test(text);
      const hasEn = /[a-zA-Z]/.test(text);
      this.detectedLang.set(hasKn && hasEn ? 'mixed' : hasKn ? 'kn' : 'en');
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  quickSearch(term: string): void {
    this.searchCtrl.setValue(term);
  }

  getRelevanceBadge(score: number): { cls: string; labelKey: string } {
    if (score >= 0.75) return { cls: 'exact',   labelKey: 'match_exact' };
    if (score >= 0.5)  return { cls: 'good',    labelKey: 'match_good'  };
    return               { cls: 'partial', labelKey: 'match_partial' };
  }

  getBreadcrumbs(path: string): string[] {
    return path.split(' > ').filter(s => s.trim().length > 0);
  }

  getRelevanceClass(score: number): string {
    if (score >= 0.7) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
  }

  async copyToClipboard(steps: string[]): Promise<void> {
    const text = steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
    await navigator.clipboard.writeText(text);
    this.snackBar.open('Steps copied to clipboard', '', { duration: 2000 });
  }

  onFeedback(error: IdentifiedError, wasHelpful: boolean): void {
    if (this.feedbackSent().has(error.errorCode)) return;

    const tenantCode = this.tenantSvc.getTenant();
    this.analyticsSvc.submitFeedback({ errorCode: error.errorCode, tenantCode, wasHelpful })
      .pipe(catchError(() => EMPTY))
      .subscribe(() => {
        this.feedbackSent.update(s => new Set([...s, error.errorCode]));
        this.snackBar.open(
          wasHelpful ? 'Thanks for the positive feedback!' : 'Thanks for the feedback.',
          '', { duration: 3000 }
        );
      });

    this.analyticsSvc.trackErrorView(error.mappingId, undefined, tenantCode)
      .pipe(catchError(() => EMPTY))
      .subscribe();
  }

  clearSearch(): void {
    this.searchCtrl.setValue('');
    this.errors.set([]);
    this.typoIndicator.set(null);
  }

  private updateTypoIndicator(errors: IdentifiedError[]): void {
    const typed = this.searchCtrl.value?.trim() ?? '';
    const top   = errors[0];
    if (!top || !typed) { this.typoIndicator.set(null); return; }

    const norm = (s: string) => s.toLowerCase().replace(/[-\s_]/g, '');
    if (norm(typed) === norm(top.errorCode)) {
      this.typoIndicator.set(null);
    } else {
      this.typoIndicator.set({ typed, matched: top.errorCode });
    }
  }

  dismissKannadaHint(): void { this.kannadaHintDismissed.set(true); }

  switchToKannada(): void {
    this.langSvc.setLanguage('kn');
    this.kannadaHintDismissed.set(true);
  }
}

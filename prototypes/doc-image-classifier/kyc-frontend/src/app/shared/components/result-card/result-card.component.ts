import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScanResult } from '../../../core/models/scan-result.model';
import { MaskNumberPipe } from '../../pipes/mask-number.pipe';

@Component({
  selector: 'app-result-card',
  standalone: true,
  imports: [CommonModule, MaskNumberPipe],
  template: `
    @if (result) {
      <div class="result-card">
        <!-- Document image with masked/original toggle -->
        <div class="result-card__image-wrap">
          @if (activeImage()) {
            <img class="result-card__image"
                 [src]="'data:image/jpeg;base64,' + activeImage()"
                 alt="Scanned document">
            @if (result.masked_image_base64 && result.corrected_image_base64) {
              <button class="result-card__toggle-btn"
                      (click)="showMasked.set(!showMasked())">
                {{ showMasked() ? 'Show Original' : 'Show Masked' }}
              </button>
            }
          } @else {
            <p class="result-card__no-image">No card image available — check backend response</p>
          }
        </div>

        <!-- Document type badge -->
        <div class="result-card__header">
          <span class="badge badge--primary">
            {{ result.document_type | uppercase }}
          </span>
          @if (result.success) {
            <span class="badge badge--success">Verified</span>
          } @else {
            <span class="badge badge--danger">Failed</span>
          }
        </div>

        <!-- Fields -->
        @if (result.extracted_data) {
          <div class="result-card__fields">
            @if (result.extracted_data.name) {
              <div class="result-card__field">
                <span class="field-label">Name</span>
                <span class="field-value">{{ result.extracted_data.name }}</span>
              </div>
            }
            @if (result.extracted_data.dob) {
              <div class="result-card__field">
                <span class="field-label">Date of Birth</span>
                <span class="field-value">{{ result.extracted_data.dob }}</span>
              </div>
            }
            @if (result.extracted_data.gender) {
              <div class="result-card__field">
                <span class="field-label">Gender</span>
                <span class="field-value">{{ result.extracted_data.gender }}</span>
              </div>
            }
            @if (result.extracted_data.document_number) {
              <div class="result-card__field">
                <span class="field-label">Document Number</span>
                <span class="field-value field-value--mono">
                  {{ result.extracted_data.document_number | maskNumber }}
                </span>
              </div>
            }
          </div>
        }

        <!-- Validation errors -->
        @if (result.validation_errors.length) {
          <div class="result-card__errors">
            @for (err of result.validation_errors; track err) {
              <p class="result-card__error-item">&#9888; {{ err }}</p>
            }
          </div>
        }

        <!-- Timing -->
        <p class="result-card__timing text-muted">
          Processed in {{ result.total_time_ms | number:'1.0-0' }} ms
        </p>
      </div>
    }
  `,
  styles: [`
    @use 'variables' as v;

    .result-card {
      background: white;
      border-radius: v.$border-radius;
      overflow: hidden;
      box-shadow: v.$shadow-md;

      &__image-wrap {
        width: 100%;
        aspect-ratio: 1.586;
        overflow: hidden;
        background: v.$surface-dark;
        position: relative;
      }

      &__image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      &__toggle-btn {
        position: absolute;
        bottom: v.$space-2;
        right: v.$space-2;
        padding: v.$space-1 v.$space-3;
        background: rgba(0, 0, 0, 0.55);
        color: white;
        border: none;
        border-radius: v.$border-radius-sm;
        font-size: v.$font-size-xs;
        cursor: pointer;
        &:hover { background: rgba(0, 0, 0, 0.75); }
      }

      &__header {
        display: flex;
        align-items: center;
        gap: v.$space-2;
        padding: v.$space-4;
        border-bottom: 1px solid v.$border-color;
      }

      &__fields {
        padding: v.$space-4;
        display: flex;
        flex-direction: column;
        gap: v.$space-4;
      }

      &__field {
        display: flex;
        flex-direction: column;
        gap: v.$space-1;
      }

      &__errors {
        padding: v.$space-3 v.$space-4;
        background: rgba(v.$danger, 0.06);
        border-top: 1px solid rgba(v.$danger, 0.2);
      }

      &__error-item {
        font-size: v.$font-size-sm;
        color: v.$danger;
        margin-bottom: v.$space-1;
      }

      &__timing {
        padding: v.$space-2 v.$space-4;
        font-size: v.$font-size-xs;
        border-top: 1px solid v.$border-color;
      }

      &__no-image {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: v.$danger;
        font-size: v.$font-size-sm;
        padding: v.$space-4;
        text-align: center;
      }
    }

    .field-value--mono {
      font-family: 'Courier New', monospace;
      font-size: v.$font-size-lg;
      letter-spacing: 0.08em;
    }
  `]
})
export class ResultCardComponent {
  @Input() result: ScanResult | null = null;

  // false = show corrected (original card crop) by default
  // true  = show masked (privacy-blurred version)
  readonly showMasked = signal(false);

  activeImage(): string | null {
    if (!this.result) return null;
    if (this.showMasked() && this.result.masked_image_base64) {
      return this.result.masked_image_base64;
    }
    // Prefer corrected; fall back to masked if corrected not available
    return this.result.corrected_image_base64 ?? this.result.masked_image_base64 ?? null;
  }
}

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FrameStatus } from '../../../core/services/frame-sampler.service';

@Component({
  selector: 'app-status-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (status) {
      <div class="status" [ngClass]="'status--' + status.stage">
        <div class="status__icon">
          @switch (status.stage) {
            @case ('idle')             { <div class="status__camera-icon">&#128247;</div> }
            @case ('checking_blur')    { <div class="spinner"></div> }
            @case ('detecting_document'){ <div class="status__scan-icon">&#128269;</div> }
            @case ('classifying')      { <div class="spinner"></div> }
            @case ('extracting')       { <div class="spinner"></div> }
            @case ('complete')         {
              <div class="status__check">
                <svg viewBox="0 0 52 52" class="status__check-svg">
                  <circle class="status__check-circle" cx="26" cy="26" r="25"/>
                  <path class="status__check-path" d="M14 27l8 8 16-16"/>
                </svg>
              </div>
            }
            @case ('failed')           { <div class="status__fail-icon">&#10060;</div> }
          }
        </div>
        <div class="status__body">
          <p class="status__message">{{ status.message }}</p>
          @if (status.stage !== 'idle' && status.stage !== 'complete' && status.stage !== 'failed') {
            <div class="progress-bar">
              <div class="progress-bar__fill"
                   [style.width.%]="status.progress"
                   [class.progress-bar__fill--success]="status.progress >= 100">
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    @use 'variables' as v;

    .status {
      display: flex;
      align-items: center;
      gap: v.$space-3;
      padding: v.$space-3 v.$space-4;
      border-radius: v.$border-radius;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(8px);
      min-width: 240px;
      max-width: 320px;

      &--complete { background: rgba(v.$success, 0.85); }
      &--failed   { background: rgba(v.$danger, 0.85); }
    }

    .status__icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      font-size: 20px;
    }

    .status__camera-icon,
    .status__scan-icon,
    .status__fail-icon {
      font-size: 20px;
      line-height: 1;
    }

    .status__scan-icon {
      animation: pulse-ring 1.2s ease-in-out infinite;
    }

    .status__body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: v.$space-2;
    }

    .status__message {
      font-size: v.$font-size-sm;
      font-weight: 600;
      color: white;
      margin: 0;
    }

    // ── Checkmark SVG ──────────────────────────────────────────────────────
    .status__check {
      width: 28px;
      height: 28px;
    }

    .status__check-svg {
      width: 28px;
      height: 28px;
    }

    .status__check-circle {
      fill: none;
      stroke: white;
      stroke-width: 2;
      stroke-dasharray: 166;
      stroke-dashoffset: 166;
      animation: stroke-circle 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
    }

    .status__check-path {
      fill: none;
      stroke: white;
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 48;
      stroke-dashoffset: 48;
      animation: stroke-check 0.4s cubic-bezier(0.65, 0, 0.45, 1) 0.5s forwards;
    }

    @keyframes stroke-circle {
      to { stroke-dashoffset: 0; }
    }

    @keyframes stroke-check {
      to { stroke-dashoffset: 0; }
    }

    @keyframes pulse-ring {
      0%, 100% { transform: scale(1); }
      50%       { transform: scale(1.15); }
    }

    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class StatusIndicatorComponent {
  @Input() status: FrameStatus | null = null;
}

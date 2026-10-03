import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KycStep } from '../../../core/models/kyc-session.model';

interface Step {
  id: KycStep;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-progress-stepper',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stepper">
      @for (step of steps; track step.id; let i = $index) {
        <div class="step" [class.step--active]="currentStep === step.id"
             [class.step--done]="isCompleted(step.id)">
          <div class="step__circle">
            @if (isCompleted(step.id)) {
              <span class="step__icon">&#10003;</span>
            } @else {
              <span class="step__num">{{ i + 1 }}</span>
            }
          </div>
          <span class="step__label">{{ step.label }}</span>
        </div>
        @if (i < steps.length - 1) {
          <div class="step__connector"
               [class.step__connector--done]="isCompleted(step.id)"></div>
        }
      }
    </div>
  `,
  styles: [`
    @use 'variables' as v;

    .stepper {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: v.$space-4 v.$space-4 v.$space-2;
      background: white;
      border-bottom: 1px solid v.$border-color;
    }

    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: v.$space-1;

      &__circle {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 2px solid v.$border-color;
        background: white;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: v.$transition-base;
        font-weight: 700;
        font-size: v.$font-size-sm;
        color: v.$text-muted;
      }

      &__label {
        font-size: v.$font-size-xs;
        font-weight: 600;
        color: v.$text-muted;
        white-space: nowrap;
        transition: v.$transition-base;
      }

      &__icon { font-size: v.$font-size-base; }

      &--active &__circle {
        border-color: v.$primary;
        background: v.$primary;
        color: white;
        box-shadow: 0 0 0 4px rgba(v.$primary, 0.15);
      }

      &--active &__label {
        color: v.$primary;
      }

      &--done &__circle {
        border-color: v.$success;
        background: v.$success;
        color: white;
      }

      &--done &__label {
        color: v.$success;
      }
    }

    .step__connector {
      flex: 1;
      height: 2px;
      background: v.$border-color;
      margin: 0 v.$space-2;
      margin-bottom: 20px;
      transition: v.$transition-base;

      &--done { background: v.$success; }
    }
  `]
})
export class ProgressStepperComponent {
  @Input() currentStep: KycStep = 'document';

  readonly steps: Step[] = [
    { id: 'document', label: 'Document', icon: '&#128196;' },
    { id: 'face',     label: 'Face',     icon: '&#128100;' },
    { id: 'result',   label: 'Complete', icon: '&#10003;' }
  ];

  isCompleted(stepId: KycStep): boolean {
    const order: KycStep[] = ['document', 'face', 'result'];
    return order.indexOf(stepId) < order.indexOf(this.currentStep);
  }
}

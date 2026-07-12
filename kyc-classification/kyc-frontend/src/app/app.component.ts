import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from './core/services/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  template: `
    <router-outlet></router-outlet>

    <!-- Global toast notifications -->
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [ngClass]="'toast--' + toast.type">
          {{ toast.message }}
          <button class="toast__close" (click)="toastService.dismiss(toast.id)">&#10005;</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast__close {
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      font-size: 12px;
      opacity: 0.7;
      margin-left: 8px;
      padding: 0;
      flex-shrink: 0;

      &:hover { opacity: 1; }
    }
  `]
})
export class AppComponent {
  readonly toastService = inject(ToastService);
}

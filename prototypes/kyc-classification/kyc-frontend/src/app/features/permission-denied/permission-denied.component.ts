import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CameraService } from '../../core/services/camera.service';

@Component({
  selector: 'app-permission-denied',
  standalone: true,
  template: `
    <div class="perm-denied">
      <div class="perm-denied__card">
        <div class="perm-denied__icon">&#128247;</div>
        <h2>Camera Access Required</h2>
        <p>KYC verification requires camera access to scan your document and verify your identity.</p>

        <div class="perm-denied__steps">
          <p><strong>How to grant camera access:</strong></p>
          <ol>
            <li>Click the camera/lock icon in your browser address bar</li>
            <li>Set Camera permission to <strong>Allow</strong></li>
            <li>Refresh the page</li>
          </ol>
        </div>

        <button class="btn btn--primary btn--full" (click)="retry()">
          Grant Camera Access
        </button>
      </div>
    </div>
  `,
  styles: [`
    @use 'variables' as v;

    .perm-denied {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: v.$surface;
      padding: v.$space-4;

      &__card {
        background: white;
        border-radius: v.$border-radius-lg;
        padding: v.$space-8 v.$space-6;
        max-width: 400px;
        width: 100%;
        text-align: center;
        box-shadow: v.$shadow-lg;
        display: flex;
        flex-direction: column;
        gap: v.$space-4;
      }

      &__icon {
        font-size: 64px;
        line-height: 1;
        margin-bottom: v.$space-2;
      }

      &__steps {
        text-align: left;
        background: v.$surface;
        border-radius: v.$border-radius-sm;
        padding: v.$space-4;

        p { margin-bottom: v.$space-2; color: v.$text-secondary; }
        ol { padding-left: v.$space-5; }
        li { color: v.$text-secondary; margin-bottom: v.$space-2; line-height: 1.5; }
      }
    }
  `]
})
export class PermissionDeniedComponent {
  private readonly camera = inject(CameraService);
  private readonly router = inject(Router);

  async retry(): Promise<void> {
    const granted = await this.camera.requestPermission();
    if (granted) {
      this.router.navigate(['/kyc']);
    } else {
      alert('Camera permission was denied. Please allow camera access in your browser settings and try again.');
    }
  }
}

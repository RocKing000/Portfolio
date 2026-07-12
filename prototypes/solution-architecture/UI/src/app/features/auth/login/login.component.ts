import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { LoginResponse } from '../../../core/models/auth.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly auth  = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route  = inject(ActivatedRoute);

  readonly isLoading   = signal(false);
  readonly loginError  = signal('');
  readonly navigating  = signal(false);
  showPassword = false;

  readonly loginForm = new FormGroup({
    username:   new FormControl('', [Validators.required]),
    password:   new FormControl('', [Validators.required]),
    rememberMe: new FormControl(false)
  });

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.isLoading.set(true);
    this.loginError.set('');

    const { username, password } = this.loginForm.getRawValue();

    this.auth.login(username!, password!).subscribe({
      next: (session) => {
        this.navigating.set(true);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        this.router.navigateByUrl(returnUrl ?? this.defaultRouteForRole(session));
      },
      error: (err) => {
        this.isLoading.set(false);
        this.loginError.set(err?.message ?? err?.error?.message ?? 'Invalid username or password.');
      }
    });
  }

  private defaultRouteForRole(session: LoginResponse): string {
    switch (session.user?.role?.toUpperCase()) {
      //case 'PLATFORM_ADMIN': return '/analytics';
      default:               return '/search';
    }
  }
}

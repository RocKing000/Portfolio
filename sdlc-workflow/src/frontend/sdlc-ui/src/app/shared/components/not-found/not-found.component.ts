import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'sdlc-not-found',
  standalone: true,
  imports: [RouterModule, MatButtonModule, MatIconModule],
  template: `
    <div class="not-found">
      <mat-icon>search_off</mat-icon>
      <h1>404</h1>
      <p>Page not found</p>
      <button mat-raised-button color="primary" routerLink="/dashboard">Back to Dashboard</button>
    </div>
  `,
  styles: [`
    .not-found {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; height: 100%; padding: 4rem;
      color: #9e9e9e; text-align: center;
    }
    mat-icon { font-size: 5rem; height: 5rem; width: 5rem; margin-bottom: 1rem; }
    h1 { font-size: 4rem; margin: 0; color: #3949ab; }
    p  { font-size: 1.25rem; margin: 0.5rem 0 2rem; }
  `],
})
export class NotFoundComponent {}

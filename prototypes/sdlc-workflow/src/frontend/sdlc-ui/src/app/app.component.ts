import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';

import { NavComponent } from './shared/components/nav/nav.component';
import { KeycloakService } from 'keycloak-angular';

@Component({
  selector: 'sdlc-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatBadgeModule,
    NavComponent,
  ],
  template: `
    <div class="app-container" *ngIf="isLoggedIn; else loginTpl">
      <sdlc-nav></sdlc-nav>
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>

    <ng-template #loginTpl>
      <div class="login-placeholder">
        <button mat-raised-button color="primary" (click)="login()">
          Sign in with SDLC Suite
        </button>
      </div>
    </ng-template>
  `,
  styles: [`
    .app-container { display: flex; flex-direction: column; height: 100vh; }
    .main-content  { flex: 1; overflow: auto; padding: 1.5rem; }
    .login-placeholder {
      display: flex; align-items: center; justify-content: center;
      height: 100vh;
    }
  `],
})
export class AppComponent implements OnInit {
  isLoggedIn = false;

  constructor(private keycloak: KeycloakService) {}

  async ngOnInit() {
    this.isLoggedIn = await this.keycloak.isLoggedIn();
  }

  login() {
    this.keycloak.login();
  }
}

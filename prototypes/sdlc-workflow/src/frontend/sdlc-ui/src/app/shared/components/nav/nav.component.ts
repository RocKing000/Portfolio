import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { KeycloakService } from 'keycloak-angular';
import { AppState } from '../../../store/reducers';
import { selectPendingCount } from '../../../store/selectors/review.selectors';
import * as ReviewActions from '../../../store/actions/review.actions';

@Component({
  selector: 'sdlc-nav',
  standalone: true,
  imports: [
    CommonModule, RouterModule,
    MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule, MatBadgeModule,
  ],
  template: `
    <mat-toolbar color="primary">
      <span class="brand">SDLC Automation Suite</span>
      <span class="flex-spacer"></span>

      <a mat-button routerLink="/dashboard" routerLinkActive="active">
        <mat-icon>dashboard</mat-icon> Dashboard
      </a>
      <a mat-button routerLink="/projects" routerLinkActive="active">
        <mat-icon>folder</mat-icon> Projects
      </a>
      <a mat-button routerLink="/review" routerLinkActive="active">
        <mat-icon [matBadge]="pendingCount$ | async" matBadgeColor="warn"
                  [matBadgeHidden]="(pendingCount$ | async) === 0">
          rate_review
        </mat-icon>
        Review Queue
      </a>
      <a mat-button routerLink="/audit" routerLinkActive="active">
        <mat-icon>history</mat-icon> Audit
      </a>

      <button mat-icon-button [matMenuTriggerFor]="userMenu">
        <mat-icon>account_circle</mat-icon>
      </button>
      <mat-menu #userMenu>
        <button mat-menu-item (click)="logout()">
          <mat-icon>logout</mat-icon> Sign out
        </button>
      </mat-menu>
    </mat-toolbar>
  `,
  styles: [`
    .brand { font-weight: 600; font-size: 1.1rem; margin-right: 2rem; }
    a.active { background: rgba(255,255,255,0.15); border-radius: 4px; }
  `],
})
export class NavComponent implements OnInit {
  pendingCount$: Observable<number>;

  constructor(
    private store: Store<AppState>,
    private keycloak: KeycloakService,
  ) {
    this.pendingCount$ = this.store.select(selectPendingCount);
  }

  ngOnInit() {
    this.store.dispatch(ReviewActions.loadReviewQueue());
  }

  logout() {
    this.keycloak.logout(window.location.origin);
  }
}

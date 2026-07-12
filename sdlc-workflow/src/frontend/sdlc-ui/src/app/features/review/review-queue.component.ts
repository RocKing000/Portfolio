import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AppState } from '../../store/reducers';
import { ReviewItem } from '../../core/services/review.service';
import { selectAllReviewItems } from '../../store/reducers/review.reducer';
import * as ReviewActions from '../../store/actions/review.actions';

@Component({
  selector: 'sdlc-review-queue',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule,
    MatChipsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-header">
      <h1>Internal Review Queue</h1>
      <p class="subtitle">Review agent-generated artefacts before they reach the client gate</p>
    </div>

    <mat-card>
      <mat-card-content>
        <div *ngIf="loading$ | async" class="spinner-row">
          <mat-spinner diameter="32"></mat-spinner>
        </div>

        <table mat-table [dataSource]="(items$ | async) || []" class="full-width">

          <ng-container matColumnDef="priority">
            <th mat-header-cell *matHeaderCellDef>Priority</th>
            <td mat-cell *matCellDef="let item">
              <span class="priority-chip priority-{{item.priority}}">{{item.priority}}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="reviewType">
            <th mat-header-cell *matHeaderCellDef>Type</th>
            <td mat-cell *matCellDef="let item">{{item.reviewType}}</td>
          </ng-container>

          <ng-container matColumnDef="contextSummary">
            <th mat-header-cell *matHeaderCellDef>Summary</th>
            <td mat-cell *matCellDef="let item" class="summary-cell">
              {{item.contextSummary | slice:0:120}}{{item.contextSummary.length > 120 ? '…' : ''}}
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let item">
              <span class="chip-{{item.status | lowercase}}">{{item.status}}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="createdAt">
            <th mat-header-cell *matHeaderCellDef>Received</th>
            <td mat-cell *matCellDef="let item">{{item.createdAt | date:'short'}}</td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Actions</th>
            <td mat-cell *matCellDef="let item">
              <button mat-stroked-button (click)="claim(item)"
                      [disabled]="item.status !== 'Pending'">
                Claim
              </button>
              <button mat-stroked-button color="primary" class="ml-8"
                      [disabled]="item.status !== 'InReview'"
                      (click)="openDecisionDialog(item)">
                Decide
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>

          <tr class="mat-row" *matNoDataRow>
            <td class="mat-cell" [attr.colspan]="displayedColumns.length">
              <div class="empty-state">
                <mat-icon>check_circle_outline</mat-icon>
                <p>No items in the review queue</p>
              </div>
            </td>
          </tr>
        </table>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .page-header { margin-bottom: 1.5rem; }
    .subtitle { color: #666; margin-top: 0.25rem; }
    .full-width { width: 100%; }
    .summary-cell { max-width: 360px; }
    .spinner-row { display: flex; justify-content: center; padding: 1rem; }
    .priority-chip { padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
    .priority-critical { background: #ffebee; color: #c62828; }
    .priority-high     { background: #fff3e0; color: #e65100; }
    .priority-normal   { background: #e8f5e9; color: #2e7d32; }
    .priority-low      { background: #f3f4f6; color: #6b7280; }
    .empty-state { display: flex; flex-direction: column; align-items: center;
                   padding: 3rem; color: #9e9e9e; }
    .empty-state mat-icon { font-size: 3rem; height: 3rem; width: 3rem; }
    .ml-8 { margin-left: 8px; }
  `],
})
export class ReviewQueueComponent implements OnInit {
  displayedColumns = ['priority', 'reviewType', 'contextSummary', 'status', 'createdAt', 'actions'];

  items$:   Observable<ReviewItem[]>;
  loading$: Observable<boolean>;

  constructor(
    private store: Store<AppState>,
    private dialog: MatDialog,
  ) {
    this.items$   = this.store.select(s => s.review).pipe(map(selectAllReviewItems));
    this.loading$ = this.store.select(s => s.review.loading);
  }

  ngOnInit() {
    this.store.dispatch(ReviewActions.loadReviewQueue());
  }

  claim(item: ReviewItem) {
    this.store.dispatch(ReviewActions.claimItem({ itemId: item.id }));
  }

  openDecisionDialog(item: ReviewItem) {
    // Inline decision — approve or reject with notes
    const notes = prompt(`Decision for item ${item.id}\nEnter notes (leave blank to approve):`) ?? '';
    const decision = confirm('Approve this artefact? (Cancel = Reject)') ? 'Approved' : 'Rejected';
    this.store.dispatch(ReviewActions.submitDecision({ itemId: item.id, decision, notes }));
  }
}

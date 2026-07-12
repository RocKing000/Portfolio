import {
  Component, Input, OnChanges, inject, ChangeDetectionStrategy, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SignalService } from '../../../core/services/signal.service';
import { SignalComment } from '../../../core/models/signal.model';

@Component({
  selector: 'app-signal-comments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule,
    MatCheckboxModule, MatProgressSpinnerModule, MatChipsModule
  ],
  templateUrl: './signal-comments.component.html',
  styleUrl: './signal-comments.component.scss'
})
export class SignalCommentsComponent implements OnChanges {
  @Input() signalId!: string;
  @Input() comments: SignalComment[] = [];

  private readonly fb        = inject(FormBuilder);
  private readonly signalSvc = inject(SignalService);
  private readonly snackBar  = inject(MatSnackBar);

  readonly saving           = signal(false);
  readonly localComments    = signal<SignalComment[]>([]);

  readonly form = this.fb.nonNullable.group({
    commentText: ['', [Validators.required, Validators.minLength(1)]],
    isInternal:  [true]
  });

  ngOnChanges(): void {
    // Sort newest first
    this.localComments.set(
      [...this.comments].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    );
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.saving.set(true);
    const v = this.form.getRawValue();

    this.signalSvc.addComment(this.signalId, {
      commentText: v.commentText,
      isInternal:  v.isInternal
    }).subscribe({
      next: added => {
        this.saving.set(false);
        if (added?.data) {
          this.localComments.update(list => [added.data, ...list]);
        }
        this.form.reset({ commentText: '', isInternal: true });
        this.snackBar.open('Comment added', 'OK', { duration: 2000 });
      },
      error: err => {
        this.saving.set(false);
        this.snackBar.open(err?.message ?? 'Failed to add comment', 'Dismiss', { duration: 4000 });
      }
    });
  }

  initials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
}

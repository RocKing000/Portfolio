import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../core/services/api.service';
import { Observable } from 'rxjs';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
}

@Component({
  selector: 'sdlc-project-list',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule, MatIconModule, MatDialogModule],
  template: `
    <div class="projects-page">
      <div class="page-header">
        <h1>Projects</h1>
        <button mat-raised-button color="primary" (click)="newProject()">
          <mat-icon>add</mat-icon> New Project
        </button>
      </div>

      <div class="projects-grid" *ngIf="projects$ | async as projects; else loading">
        <mat-card *ngFor="let project of projects" class="project-card"
                  [routerLink]="['/projects', project.id]">
          <mat-card-header>
            <mat-card-title>{{ project.name }}</mat-card-title>
            <mat-card-subtitle>{{ project.createdAt | date:'mediumDate' }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <p>{{ project.description }}</p>
            <span class="status-chip" [class]="'status-' + project.status.toLowerCase()">
              {{ project.status }}
            </span>
          </mat-card-content>
          <mat-card-actions>
            <button mat-button color="primary" [routerLink]="['/projects', project.id]">Open</button>
          </mat-card-actions>
        </mat-card>

        <div *ngIf="projects.length === 0" class="empty-state">
          <mat-icon>folder_open</mat-icon>
          <p>No projects yet. Create your first project to get started.</p>
          <button mat-raised-button color="primary" (click)="newProject()">Create Project</button>
        </div>
      </div>

      <ng-template #loading>
        <div class="empty-state"><p>Loading projects…</p></div>
      </ng-template>
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; }
    .project-card { cursor: pointer; transition: box-shadow 0.2s; }
    .project-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
    .status-chip { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .status-active    { background: #e3f2fd; color: #1565c0; }
    .status-completed { background: #e8f5e9; color: #2e7d32; }
    .status-paused    { background: #fff3e0; color: #e65100; }
    .empty-state { display: flex; flex-direction: column; align-items: center; padding: 3rem; color: #9e9e9e; grid-column: 1/-1; }
    .empty-state mat-icon { font-size: 3rem; height: 3rem; width: 3rem; }
  `],
})
export class ProjectListComponent implements OnInit {
  projects$!: Observable<Project[]>;

  constructor(private api: ApiService, private dialog: MatDialog) {}

  ngOnInit() {
    this.projects$ = this.api.get<Project[]>('/projects');
  }

  newProject() {
    // TODO: open create-project dialog
  }
}

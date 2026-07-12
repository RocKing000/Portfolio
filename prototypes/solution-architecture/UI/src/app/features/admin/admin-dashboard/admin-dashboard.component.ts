import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

interface AdminMenuCard {
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatIconModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent {
  readonly cards: AdminMenuCard[] = [
    { title: 'App Configuration',  description: 'Manage backend configuration settings',   icon: 'settings',      route: '/admin/config/app', color: '#4A90E2' },
    { title: 'UI Configuration',   description: 'Manage frontend display settings',         icon: 'palette',       route: '/admin/config/ui',  color: '#7B68EE' },
    { title: 'User Management',    description: 'Create and manage user accounts',          icon: 'people',        route: '/admin/users',       color: '#50C878' },
    { title: 'Tenant Management',  description: 'Manage tenant organisations',              icon: 'business',      route: '/admin/tenants',     color: '#FF6B6B' },
    { title: 'Error Library',      description: 'Manage error codes and solutions',         icon: 'error_outline', route: '/admin/errors',      color: '#FFA500' },
    { title: 'Audit Logs',         description: 'View system activity logs',                icon: 'history',       route: '/admin/audit',       color: '#9370DB' },
  ];
}

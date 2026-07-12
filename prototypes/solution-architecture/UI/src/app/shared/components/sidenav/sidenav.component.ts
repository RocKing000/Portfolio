import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { ErrorService } from '../../../core/services/error.service';
import { ErrorHierarchyNode } from '../../../core/models/error.model';

interface TenantGroup {
  code: string;
  name: string;
  products: ErrorHierarchyNode[];
}

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [CommonModule, RouterModule, MatListModule, MatIconModule, MatDividerModule],
  templateUrl: './sidenav.component.html',
  styleUrl: './sidenav.component.scss'
})
export class SidenavComponent implements OnInit {
  private readonly auth     = inject(AuthService);
  private readonly errorSvc = inject(ErrorService);
  readonly langSvc          = inject(LanguageService);

  readonly tenants              = signal<TenantGroup[]>([]);
  readonly expandedTenantCode   = signal<string | null>(null);
  readonly selectedProductId    = signal<string | null>(null);
  readonly loading              = signal(true);

  get isPlatformAdmin(): boolean {
    return this.auth.currentUserDto?.role === 'PLATFORM_ADMIN';
  }

  ngOnInit(): void {
    const user       = this.auth.currentUserDto;
    const tenantCode = user?.tenantCode ?? 'FEDERAL';
    const tenantName = user?.tenantName ?? tenantCode;

    this.errorSvc.getHierarchy(tenantCode, undefined, 'PRODUCT').subscribe({
      next: nodes => {
        const products = nodes.filter(n => n.isActive);
        this.tenants.set([{ code: tenantCode, name: tenantName, products }]);
        this.expandedTenantCode.set(tenantCode);
        if (products.length > 0) this.selectedProductId.set(products[0].hierarchyId);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  toggleTenant(tenant: TenantGroup): void {
    this.expandedTenantCode.update(c => c === tenant.code ? null : tenant.code);
  }

  selectProduct(product: ErrorHierarchyNode): void {
    this.selectedProductId.set(product.hierarchyId);
  }
}

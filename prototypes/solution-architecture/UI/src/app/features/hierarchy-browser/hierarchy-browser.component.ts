import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTreeModule, MatTreeNestedDataSource } from '@angular/material/tree';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { NestedTreeControl } from '@angular/cdk/tree';
import { catchError, EMPTY } from 'rxjs';
import { ErrorService } from '../../core/services/error.service';
import { TenantService } from '../../core/services/tenant.service';
import { ErrorHierarchyNode } from '../../core/models/error.model';

@Component({
  selector: 'app-hierarchy-browser',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatTreeModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatBadgeModule,
    MatDividerModule
  ],
  templateUrl: './hierarchy-browser.component.html',
  styleUrl: './hierarchy-browser.component.scss'
})
export class HierarchyBrowserComponent implements OnInit {
  private readonly errorSvc = inject(ErrorService);
  private readonly tenantSvc = inject(TenantService);

  readonly loading = signal(false);
  readonly selectedNode = signal<ErrorHierarchyNode | null>(null);
  readonly filterCtrl = new FormControl('');

  treeControl = new NestedTreeControl<ErrorHierarchyNode>(node => node.children ?? []);
  dataSource = new MatTreeNestedDataSource<ErrorHierarchyNode>();

  private allNodes: ErrorHierarchyNode[] = [];

  ngOnInit(): void {
    this.loadHierarchy();

    this.filterCtrl.valueChanges.subscribe(val => {
      const filter = val?.trim().toLowerCase() ?? '';
      if (!filter) {
        this.dataSource.data = this.allNodes;
        return;
      }
      this.dataSource.data = this.filterNodes(this.allNodes, filter);
      this.treeControl.expandAll();
    });
  }

  loadHierarchy(): void {
    this.loading.set(true);
    const tenant = this.tenantSvc.getTenant();
    this.errorSvc.getHierarchy(tenant).pipe(
      catchError(() => {
        this.loading.set(false);
        return EMPTY;
      })
    ).subscribe(flat => {
      this.loading.set(false);
      this.allNodes = this.errorSvc.buildTree(flat);
      this.dataSource.data = this.allNodes;
    });
  }

  hasChild(_: number, node: ErrorHierarchyNode): boolean {
    return (node.children?.length ?? 0) > 0;
  }

  onNodeClick(node: ErrorHierarchyNode): void {
    if (node.levelType === 'ERROR') {
      this.selectedNode.set(node);
    } else {
      this.treeControl.toggle(node);
    }
  }

  getNodeIcon(levelType: string): string {
    switch (levelType) {
      case 'PRODUCT':    return 'inventory_2';
      case 'MODULE':     return 'folder';
      case 'SUBMODULE':  return 'folder_open';
      case 'ERROR':      return 'description';
      default:           return 'folder';
    }
  }

  getLevelClass(levelType: string): string {
    return levelType.toLowerCase();
  }

  private filterNodes(nodes: ErrorHierarchyNode[], term: string): ErrorHierarchyNode[] {
    const result: ErrorHierarchyNode[] = [];
    for (const node of nodes) {
      const match = node.name.toLowerCase().includes(term);
      const filteredChildren = this.filterNodes(node.children ?? [], term);
      if (match || filteredChildren.length > 0) {
        result.push({ ...node, children: filteredChildren });
      }
    }
    return result;
  }
}

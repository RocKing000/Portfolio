import { Component, EventEmitter, Input, Output } from '@angular/core';

// Shared pager UI (rows-per-page selector + "Showing X to Y of Z" + page
// N of M with chevron buttons) — every table view reuses this instead of
// duplicating the same markup/state per view. The parent owns
// `page`/`pageSize` (two-way bound via [(page)]/[(pageSize)]) and is
// responsible for actually slicing its rows using them; this component
// only renders the controls and emits the next page/pageSize.
@Component({
  selector: 'app-paginator',
  templateUrl: './paginator.component.html',
  styleUrls: ['./paginator.component.scss']
})
export class PaginatorComponent {
  @Input() page = 1;
  @Output() pageChange = new EventEmitter<number>();

  @Input() pageSize = 10;
  @Output() pageSizeChange = new EventEmitter<number>();

  @Input() totalItems = 0;
  @Input() pageSizeOptions = [10, 15, 20];

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  get showingFrom(): number {
    return this.totalItems === 0 ? 0 : (this.page - 1) * this.pageSize + 1;
  }

  get showingTo(): number {
    return Math.min(this.page * this.pageSize, this.totalItems);
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.pageSizeChange.emit(size);
    this.page = 1;
    this.pageChange.emit(this.page);
  }

  prevPage(): void {
    if (this.page > 1) {
      this.page--;
      this.pageChange.emit(this.page);
    }
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page++;
      this.pageChange.emit(this.page);
    }
  }
}

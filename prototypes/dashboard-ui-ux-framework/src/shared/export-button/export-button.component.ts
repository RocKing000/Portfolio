import { Component, Input } from '@angular/core';
import * as ExcelJS from 'exceljs';

// Exports exactly what's on screen — the rows/columns this widget is
// currently given (already filtered/sorted) — not a fresh, independent
// query. Client-side via ExcelJS specifically (not a bare "array of
// objects → sheet" library) because it supports real cell styling
// (borders/fonts/fills) — a library without that produces a sheet with no
// borders regardless of what you set on it. Output is .xlsx.
@Component({
  selector: 'app-export-button',
  templateUrl: './export-button.component.html',
  styleUrls: ['./export-button.component.scss']
})
export class ExportButtonComponent {

  @Input() rows: any[] = [];
  @Input() filename = 'export';
  // Optional — restricts/orders/relabels exported columns to match exactly
  // what the caller's table renders. Falls back to exporting the raw rows'
  // own keys as-is when omitted.
  @Input() columns: string[] | null = null;
  @Input() columnLabels: Record<string, string> = {};

  async export(): Promise<void> {
    if (!this.rows?.length) return;

    const keys = this.columns ?? Object.keys(this.rows[0] ?? {});
    const headers = keys.map(k => this.columnLabels[k] ?? k);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');
    worksheet.columns = keys.map((k, i) => ({ header: headers[i], key: k }));
    this.rows.forEach(row => worksheet.addRow(keys.map(k => row[k])));

    // Thin border on every side of every cell, header row included.
    const thin: Partial<ExcelJS.Border> = { style: 'thin' };
    worksheet.eachRow({ includeEmpty: true }, row => {
      row.eachCell({ includeEmpty: true }, cell => {
        cell.border = { top: thin, left: thin, bottom: thin, right: thin };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${this.filename}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}

import { Pipe, PipeTransform } from '@angular/core';

/** Masks all but the last 4 chars of a document number. */
@Pipe({ name: 'maskNumber', standalone: true })
export class MaskNumberPipe implements PipeTransform {
  transform(value: string | null | undefined, visibleChars = 4): string {
    if (!value) return '—';
    const clean = value.replace(/\s/g, '');
    if (clean.length <= visibleChars) return value;
    const masked = 'X'.repeat(clean.length - visibleChars) + clean.slice(-visibleChars);
    // re-insert spaces every 4 chars for readability
    return masked.match(/.{1,4}/g)?.join(' ') ?? masked;
  }
}

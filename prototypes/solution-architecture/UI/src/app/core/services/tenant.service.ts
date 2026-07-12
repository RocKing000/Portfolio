import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export const TENANTS = [
  { code: 'FEDERAL', name: 'ExampleBank' },
  { code: 'HDFC', name: 'HDFC Bank' },
  { code: 'ICICI', name: 'ICICI Bank' },
  { code: 'AXIS', name: 'Axis Bank' }
];

@Injectable({ providedIn: 'root' })
export class TenantService {
  readonly tenants = TENANTS;
  readonly currentTenant$ = new BehaviorSubject<string>('FEDERAL');

  setTenant(code: string): void {
    this.currentTenant$.next(code);
  }

  getTenant(): string {
    return this.currentTenant$.getValue();
  }
}

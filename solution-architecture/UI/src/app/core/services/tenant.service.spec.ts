import { TestBed } from '@angular/core/testing';
import { TenantService, TENANTS } from './tenant.service';

describe('TenantService', () => {
  let service: TenantService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TenantService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should expose the full tenant list', () => {
    expect(service.tenants).toEqual(TENANTS);
    expect(service.tenants.length).toBe(4);
  });

  it('should default to FEDERAL tenant', () => {
    expect(service.getTenant()).toBe('FEDERAL');
  });

  it('should emit the initial value on currentTenant$', (done) => {
    service.currentTenant$.subscribe(value => {
      expect(value).toBe('FEDERAL');
      done();
    });
  });

  describe('setTenant()', () => {
    it('should update the current tenant', () => {
      service.setTenant('HDFC');
      expect(service.getTenant()).toBe('HDFC');
    });

    it('should emit the new tenant on currentTenant$', (done) => {
      const emitted: string[] = [];
      service.currentTenant$.subscribe(v => emitted.push(v));

      service.setTenant('ICICI');

      // BehaviorSubject emits immediately; last value should be ICICI
      expect(emitted[emitted.length - 1]).toBe('ICICI');
      done();
    });

    it('should reflect the last set value', () => {
      service.setTenant('AXIS');
      service.setTenant('HDFC');
      expect(service.getTenant()).toBe('HDFC');
    });
  });

  describe('tenants list', () => {
    it('should contain FEDERAL', () => {
      expect(service.tenants.some(t => t.code === 'FEDERAL')).toBeTrue();
    });

    it('should have code and name on every tenant', () => {
      service.tenants.forEach(t => {
        expect(t.code).toBeTruthy();
        expect(t.name).toBeTruthy();
      });
    });
  });
});

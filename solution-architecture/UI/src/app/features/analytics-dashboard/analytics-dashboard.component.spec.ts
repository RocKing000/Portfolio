import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, EMPTY } from 'rxjs';
import { AnalyticsDashboardComponent } from './analytics-dashboard.component';
import { AnalyticsService } from '../../core/services/analytics.service';
import { TenantService } from '../../core/services/tenant.service';
import { TrendingError, DashboardMetrics } from '../../core/models/analytics.model';

// Prevent real Chart.js from crashing in jsdom (no canvas WebGL context)
// We just need the constructor to succeed and destroy() to not throw.
class MockChart {
  static instances: MockChart[] = [];
  constructor() { MockChart.instances.push(this); }
  destroy() {}
  update() {}
}

const trendingRow: TrendingError = {
  tenantCode: 'FEDERAL', tenantName: 'ExampleBank',
  errorCode: 'K-100', errorName: 'CIBIL Low',
  hierarchyPath: 'Retail > Credit',
  totalSearches: 300, totalViews: 280,
  totalHelpful: 250, totalNotHelpful: 30,
  helpfulnessPercentage: 89.3
};

const metricsRow: DashboardMetrics = {
  metricDate: '2026-05-04', tenantCode: 'FEDERAL', tenantName: 'ExampleBank',
  totalSearches: 500, totalErrorsIdentified: 480, totalUsersActive: 25,
  topErrorCode: 'K-100', avgSearchDurationMs: 320
};

describe('AnalyticsDashboardComponent', () => {
  let fixture: ComponentFixture<AnalyticsDashboardComponent>;
  let component: AnalyticsDashboardComponent;
  let analyticsSvcSpy: jasmine.SpyObj<AnalyticsService>;
  let tenantSvcSpy: jasmine.SpyObj<TenantService>;

  beforeEach(async () => {
    analyticsSvcSpy = jasmine.createSpyObj('AnalyticsService', [
      'getTrendingErrors', 'getDashboardMetrics', 'submitFeedback', 'trackErrorView'
    ]);
    analyticsSvcSpy.getTrendingErrors.and.returnValue(of([trendingRow]));
    analyticsSvcSpy.getDashboardMetrics.and.returnValue(of([metricsRow]));

    tenantSvcSpy = jasmine.createSpyObj('TenantService', ['getTenant']);
    tenantSvcSpy.getTenant.and.returnValue('FEDERAL');

    // Stub Chart.js globally so the component can call new Chart(...)
    (window as any).Chart = MockChart;

    await TestBed.configureTestingModule({
      imports: [AnalyticsDashboardComponent, NoopAnimationsModule],
      providers: [
        { provide: AnalyticsService, useValue: analyticsSvcSpy },
        { provide: TenantService, useValue: tenantSvcSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticsDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    MockChart.instances = [];
  });

  // ─── Creation ──────────────────────────────────────────────────────────────

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ─── loadData() ───────────────────────────────────────────────────────────

  describe('loadData()', () => {
    it('should call getTrendingErrors with current tenant and controls', () => {
      expect(analyticsSvcSpy.getTrendingErrors).toHaveBeenCalledWith('FEDERAL', 'WEEK', 10);
    });

    it('should call getDashboardMetrics with current tenant', () => {
      expect(analyticsSvcSpy.getDashboardMetrics).toHaveBeenCalledWith('FEDERAL', null, null);
    });

    it('should populate trending signal', () => {
      expect(component.trending().length).toBe(1);
      expect(component.trending()[0].errorCode).toBe('K-100');
    });

    it('should populate metrics signal', () => {
      expect(component.metrics().length).toBe(1);
      expect(component.metrics()[0].totalSearches).toBe(500);
    });

    it('should populate tableSource.data', () => {
      expect(component.tableSource.data.length).toBe(1);
    });

    it('should not be loading after data resolves', () => {
      expect(component.loading()).toBeFalse();
    });
  });

  // ─── Computed getters ─────────────────────────────────────────────────────

  describe('totalSearches', () => {
    it('should sum searches across all metrics rows', () => {
      expect(component.totalSearches).toBe(500);
    });

    it('should return 0 when metrics is empty', () => {
      component.metrics.set([]);
      expect(component.totalSearches).toBe(0);
    });
  });

  describe('totalErrors', () => {
    it('should sum errorsIdentified across all metrics rows', () => {
      expect(component.totalErrors).toBe(480);
    });
  });

  describe('avgDuration', () => {
    it('should average avgSearchDurationMs across rows with values', () => {
      expect(component.avgDuration).toBeCloseTo(320, 0);
    });

    it('should return 0 when no metrics rows have avgSearchDurationMs', () => {
      component.metrics.set([
        { ...metricsRow, avgSearchDurationMs: undefined }
      ]);
      expect(component.avgDuration).toBe(0);
    });

    it('should return 0 when metrics is empty', () => {
      component.metrics.set([]);
      expect(component.avgDuration).toBe(0);
    });
  });

  describe('topError', () => {
    it('should return topErrorCode from first metrics row', () => {
      expect(component.topError).toBe('K-100');
    });

    it('should return "—" when metrics is empty', () => {
      component.metrics.set([]);
      expect(component.topError).toBe('—');
    });

    it('should return "—" when topErrorCode is undefined', () => {
      component.metrics.set([{ ...metricsRow, topErrorCode: undefined }]);
      expect(component.topError).toBe('—');
    });
  });

  // ─── displayedColumns ────────────────────────────────────────────────────

  it('should define the correct table columns', () => {
    expect(component.displayedColumns).toEqual([
      'errorCode', 'errorName', 'totalSearches', 'totalViews', 'helpfulnessPercentage'
    ]);
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  describe('ngOnDestroy()', () => {
    it('should not throw on destroy', () => {
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });
});

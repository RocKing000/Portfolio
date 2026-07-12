import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AnalyticsService } from './analytics.service';
import { TrendingError, DashboardMetrics, FeedbackRequest } from '../models/analytics.model';
import { environment } from '../../../environments/environment';

const analyticsBase = `${environment.apiUrl}/api/v2/analytics`;

const wrap = (data: unknown) => ({ success: true, data, timestamp: '2026-05-04T00:00:00Z' });

const trendingRow: TrendingError = {
  tenantCode: 'FEDERAL',
  tenantName: 'ExampleBank',
  errorCode: 'K-100',
  errorName: 'CIBIL Score Low',
  hierarchyPath: 'Retail > Loans > Credit',
  totalSearches: 200,
  totalViews: 180,
  totalHelpful: 160,
  totalNotHelpful: 20,
  helpfulnessPercentage: 88.9
};

const metricsRow: DashboardMetrics = {
  metricDate: '2026-05-04',
  tenantCode: 'FEDERAL',
  tenantName: 'ExampleBank',
  totalSearches: 500,
  totalErrorsIdentified: 480,
  totalUsersActive: 30,
  topErrorCode: 'K-100'
};

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AnalyticsService]
    });
    service = TestBed.inject(AnalyticsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // ─── getTrendingErrors() ───────────────────────────────────────────────────

  describe('getTrendingErrors()', () => {
    it('should GET /analytics/trending with required params', () => {
      service.getTrendingErrors('FEDERAL', 'WEEK', 10).subscribe();

      const req = http.expectOne(r => r.url === `${analyticsBase}/trending`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('period')).toBe('WEEK');
      expect(req.request.params.get('limit')).toBe('10');
      expect(req.request.params.get('tenantCode')).toBe('FEDERAL');
      req.flush(wrap([trendingRow]));
    });

    it('should omit tenantCode param when null', () => {
      service.getTrendingErrors(null, 'MONTH', 5).subscribe();

      const req = http.expectOne(r => r.url === `${analyticsBase}/trending`);
      expect(req.request.params.has('tenantCode')).toBeFalse();
      req.flush(wrap([]));
    });

    it('should return unwrapped data array', () => {
      let result: TrendingError[] | undefined;
      service.getTrendingErrors('FEDERAL', 'WEEK', 10).subscribe(r => result = r);
      http.expectOne(r => r.url === `${analyticsBase}/trending`).flush(wrap([trendingRow]));

      expect(result).toEqual([trendingRow]);
    });

    it('should return empty array when data is null', () => {
      let result: TrendingError[] | undefined;
      service.getTrendingErrors('FEDERAL', 'WEEK', 10).subscribe(r => result = r);
      http.expectOne(r => r.url === `${analyticsBase}/trending`).flush(wrap(null));
      expect(result).toEqual([]);
    });
  });

  // ─── getDashboardMetrics() ─────────────────────────────────────────────────

  describe('getDashboardMetrics()', () => {
    it('should GET /analytics/dashboard', () => {
      service.getDashboardMetrics('FEDERAL').subscribe();

      const req = http.expectOne(r => r.url === `${analyticsBase}/dashboard`);
      expect(req.request.method).toBe('GET');
      req.flush(wrap([metricsRow]));
    });

    it('should add date params when provided', () => {
      const from = new Date('2026-04-01T00:00:00.000Z');
      const to = new Date('2026-04-30T00:00:00.000Z');
      service.getDashboardMetrics('FEDERAL', from, to).subscribe();

      const req = http.expectOne(r => r.url === `${analyticsBase}/dashboard`);
      expect(req.request.params.get('fromDate')).toBe(from.toISOString());
      expect(req.request.params.get('toDate')).toBe(to.toISOString());
      req.flush(wrap([]));
    });

    it('should skip date params when null', () => {
      service.getDashboardMetrics('FEDERAL', null, null).subscribe();
      const req = http.expectOne(r => r.url === `${analyticsBase}/dashboard`);
      expect(req.request.params.has('fromDate')).toBeFalse();
      req.flush(wrap([]));
    });

    it('should return the metrics array', () => {
      let result: DashboardMetrics[] | undefined;
      service.getDashboardMetrics().subscribe(r => result = r);
      http.expectOne(r => r.url === `${analyticsBase}/dashboard`).flush(wrap([metricsRow]));
      expect(result![0].tenantCode).toBe('FEDERAL');
    });
  });

  // ─── submitFeedback() ──────────────────────────────────────────────────────

  describe('submitFeedback()', () => {
    const feedbackReq: FeedbackRequest = { errorCode: 'ERR-42', wasHelpful: true };

    it('should POST to /analytics/feedback', () => {
      service.submitFeedback(feedbackReq).subscribe();

      const req = http.expectOne(`${analyticsBase}/feedback`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(feedbackReq);
      req.flush(wrap({ success: true, message: 'ok', submittedAt: '2026-05-04T00:00:00Z' }));
    });

    it('should return the unwrapped FeedbackResponse', () => {
      let result: any;
      service.submitFeedback(feedbackReq).subscribe(r => result = r);
      http.expectOne(`${analyticsBase}/feedback`).flush(
        wrap({ success: true, message: 'Recorded', submittedAt: '2026-05-04T00:00:00Z' })
      );
      expect(result.message).toBe('Recorded');
    });
  });

  // ─── trackErrorView() ─────────────────────────────────────────────────────

  describe('trackErrorView()', () => {
    it('should POST to /analytics/track/:mappingId', () => {
      service.trackErrorView(99, 'user-1', 'FEDERAL').subscribe();

      const req = http.expectOne(`${analyticsBase}/track/99`);
      expect(req.request.method).toBe('POST');
      req.flush({});
    });
  });
});

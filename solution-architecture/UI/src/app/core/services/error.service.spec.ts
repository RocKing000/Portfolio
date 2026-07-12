import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ErrorService } from './error.service';
import { ErrorHierarchyNode } from '../models/error.model';
import { environment } from '../../../environments/environment';

const base = `${environment.apiUrl}/api/v2`;

const makeApiResult = (data: unknown) => ({
  success: true,
  data,
  timestamp: new Date().toISOString()
});

const aiItem = {
  errorId: '42',
  errorCode: 'K-100',
  errorTitle: 'CIBIL Score Low',
  errorDescription: 'Score below threshold.',
  solution: 'Check report. Dispute errors. Wait 30 days.',
  rootCause: 'Multiple enquiries',
  severity: 'HIGH',
  category: 'Credit',
  similarityScore: 0.92,
  moduleName: 'Loan Origination',
  productName: 'Retail Loans'
};

describe('ErrorService', () => {
  let service: ErrorService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ErrorService]
    });
    service = TestBed.inject(ErrorService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // ─── identifyError() ───────────────────────────────────────────────────────

  describe('identifyError()', () => {
    it('should POST to /search with correct body', () => {
      service.identifyError('FEDERAL', 'CIBIL low score').subscribe();

      const req = http.expectOne(`${base}/search`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ tenantCode: 'FEDERAL', query: 'CIBIL low score', userId: undefined });
      req.flush(makeApiResult([aiItem]));
    });

    it('should map AI result to IdentifiedError correctly', () => {
      let result: any;
      service.identifyError('FEDERAL', 'test').subscribe(r => result = r);

      http.expectOne(`${base}/search`).flush(makeApiResult([aiItem]));

      expect(result.errors.length).toBe(1);
      const err = result.errors[0];
      expect(err.errorCode).toBe('K-100');
      expect(err.errorName).toBe('CIBIL Score Low');
      expect(err.relevanceScore).toBe(0.92);
      expect(err.hierarchyPath).toBe('Retail Loans > Loan Origination > Credit');
      expect(err.prerequisites).toBe('Multiple enquiries');
    });

    it('should return empty errors array when API data is empty', () => {
      let result: any;
      service.identifyError('FEDERAL', 'nothing').subscribe(r => result = r);

      http.expectOne(`${base}/search`).flush(makeApiResult([]));
      expect(result.errors).toEqual([]);
    });

    it('should include userId in body when provided', () => {
      service.identifyError('FEDERAL', 'error', 'user-123').subscribe();

      const req = http.expectOne(`${base}/search`);
      expect(req.request.body.userId).toBe('user-123');
      req.flush(makeApiResult([]));
    });

    it('should split solution into steps', () => {
      let result: any;
      service.identifyError('FEDERAL', 'cibil').subscribe(r => result = r);
      http.expectOne(`${base}/search`).flush(makeApiResult([aiItem]));

      const steps = result.errors[0].solutionSteps;
      expect(steps.length).toBeGreaterThan(1);
    });
  });

  // ─── getHierarchy() ────────────────────────────────────────────────────────

  describe('getHierarchy()', () => {
    it('should GET with tenantCode param', () => {
      service.getHierarchy('FEDERAL').subscribe();

      const req = http.expectOne(r => r.url === `${base}/hierarchy`);
      expect(req.request.params.get('tenantCode')).toBe('FEDERAL');
      req.flush(makeApiResult([]));
    });

    it('should add parentId and levelType params when provided', () => {
      service.getHierarchy('FEDERAL', 5, 'MODULE').subscribe();

      const req = http.expectOne(r => r.url === `${base}/hierarchy`);
      expect(req.request.params.get('parentId')).toBe('5');
      expect(req.request.params.get('levelType')).toBe('MODULE');
      req.flush(makeApiResult([]));
    });

    it('should return the data array', () => {
      const node: ErrorHierarchyNode = {
        hierarchyId: '1', levelType: 'PRODUCT', name: 'Retail', isActive: true, childCount: 2
      };
      let result: any;
      service.getHierarchy('FEDERAL').subscribe(r => result = r);
      http.expectOne(r => r.url === `${base}/hierarchy`).flush(makeApiResult([node]));
      expect(result[0].name).toBe('Retail');
    });
  });

  // ─── buildTree() ───────────────────────────────────────────────────────────

  describe('buildTree()', () => {
    const flat: ErrorHierarchyNode[] = [
      { hierarchyId: '1', levelType: 'PRODUCT', name: 'Retail Loans', isActive: true, childCount: 2 },
      { hierarchyId: '2', parentId: '1', levelType: 'MODULE', name: 'Loan Origination', isActive: true, childCount: 1 },
      { hierarchyId: '3', parentId: '1', levelType: 'MODULE', name: 'Collections', isActive: true, childCount: 0 },
      { hierarchyId: '4', parentId: '2', levelType: 'ERROR', name: 'CIBIL Low', isActive: true, childCount: 0 }
    ];

    it('should return one root node', () => {
      const roots = service.buildTree(flat);
      expect(roots.length).toBe(1);
      expect(roots[0].name).toBe('Retail Loans');
    });

    it('should nest children under their parents', () => {
      const roots = service.buildTree(flat);
      expect(roots[0].children!.length).toBe(2);
    });

    it('should nest grandchildren correctly', () => {
      const roots = service.buildTree(flat);
      const loanOrigination = roots[0].children!.find(c => c.name === 'Loan Origination')!;
      expect(loanOrigination.children!.length).toBe(1);
      expect(loanOrigination.children![0].name).toBe('CIBIL Low');
    });

    it('should handle empty array', () => {
      expect(service.buildTree([])).toEqual([]);
    });

    it('should treat nodes with missing parent as roots', () => {
      const orphan: ErrorHierarchyNode = {
        hierarchyId: '99', parentId: '999', levelType: 'ERROR', name: 'Orphan', isActive: true, childCount: 0
      };
      const roots = service.buildTree([orphan]);
      expect(roots.length).toBe(1);
      expect(roots[0].name).toBe('Orphan');
    });
  });
});

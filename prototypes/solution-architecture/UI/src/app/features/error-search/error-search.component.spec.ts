import { ComponentFixture, TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, EMPTY, throwError } from 'rxjs';
import { ErrorSearchComponent } from './error-search.component';
import { ErrorService } from '../../core/services/error.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { TenantService } from '../../core/services/tenant.service';
import { IdentifiedError, ErrorIdentificationResponse } from '../../core/models/error.model';

const makeError = (overrides: Partial<IdentifiedError> = {}): IdentifiedError => ({
  hierarchyId: 1,
  errorCode: 'K-100',
  errorName: 'CIBIL Score Low',
  hierarchyPath: 'Retail Loans > Loan Origination > Credit',
  mappingId: 1,
  resolutionId: 1,
  resolutionTitle: 'CIBIL Score Low',
  problemDescription: 'Score below threshold',
  solutionSteps: ['Check CIBIL report', 'Dispute errors', 'Wait 30 days'],
  relevanceScore: 0.92,
  ...overrides
});

const makeResponse = (errors: IdentifiedError[]): ErrorIdentificationResponse => ({
  errors,
  searchDurationMs: 42,
  searchedAt: new Date().toISOString()
});

describe('ErrorSearchComponent', () => {
  let fixture: ComponentFixture<ErrorSearchComponent>;
  let component: ErrorSearchComponent;
  let errorSvcSpy: jasmine.SpyObj<ErrorService>;
  let analyticsSvcSpy: jasmine.SpyObj<AnalyticsService>;
  let tenantSvcSpy: jasmine.SpyObj<TenantService>;

  beforeEach(async () => {
    errorSvcSpy = jasmine.createSpyObj('ErrorService', ['identifyError']);
    analyticsSvcSpy = jasmine.createSpyObj('AnalyticsService', ['submitFeedback', 'trackErrorView']);
    tenantSvcSpy = jasmine.createSpyObj('TenantService', ['getTenant']);
    tenantSvcSpy.getTenant.and.returnValue('FEDERAL');
    errorSvcSpy.identifyError.and.returnValue(of(makeResponse([])));

    await TestBed.configureTestingModule({
      imports: [ErrorSearchComponent, NoopAnimationsModule],
      providers: [
        { provide: ErrorService, useValue: errorSvcSpy },
        { provide: AnalyticsService, useValue: analyticsSvcSpy },
        { provide: TenantService, useValue: tenantSvcSpy }
      ]
    }).compileComponents();

    // Spy on MatSnackBar.open so duration timers never enter the fake-timer queue
    spyOn(TestBed.inject(MatSnackBar), 'open');

    fixture = TestBed.createComponent(ErrorSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ─── Creation ──────────────────────────────────────────────────────────────

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ─── Search Behaviour ──────────────────────────────────────────────────────

  describe('search debounce', () => {
    it('should not call identifyError when input is shorter than 3 chars', fakeAsync(() => {
      component.searchCtrl.setValue('ab');
      tick(400);
      expect(errorSvcSpy.identifyError).not.toHaveBeenCalled();
    }));

    it('should call identifyError after 400ms debounce for 3+ char input', fakeAsync(() => {
      errorSvcSpy.identifyError.and.returnValue(of(makeResponse([makeError()])));

      component.searchCtrl.setValue('cibil low');
      tick(400);

      expect(errorSvcSpy.identifyError).toHaveBeenCalledWith('FEDERAL', 'cibil low');
    }));

    it('should show results after a successful search', fakeAsync(() => {
      errorSvcSpy.identifyError.and.returnValue(of(makeResponse([makeError()])));

      component.searchCtrl.setValue('K-100');
      tick(400);
      fixture.detectChanges();

      expect(component.errors().length).toBe(1);
      flush();
    }));

    it('should clear errors when input drops below 3 chars', fakeAsync(() => {
      errorSvcSpy.identifyError.and.returnValue(of(makeResponse([makeError()])));

      component.searchCtrl.setValue('K-100');
      tick(400);

      component.searchCtrl.setValue('K');
      tick(400);

      expect(component.errors().length).toBe(0);
    }));

    it('should not be loading after results arrive', fakeAsync(() => {
      errorSvcSpy.identifyError.and.returnValue(of(makeResponse([makeError()])));

      component.searchCtrl.setValue('cibil');
      tick(400);

      expect(component.loading()).toBeFalse();
    }));

    it('should not be loading after an API error', fakeAsync(() => {
      errorSvcSpy.identifyError.and.returnValue(throwError(() => new Error('fail')));

      component.searchCtrl.setValue('crash');
      tick(400);

      expect(component.loading()).toBeFalse();
    }));
  });

  // ─── getBreadcrumbs() ──────────────────────────────────────────────────────

  describe('getBreadcrumbs()', () => {
    it('should split hierarchyPath by " > "', () => {
      const crumbs = component.getBreadcrumbs('Retail Loans > Loan Origination > Credit');
      expect(crumbs).toEqual(['Retail Loans', 'Loan Origination', 'Credit']);
    });

    it('should filter empty segments', () => {
      const crumbs = component.getBreadcrumbs(' > Something > ');
      expect(crumbs).toEqual(['Something']);
    });

    it('should return single-element array for no separator', () => {
      const crumbs = component.getBreadcrumbs('Credit');
      expect(crumbs).toEqual(['Credit']);
    });
  });

  // ─── getRelevanceClass() ───────────────────────────────────────────────────

  describe('getRelevanceClass()', () => {
    it('should return "high" for score >= 0.7', () => {
      expect(component.getRelevanceClass(0.7)).toBe('high');
      expect(component.getRelevanceClass(1.0)).toBe('high');
    });

    it('should return "medium" for 0.4 <= score < 0.7', () => {
      expect(component.getRelevanceClass(0.4)).toBe('medium');
      expect(component.getRelevanceClass(0.69)).toBe('medium');
    });

    it('should return "low" for score < 0.4', () => {
      expect(component.getRelevanceClass(0.39)).toBe('low');
      expect(component.getRelevanceClass(0)).toBe('low');
    });
  });

  // ─── getRelevanceLabel() ──────────────────────────────────────────────────

  describe('getRelevanceLabel()', () => {
    it('should format score as rounded percentage string', () => {
      expect(component.getRelevanceLabel(0.92)).toBe('92%');
      expect(component.getRelevanceLabel(0.456)).toBe('46%');
      expect(component.getRelevanceLabel(0)).toBe('0%');
    });
  });

  // ─── clearSearch() ────────────────────────────────────────────────────────

  describe('clearSearch()', () => {
    it('should reset the search control to empty string', fakeAsync(() => {
      component.searchCtrl.setValue('some query');
      tick(400);
      component.clearSearch();
      tick(400); // flush debounce timer triggered by setValue('') inside clearSearch
      expect(component.searchCtrl.value).toBe('');
    }));

    it('should clear the errors signal', fakeAsync(() => {
      errorSvcSpy.identifyError.and.returnValue(of(makeResponse([makeError()])));
      component.searchCtrl.setValue('cibil');
      tick(400);
      expect(component.errors().length).toBe(1);

      component.clearSearch();
      tick(400); // flush debounce timer triggered by setValue('') inside clearSearch
      expect(component.errors().length).toBe(0);
    }));
  });

  // ─── onFeedback() ─────────────────────────────────────────────────────────

  describe('onFeedback()', () => {
    const err = makeError({ errorCode: 'K-100' });

    beforeEach(() => {
      analyticsSvcSpy.submitFeedback.and.returnValue(
        of({ success: true, message: 'ok', submittedAt: '2026-05-04T00:00:00Z' })
      );
      analyticsSvcSpy.trackErrorView.and.returnValue(of(null));
    });

    it('should call submitFeedback with errorCode and wasHelpful', fakeAsync(() => {
      component.onFeedback(err, true);
      flush();
      expect(analyticsSvcSpy.submitFeedback).toHaveBeenCalledWith(jasmine.objectContaining({ errorCode: 'K-100', wasHelpful: true }));
    }));

    it('should call trackErrorView', fakeAsync(() => {
      component.onFeedback(err, false);
      flush();
      expect(analyticsSvcSpy.trackErrorView).toHaveBeenCalledWith(err.mappingId, undefined, 'FEDERAL');
    }));

    it('should add errorCode to feedbackSent after submission', fakeAsync(() => {
      component.onFeedback(err, true);
      flush();
      expect(component.feedbackSent().has('K-100')).toBeTrue();
    }));

    it('should not submit feedback a second time for the same errorCode', fakeAsync(() => {
      component.onFeedback(err, true);
      flush();
      component.onFeedback(err, false);
      flush();
      expect(analyticsSvcSpy.submitFeedback).toHaveBeenCalledTimes(1);
    }));
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  describe('ngOnDestroy()', () => {
    it('should complete the destroy$ subject', () => {
      const nextSpy = spyOn((component as any).destroy$, 'next').and.callThrough();
      component.ngOnDestroy();
      expect(nextSpy).toHaveBeenCalled();
    });
  });
});

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  ErrorIdentificationResponse,
  ErrorHierarchyNode
} from '../models/error.model';
import { LanguageService } from './language.service';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  timestamp: string;
}

interface AiErrorResult {
  errorId: string;
  errorCode: string;
  errorTitle: string;
  errorDescription: string;
  solution: string;
  rootCause?: string;
  severity: string;
  category: string;
  similarityScore: number;
  moduleName?: string;
  productName?: string;
  // Kannada sibling fields (present when language='kn' was sent)
  errorTitle_kn?: string;
  errorDescription_kn?: string;
  solution_kn?: string;
  category_kn?: string;
}

@Injectable({ providedIn: 'root' })
export class ErrorService {
  private readonly http     = inject(HttpClient);
  private readonly langSvc  = inject(LanguageService);
  private readonly base     = `${environment.apiUrl}/api/v2`;

  identifyError(
    tenantCode: string,
    errorInput: string,
    userId?: string
  ): Observable<ErrorIdentificationResponse> {
    const language = this.langSvc.current();
    const body = { tenantCode, query: errorInput, userId, language };
    return this.http.post<ApiResponse<AiErrorResult[]>>(
      `${this.base}/search`, body
    ).pipe(
      map(r => ({
        errors: (r.data ?? []).map((item, index) => this.mapAiResult(item, index, language)),
        searchDurationMs: 0,
        searchedAt: r.timestamp
      }))
    );
  }

  private mapAiResult(
    item: AiErrorResult,
    index: number,
    language: string
  ): import('../models/error.model').IdentifiedError {
    const isKn = language === 'kn';

    const title       = (isKn ? item.errorTitle_kn       : undefined) ?? item.errorTitle       ?? '';
    const description = (isKn ? item.errorDescription_kn : undefined) ?? item.errorDescription ?? '';
    const solution    = (isKn ? item.solution_kn          : undefined) ?? item.solution         ?? '';
    const category    = (isKn ? item.category_kn          : undefined) ?? item.category         ?? '';

    const parts = [item.productName, item.moduleName, category].filter((p): p is string => !!p);
    const hierarchyPath = parts.length > 0 ? parts.join(' > ') : category;

    const solutionSteps = solution
      .split(/\n|(?<=\.)\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    return {
      hierarchyId: parseInt(item.errorId, 10) || index,
      errorCode: item.errorCode ?? '',
      errorName: title,
      hierarchyPath,
      mappingId: parseInt(item.errorId, 10) || index,
      resolutionId: parseInt(item.errorId, 10) || index,
      resolutionTitle: title,
      problemDescription: description,
      solutionSteps: solutionSteps.length > 0 ? solutionSteps : [solution],
      prerequisites: item.rootCause ?? undefined,
      expectedOutcome: undefined,
      escalationNotes: undefined,
      relevanceScore: item.similarityScore ?? 0
    };
  }

  getHierarchy(
    tenantCode: string,
    parentId?: number,
    levelType?: string
  ): Observable<ErrorHierarchyNode[]> {
    let params = new HttpParams().set('tenantCode', tenantCode);
    if (parentId != null) params = params.set('parentId', parentId);
    if (levelType) params = params.set('levelType', levelType);
    return this.http.get<ApiResponse<ErrorHierarchyNode[]>>(
      `${this.base}/hierarchy`, { params }
    ).pipe(map(r => r.data ?? []));
  }

  buildTree(flat: ErrorHierarchyNode[]): ErrorHierarchyNode[] {
    const map = new Map<string, ErrorHierarchyNode>();
    flat.forEach(n => map.set(n.hierarchyId, { ...n, children: [] }));

    const roots: ErrorHierarchyNode[] = [];
    map.forEach(node => {
      if (node.parentId != null && map.has(node.parentId)) {
        map.get(node.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }
}

export interface ErrorIdentificationRequest {
  tenantCode: string;
  errorInput: string;
  userId?: string;
}

export interface ErrorIdentificationResponse {
  errors: IdentifiedError[];
  searchDurationMs: number;
  searchedAt: string;
}

export interface IdentifiedError {
  hierarchyId: number;
  errorCode: string;
  errorName: string;
  hierarchyPath: string;
  mappingId: number;
  resolutionId: number;
  resolutionTitle: string;
  problemDescription: string;
  solutionSteps: string[];
  prerequisites?: string;
  expectedOutcome?: string;
  escalationNotes?: string;
  relevanceScore: number;
}

export interface ErrorHierarchyNode {
  hierarchyId: string;
  parentId?: string;
  levelType: 'PRODUCT' | 'MODULE' | 'ERROR';
  name: string;
  sortOrder?: number;
  isActive: boolean;
  childCount: number;
  children?: ErrorHierarchyNode[];

  // Detail-panel properties returned by the API
  code?: string;
  fullPath?: string;
  errorCount?: number;
  description?: string;
}

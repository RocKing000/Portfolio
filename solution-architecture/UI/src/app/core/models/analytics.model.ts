export interface TrendingError {
  tenantCode: string;
  tenantName: string;
  errorCode: string;
  errorName: string;
  hierarchyPath: string;
  totalSearches: number;
  totalViews: number;
  totalHelpful: number;
  totalNotHelpful: number;
  helpfulnessPercentage: number;
}

export interface DashboardMetrics {
  metricDate: string;
  tenantCode: string;
  tenantName: string;
  totalSearches: number;
  totalErrorsIdentified: number;
  totalUsersActive: number;
  topErrorCode?: string;
  topModuleCode?: string;
  avgSearchDurationMs?: number;
}

export interface FeedbackRequest {
  errorCode: string;
  tenantCode?: string;
  userId?: string;
  wasHelpful: boolean;
  comment?: string;
}

export interface FeedbackResponse {
  success: boolean;
  message: string;
  submittedAt: string;
}

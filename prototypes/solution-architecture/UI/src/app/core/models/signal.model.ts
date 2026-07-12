export interface Signal {
  signalId: string;
  tenantId: string;
  signalType: string;
  source: string;
  severity: 1 | 2 | 3 | 4;
  priority: string;
  title: string;
  description?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  payload?: string;
  mlOutputs?: string;
  hierarchyNodeId?: string;
  assignedTo?: string;
  resolutionNotes?: string;
  occurredAt: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Joined fields from API
  tenantCode?: string;
  tenantName?: string;
  hierarchyName?: string;
  createdByName?: string;
  assignedToName?: string;
  severityLabel?: string;
  ageCategory?: string;
  ageHours?: number;
  resolutionTimeHours?: number;
}

export interface SignalDetails extends Signal {
  comments: SignalComment[];
  tags: SignalTag[];
}

export interface SignalComment {
  commentId: string;
  signalId: string;
  userId: string;
  commentText: string;
  isInternal: boolean;
  createdAt: Date;
  updatedAt: Date;
  userName?: string;
  userEmail?: string;
}

export interface SignalTag {
  tagId: string;
  signalId: string;
  tagName: string;
  tagValue?: string;
  createdAt: Date;
  createdBy?: string;
  createdByName?: string;
}

export interface SignalAggregation {
  aggId: string;
  tenantId: string;
  signalType?: string;
  source?: string;
  periodType: string;
  periodStart: Date;
  periodEnd: Date;
  totalCount: number;
  openCount: number;
  resolvedCount: number;
  closedCount: number;
  criticalCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  avgResolutionTimeHours?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClassificationResult {
  classification: string;
  confidence: number;
  suggestedPriority: string;
  recommendedAction?: string;
  isFromMl: boolean;
  suggestedNodeId?: string;
  alternatives?: AlternativeClassification[];
}

export interface AlternativeClassification {
  classification: string;
  confidence: number;
}

export interface CreateSignalRequest {
  signalType: string;
  source: string;
  severity: 1 | 2 | 3 | 4;
  priority: string;
  title: string;
  description?: string;
  payload?: string;
  hierarchyNodeId?: string;
}

export interface UpdateStatusRequest {
  status: string;
  resolutionNotes?: string;
}

export interface AssignSignalRequest {
  assignToUserId: string;
}

export interface AddCommentRequest {
  commentText: string;
  isInternal: boolean;
}

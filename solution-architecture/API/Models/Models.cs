namespace EnterpriseChatbot.API.Models;

// ── Requests ─────────────────────────────────────────────────────────────────

public record ErrorIdentificationRequest(
    string TenantCode,
    string ErrorInput,
    string? UserId
);

public record SubmitFeedbackRequest(
    string ErrorCode,
    string? TenantCode,
    string? UserId,
    bool WasHelpful,
    string? Comment
);

public record TrackViewRequest(
    int MappingId,
    string? UserId,
    string? TenantCode
);

// ── Responses ────────────────────────────────────────────────────────────────

public record ErrorIdentificationResponse(
    List<IdentifiedError> Errors,
    long SearchDurationMs,
    DateTime SearchedAt
);

public record SubmitFeedbackResponse(
    bool Success,
    string Message,
    DateTime SubmittedAt
);

// ── Domain models ─────────────────────────────────────────────────────────────

public record IdentifiedError(
    int HierarchyId,
    string ErrorCode,
    string ErrorName,
    string HierarchyPath,
    int MappingId,
    int ResolutionId,
    string ResolutionTitle,
    string ProblemDescription,
    List<string> SolutionSteps,
    string? Prerequisites,
    string? ExpectedOutcome,
    string? EscalationNotes,
    decimal RelevanceScore
);

public record ErrorHierarchyNode(
    string HierarchyId,
    string? ParentId,
    string LevelType,
    string Name,
    int SortOrder,
    bool IsActive,
    int ChildCount
);

public class TrendingError
{
    public string TenantCode { get; set; } = string.Empty;
    public string TenantName { get; set; } = string.Empty;
    public string ErrorCode { get; set; } = string.Empty;
    public string ErrorName { get; set; } = string.Empty;
    public string HierarchyPath { get; set; } = string.Empty;
    public int TotalSearches { get; set; }
    public int TotalViews { get; set; }
    public int TotalHelpful { get; set; }
    public int TotalNotHelpful { get; set; }
    public double HelpfulnessPercentage { get; set; }
}

public class DashboardMetrics
{
    public DateTime MetricDate { get; set; }
    public string TenantCode { get; set; } = string.Empty;
    public string TenantName { get; set; } = string.Empty;
    public int TotalSearches { get; set; }
    public int TotalErrorsIdentified { get; set; }
    public int TotalUsersActive { get; set; }
    public string? TopErrorCode { get; set; }
    public string? TopModuleCode { get; set; }
    public int? AvgSearchDurationMs { get; set; }
}

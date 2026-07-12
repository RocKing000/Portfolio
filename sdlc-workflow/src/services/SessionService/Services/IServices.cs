using SessionService.Endpoints;

namespace SessionService.Services;

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------
public interface ISessionService
{
    Task<SessionDto> CreateSessionAsync(CreateSessionRequest request);
    Task<SessionDto?> GetSessionAsync(Guid id);
    Task UpdateStatusAsync(Guid id, string status);
    Task EndSessionAsync(Guid id);
}

// ---------------------------------------------------------------------------
// Review Queue
// ---------------------------------------------------------------------------
public interface IReviewQueueService
{
    Task<IEnumerable<ReviewQueueItemDto>> GetAvailableItemsAsync();
    Task<bool> ClaimItemAsync(Guid itemId, Guid reviewerUserId);
    Task SubmitDecisionAsync(Guid itemId, ReviewDecisionRequest request);
    Task EscalateItemAsync(Guid itemId, Guid escalateToUserId, string reason);
    Task<IEnumerable<ReviewQueueItemDto>> GetSessionReviewHistoryAsync(Guid sessionId);
}

// ---------------------------------------------------------------------------
// Repositories (data access interfaces — implemented with Dapper)
// ---------------------------------------------------------------------------
public interface ISessionRepository
{
    Task<SessionDto> CreateAsync(CreateSessionRequest request);
    Task<SessionDto?> GetByIdAsync(Guid id);
    Task UpdateStatusAsync(Guid id, string status);
    Task EndAsync(Guid id);
}

public interface IProjectRepository
{
    Task<Guid> CreateAsync(CreateProjectRequest request);
    Task<ProjectDto?> GetByIdAsync(Guid id);
    Task<IEnumerable<ProjectDto>> ListAsync();
    Task UpdateAsync(Guid id, UpdateProjectRequest request);
}

public interface IReviewQueueRepository
{
    Task<IEnumerable<ReviewQueueItemDto>> GetAvailableAsync();
    Task<bool> ClaimAsync(Guid itemId, Guid reviewerUserId);
    Task UpdateDecisionAsync(Guid itemId, string decision, string? comments, string? modifiedKey);
    Task EscalateAsync(Guid itemId, Guid toUserId, string reason);
    Task<IEnumerable<ReviewQueueItemDto>> GetBySessionAsync(Guid sessionId);
}

public interface IApprovalGateRepository
{
    Task<Guid> OpenAsync(OpenGateRequest request);
    Task<ApprovalGateDto?> GetByIdAsync(Guid id);
    Task CloseAsync(Guid id, GateDecisionRequest request);
    Task<IEnumerable<ApprovalGateDto>> GetPendingAsync(Guid sessionId);
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------
public record SessionDto(
    Guid Id, Guid ProjectId, int Component, string Status,
    string OperatingMode, DateTime StartedAt, DateTime? EndedAt
);

public record ProjectDto(
    Guid Id, string Name, string OperatingMode, string LLMProvider,
    string Status, DateTime CreatedAt
);

public record ReviewQueueItemDto(
    Guid Id, Guid SessionId, int Component, string ReviewType,
    string AgentName, string Priority, string Status,
    string? ContextSummary, string? OutputMinioKey, DateTime CreatedAt
);

public record ApprovalGateDto(
    Guid Id, Guid SessionId, int Component, int GateNumber,
    string GateName, string Status, DateTime OpenedAt, DateTime? ClosedAt
);

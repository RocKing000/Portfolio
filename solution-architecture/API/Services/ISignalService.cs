using EnterpriseChatbot.API.Models;

namespace EnterpriseChatbot.API.Services;

public interface ISignalService
{
    Task<Signal?> CreateSignalAsync(string tenantCode, Guid createdBy, CreateSignalRequest request,
        bool classifyAfterCreate = true, CancellationToken ct = default);

    Task<IEnumerable<Signal>> GetOpenSignalsAsync(string tenantCode, int topN = 50,
        byte? minSeverity = null, string? signalType = null, CancellationToken ct = default);

    Task<SignalDetails?> GetSignalDetailsAsync(Guid signalId, string tenantCode,
        CancellationToken ct = default);

    Task<Signal?> UpdateSignalStatusAsync(Guid signalId, string tenantCode, string newStatus,
        Guid updatedBy, string? resolutionNotes = null, CancellationToken ct = default);

    Task<Signal?> AssignSignalAsync(Guid signalId, string tenantCode, Guid assignToUserId,
        Guid assignedBy, CancellationToken ct = default);

    Task<SignalComment?> AddCommentAsync(Guid signalId, string tenantCode, string commentText,
        Guid createdBy, bool isInternal = true, CancellationToken ct = default);

    Task<ClassificationResult> ClassifySignalAsync(Guid signalId, string tenantCode,
        CancellationToken ct = default);

    Task<IEnumerable<Signal>> GetAssignedSignalsAsync(string tenantCode, Guid assignedToUserId,
        int topN = 50, CancellationToken ct = default);

    Task<IEnumerable<SignalAggregation>> GetAggregationsAsync(string tenantCode,
        string periodType = "DAY", int lastN = 30, CancellationToken ct = default);
}

namespace DocumentService.Infrastructure;

public record PlanVersion(
    Guid   Id,
    Guid   SessionId,
    Guid   ProjectId,
    int    VersionNumber,
    string MinioKey,
    string DocumentType,    // "generated" | "client_upload" | "merged"
    string UploadedBy,
    bool   IsCurrentVersion,
    DateTime CreatedAt
);

public record DocumentDiff(
    string Section,
    string ChangeType,      // "addition" | "modification" | "removal"
    string? OriginalText,
    string? NewText,
    bool   RequiresReapproval
);

public record UploadRequest(
    Guid   SessionId,
    Guid   ProjectId,
    string DocumentType,
    string UploadedBy,
    string FileName,
    Stream Content,
    long   ContentLength
);

public record UploadResult(
    Guid   VersionId,
    string MinioKey,
    int    VersionNumber,
    IReadOnlyList<DocumentDiff> Diffs,
    bool   HasConflicts,
    bool   RequiresReapproval
);

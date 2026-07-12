using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace EnterpriseChatbot.API.Models;

public class Signal
{
    public Guid     SignalId            { get; set; }
    public int      TenantId            { get; set; }
    public string   SignalType          { get; set; } = string.Empty;
    public string   Source              { get; set; } = string.Empty;
    public byte     Severity            { get; set; }
    public string   Priority            { get; set; } = string.Empty;
    public string   Status              { get; set; } = string.Empty;
    public string   Title               { get; set; } = string.Empty;
    public string?  Description         { get; set; }
    public string?  Payload             { get; set; }
    public string?  MlOutputs           { get; set; }
    public int?     HierarchyNodeId     { get; set; }
    public DateTime OccurredAt          { get; set; }
    public DateTime? ResolvedAt         { get; set; }
    public DateTime? ClosedAt           { get; set; }
    public DateTime CreatedAt           { get; set; }
    public DateTime UpdatedAt           { get; set; }
    public double?  ResolutionTimeHours { get; set; }
    public double   AgeHours            { get; set; }
    public string?  ResolutionNotes     { get; set; }
    public Guid     CreatedBy           { get; set; }
    public Guid?    AssignedTo          { get; set; }
    public string?  AssignedToName          { get; set; }
    public string?  HierarchyErrorCode      { get; set; }
    public string?  HierarchyErrorName      { get; set; }
    public string?  HierarchyErrorDescription { get; set; }
}

public class SignalDetails : Signal
{
    public List<SignalTag>     Tags     { get; set; } = [];
    public List<SignalComment> Comments { get; set; } = [];
}

public class SignalComment
{
    public Guid     CommentId       { get; set; }
    public Guid     SignalId        { get; set; }
    public string   CommentText     { get; set; } = string.Empty;
    public bool     IsInternal      { get; set; }
    public DateTime CreatedAt       { get; set; }
    public string?  CreatedByName   { get; set; }
}

public class SignalTag
{
    public int      TagId       { get; set; }
    public string   TagKey      { get; set; } = string.Empty;
    public string   TagValue    { get; set; } = string.Empty;
    public DateTime CreatedAt   { get; set; }
}

public class SignalAggregation
{
    public Guid     AggregationId       { get; set; }
    public string   PeriodType          { get; set; } = string.Empty;
    public DateTime PeriodStart         { get; set; }
    public DateTime PeriodEnd           { get; set; }
    public int      TotalSignals        { get; set; }
    public int      OpenSignals         { get; set; }
    public int      InProgressSignals   { get; set; }
    public int      ResolvedSignals     { get; set; }
    public int      ClosedSignals       { get; set; }
    public int      CriticalSignals     { get; set; }
    public int      HighSignals         { get; set; }
    public int      MediumSignals       { get; set; }
    public int      LowSignals          { get; set; }
    public decimal? AvgResolutionHours  { get; set; }
    public string?  StatsJson           { get; set; }
    public DateTime ComputedAt          { get; set; }
}

public class ClassificationResult
{
    public string   Classification      { get; set; } = string.Empty;
    public double   Confidence          { get; set; }
    public string   SuggestedPriority   { get; set; } = "MEDIUM";
    public string?  RecommendedAction   { get; set; }
    public bool     IsFromMl            { get; set; }
    public int?     SuggestedNodeId     { get; set; }
    public List<AlternativeClassification> Alternatives { get; set; } = [];
}

public class AlternativeClassification
{
    public string Classification { get; set; } = string.Empty;
    public double Confidence     { get; set; }
}

public class CreateSignalRequest : IValidatableObject
{
    [MinLength(1,   ErrorMessage = "SignalType cannot be empty")]
    [MaxLength(100, ErrorMessage = "SignalType must be 100 characters or less")]
    [RegularExpression(@"^(ERROR|WARNING|ALERT|INFO)$",
        ErrorMessage = "SignalType must be ERROR, WARNING, ALERT, or INFO")]
    public string SignalType { get; set; } = "ERROR";

    [MinLength(1,   ErrorMessage = "Source cannot be empty")]
    [MaxLength(255, ErrorMessage = "Source must be 255 characters or less")]
    [RegularExpression(@"^[a-zA-Z0-9_\-\.]+$",
        ErrorMessage = "Source may only contain letters, digits, underscores, hyphens, and dots")]
    public string Source { get; set; } = string.Empty;

    [Range(1, 4, ErrorMessage = "Severity must be between 1 and 4")]
    public byte Severity { get; set; } = 3;

    public string Priority { get; set; } = "MEDIUM";

    [MinLength(1,   ErrorMessage = "Title cannot be empty")]
    [MaxLength(500, ErrorMessage = "Title must be 500 characters or less")]
    public string Title { get; set; } = string.Empty;

    [MaxLength(65536, ErrorMessage = "Description must be 65536 characters or less")]
    public string? Description { get; set; }

    [MaxLength(65536, ErrorMessage = "Payload must be 65536 characters or less")]
    public string? Payload { get; set; }

    public int? HierarchyNodeId { get; set; }

    // Detects <script>, <iframe>, <object>, <embed>, <link>, <meta>, <style> tags in payload
    private static readonly Regex HtmlTagPattern = new(
        @"<\s*(script|iframe|object|embed|link|meta|style|img|svg|form|input)[^>]*>",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static bool IsValidJson(string json)
    {
        try { using var _ = JsonDocument.Parse(json); return true; }
        catch (JsonException) { return false; }
    }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        // Block control characters in Title (newlines, carriage returns, null bytes, etc.)
        if (!string.IsNullOrEmpty(Title) && Title.Any(c => c < 0x20 || c == 0x7F))
        {
            yield return new ValidationResult(
                "Title must not contain control characters (newlines, tabs, null bytes, etc.)",
                new[] { nameof(Title) });
        }

        if (Payload is not null)
        {
            // Require Payload to be valid JSON when provided
            if (!IsValidJson(Payload))
            {
                yield return new ValidationResult(
                    "Payload must be valid JSON",
                    new[] { nameof(Payload) });
            }
            else if (HtmlTagPattern.IsMatch(Payload))
            {
                yield return new ValidationResult(
                    "Payload must not contain HTML script or embed tags",
                    new[] { nameof(Payload) });
            }
        }
    }
}

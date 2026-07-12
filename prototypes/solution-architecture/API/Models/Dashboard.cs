using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace EnterpriseChatbot.API.Models;

public class Layout
{
    public Guid     LayoutId        { get; set; }
    public Guid     UserId          { get; set; }
    public Guid     TenantId        { get; set; }
    public string   LayoutName      { get; set; } = string.Empty;
    public string?  Description     { get; set; }
    public string   GridConfig      { get; set; } = "{}";
    public bool     IsDefault       { get; set; }
    public bool     IsPublic        { get; set; }
    public int      DisplayOrder    { get; set; }
    public DateTime CreatedAt       { get; set; }
    public DateTime UpdatedAt       { get; set; }
    public bool     IsOwner         { get; set; }
    public string   PermissionLevel { get; set; } = "EDIT";
    public string?  OwnerName       { get; set; }
    public int      WidgetCount     { get; set; }
}

public class LayoutDetails : Layout
{
    public List<Widget> Widgets { get; set; } = [];
}

public class Widget
{
    public Guid     WidgetId      { get; set; }
    public Guid     LayoutId      { get; set; }
    public string   WidgetType    { get; set; } = string.Empty;
    public string   Title         { get; set; } = string.Empty;
    public string   Position      { get; set; } = "{}";
    public string?  Config        { get; set; }
    public bool     IsLocked      { get; set; }
    public bool     IsVisible     { get; set; }
    public int      DisplayOrder  { get; set; }
    public DateTime CreatedAt     { get; set; }
}

public class WidgetTemplate
{
    public Guid     TemplateId       { get; set; }
    public string   TemplateName     { get; set; } = string.Empty;
    public string   WidgetType       { get; set; } = string.Empty;
    public string   Category         { get; set; } = string.Empty;
    public string?  Description      { get; set; }
    public string   DefaultConfig    { get; set; } = "{}";
    public string   DefaultPosition  { get; set; } = "{}";
    public bool     IsPremium        { get; set; }
    public bool     IsActive         { get; set; }
}

public class LayoutShare
{
    public Guid     ShareId          { get; set; }
    public Guid     LayoutId         { get; set; }
    public string   PermissionLevel  { get; set; } = "VIEW";
    public DateTime SharedAt         { get; set; }
    public string?  SharedWithName   { get; set; }
}

public class CreateLayoutRequest : IValidatableObject
{
    [MinLength(1,   ErrorMessage = "Layout name cannot be empty")]
    [MaxLength(255, ErrorMessage = "Layout name must be 255 characters or less")]
    public string LayoutName { get; set; } = string.Empty;

    [MaxLength(1000, ErrorMessage = "Description must be 1000 characters or less")]
    public string? Description { get; set; }

    [MaxLength(10000, ErrorMessage = "GridConfig must be 10000 characters or less")]
    public string? GridConfig { get; set; }

    public bool IsDefault { get; set; }
    public bool IsPublic  { get; set; }

    private static bool IsValidJson(string json)
    {
        try { using var _ = JsonDocument.Parse(json); return true; }
        catch (JsonException) { return false; }
    }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (string.IsNullOrWhiteSpace(LayoutName))
        {
            yield return new ValidationResult(
                "Layout name cannot be whitespace only",
                new[] { nameof(LayoutName) });
        }

        if (!string.IsNullOrEmpty(GridConfig) && !IsValidJson(GridConfig))
        {
            yield return new ValidationResult(
                "GridConfig must be valid JSON",
                new[] { nameof(GridConfig) });
        }
    }
}

public class AddWidgetRequest
{
    public Guid LayoutId { get; set; }

    [MinLength(1,   ErrorMessage = "WidgetType cannot be empty")]
    [MaxLength(100, ErrorMessage = "WidgetType must be 100 characters or less")]
    public string WidgetType { get; set; } = string.Empty;

    [MaxLength(255, ErrorMessage = "Title must be 255 characters or less")]
    public string Title { get; set; } = string.Empty;

    public string Position { get; set; } = "{\"row\":0,\"col\":0,\"width\":6,\"height\":4}";

    [MaxLength(1_048_576, ErrorMessage = "Config must be 1 MB or less")]
    public string? Config { get; set; }

    public int DisplayOrder { get; set; }
}

public class UpdateWidgetRequest
{
    public string?  Title       { get; set; }
    public string?  Position    { get; set; }
    public string?  Config      { get; set; }
    public bool?    IsVisible   { get; set; }
    public bool?    IsLocked    { get; set; }
}

public class ShareLayoutRequest
{
    public Guid     SharedWithUserId { get; set; }
    public string   PermissionLevel  { get; set; } = "VIEW";
}

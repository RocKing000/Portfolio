using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using System.Text.Json;

namespace DocumentService.Services;

public interface IDocxGenerator
{
    Stream GenerateRequirementsDocument(JsonDocument requirementsPackage);
    Stream GenerateDesignDocument(JsonDocument designPackage);
}

public class DocxGenerator : IDocxGenerator
{
    public Stream GenerateRequirementsDocument(JsonDocument requirementsPackage)
    {
        var ms = new MemoryStream();
        using var doc = WordprocessingDocument.Create(ms, WordprocessingDocumentType.Document, true);

        var main = doc.AddMainDocumentPart();
        main.Document = new Document(new Body());
        var body = main.Document.Body!;

        AddStyledParagraph(body, "Requirements Document", "Heading1");
        AddStyledParagraph(body, $"Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC", "Normal");

        if (requirementsPackage.RootElement.TryGetProperty("functional_requirements", out var frs))
        {
            AddStyledParagraph(body, "Functional Requirements", "Heading2");
            foreach (var req in frs.EnumerateArray())
                AddRequirementBlock(body, req);
        }

        if (requirementsPackage.RootElement.TryGetProperty("non_functional_requirements", out var nfrs))
        {
            AddStyledParagraph(body, "Non-Functional Requirements", "Heading2");
            foreach (var req in nfrs.EnumerateArray())
                AddRequirementBlock(body, req);
        }

        if (requirementsPackage.RootElement.TryGetProperty("constraints", out var cons))
        {
            AddStyledParagraph(body, "Constraints", "Heading2");
            foreach (var req in cons.EnumerateArray())
                AddRequirementBlock(body, req);
        }

        if (requirementsPackage.RootElement.TryGetProperty("assumptions", out var asms))
        {
            AddStyledParagraph(body, "Assumptions", "Heading2");
            foreach (var req in asms.EnumerateArray())
                AddRequirementBlock(body, req);
        }

        main.Document.Save();
        ms.Position = 0;
        return ms;
    }

    public Stream GenerateDesignDocument(JsonDocument designPackage)
    {
        var ms = new MemoryStream();
        using var doc = WordprocessingDocument.Create(ms, WordprocessingDocumentType.Document, true);

        var main = doc.AddMainDocumentPart();
        main.Document = new Document(new Body());
        var body = main.Document.Body!;

        AddStyledParagraph(body, "Technical Design Document", "Heading1");
        AddStyledParagraph(body, $"Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC", "Normal");

        foreach (var section in new[] { "architecture", "component_design", "data_model", "api_design", "ui_ux_design", "integration_design" })
        {
            if (!designPackage.RootElement.TryGetProperty(section, out var el)) continue;
            AddStyledParagraph(body, SectionTitle(section), "Heading2");
            AddJsonSection(body, el);
        }

        main.Document.Save();
        ms.Position = 0;
        return ms;
    }

    private static void AddRequirementBlock(Body body, JsonElement req)
    {
        var id   = req.TryGetProperty("id", out var idEl)   ? idEl.GetString()    : "";
        var text = req.TryGetProperty("text", out var textEl) ? textEl.GetString() : "";
        var pri  = req.TryGetProperty("priority", out var priEl) ? priEl.GetString() : "";

        var para = new Paragraph(
            new Run(new RunProperties(new Bold()), new Text($"[{id}] ({pri}) ") { Space = SpaceProcessingModeValues.Preserve }),
            new Run(new Text(text ?? "") { Space = SpaceProcessingModeValues.Preserve }));

        body.AppendChild(para);
    }

    private static void AddJsonSection(Body body, JsonElement el)
    {
        var text = el.ValueKind == JsonValueKind.String
            ? el.GetString()
            : el.ToString();
        AddStyledParagraph(body, text ?? "", "Normal");
    }

    private static void AddStyledParagraph(Body body, string text, string style)
    {
        var para = new Paragraph(
            new ParagraphProperties(new ParagraphStyleId { Val = style }),
            new Run(new Text(text) { Space = SpaceProcessingModeValues.Preserve }));
        body.AppendChild(para);
    }

    private static string SectionTitle(string key) => key switch
    {
        "architecture"      => "Architecture",
        "component_design"  => "Component Design",
        "data_model"        => "Data Model",
        "api_design"        => "API Design",
        "ui_ux_design"      => "UI/UX Design",
        "integration_design"=> "Integration Design",
        _                   => key
    };
}

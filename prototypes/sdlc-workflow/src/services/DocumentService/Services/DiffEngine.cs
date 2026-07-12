using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using DocumentService.Infrastructure;

namespace DocumentService.Services;

public interface IDiffEngine
{
    Task<IReadOnlyList<DocumentDiff>> ComputeDiffAsync(Stream original, Stream uploaded);
}

/// <summary>
/// Paragraph-level diff between two DOCX streams.
/// Sections whose heading matches known approval-gate keywords are flagged as requiring re-approval.
/// </summary>
public class DiffEngine : IDiffEngine
{
    private static readonly HashSet<string> ReapprovalKeywords = new(StringComparer.OrdinalIgnoreCase)
    {
        "scope", "must have", "constraint", "assumption", "objective", "goal",
        "non-functional", "security", "compliance", "architecture"
    };

    public Task<IReadOnlyList<DocumentDiff>> ComputeDiffAsync(Stream original, Stream uploaded)
    {
        var origParas     = ExtractParagraphs(original);
        var uploadedParas = ExtractParagraphs(uploaded);

        var origSet     = origParas.ToDictionary(p => p.Section + "::" + p.Text, p => p);
        var uploadedSet = uploadedParas.ToDictionary(p => p.Section + "::" + p.Text, p => p);

        var diffs = new List<DocumentDiff>();

        // Additions: present in uploaded but not original
        foreach (var (key, para) in uploadedSet)
        {
            if (!origSet.ContainsKey(key))
                diffs.Add(new DocumentDiff(
                    Section:           para.Section,
                    ChangeType:        "addition",
                    OriginalText:      null,
                    NewText:           para.Text,
                    RequiresReapproval: TouchesApprovalKeyword(para.Section + " " + para.Text)));
        }

        // Removals: present in original but not uploaded
        foreach (var (key, para) in origSet)
        {
            if (!uploadedSet.ContainsKey(key))
                diffs.Add(new DocumentDiff(
                    Section:           para.Section,
                    ChangeType:        "removal",
                    OriginalText:      para.Text,
                    NewText:           null,
                    RequiresReapproval: TouchesApprovalKeyword(para.Section + " " + para.Text)));
        }

        // Modifications: same section key, different text
        var origBySec     = origParas.GroupBy(p => p.Section).ToDictionary(g => g.Key, g => g.Select(p => p.Text).ToList());
        var uploadedBySec = uploadedParas.GroupBy(p => p.Section).ToDictionary(g => g.Key, g => g.Select(p => p.Text).ToList());

        foreach (var section in origBySec.Keys.Intersect(uploadedBySec.Keys))
        {
            var origLines     = origBySec[section];
            var uploadedLines = uploadedBySec[section];

            // Simple set-based modification detection per section
            var onlyInOrig     = origLines.Except(uploadedLines).ToList();
            var onlyInUploaded = uploadedLines.Except(origLines).ToList();

            for (int i = 0; i < Math.Min(onlyInOrig.Count, onlyInUploaded.Count); i++)
            {
                diffs.Add(new DocumentDiff(
                    Section:           section,
                    ChangeType:        "modification",
                    OriginalText:      onlyInOrig[i],
                    NewText:           onlyInUploaded[i],
                    RequiresReapproval: TouchesApprovalKeyword(section + " " + onlyInOrig[i])));
            }
        }

        IReadOnlyList<DocumentDiff> result = diffs.OrderBy(d => d.Section).ToList();
        return Task.FromResult(result);
    }

    private static bool TouchesApprovalKeyword(string text) =>
        ReapprovalKeywords.Any(k => text.Contains(k, StringComparison.OrdinalIgnoreCase));

    private static List<(string Section, string Text)> ExtractParagraphs(Stream docxStream)
    {
        var result  = new List<(string, string)>();
        var copyPos = docxStream.Position;

        try
        {
            using var doc = WordprocessingDocument.Open(docxStream, false);
            var body = doc.MainDocumentPart?.Document?.Body;
            if (body is null) return result;

            string currentSection = "Introduction";
            foreach (var para in body.Elements<Paragraph>())
            {
                var styleId = para.ParagraphProperties?.ParagraphStyleId?.Val?.Value ?? "";
                var text    = para.InnerText.Trim();
                if (string.IsNullOrEmpty(text)) continue;

                if (styleId.StartsWith("Heading", StringComparison.OrdinalIgnoreCase))
                    currentSection = text;
                else
                    result.Add((currentSection, text));
            }
        }
        finally
        {
            docxStream.Position = copyPos;
        }

        return result;
    }
}

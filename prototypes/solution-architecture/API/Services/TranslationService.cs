using System.Text.Json;
using System.Text.Json.Serialization;

namespace EnterpriseChatbot.API.Services
{
    public interface ITranslationService
    {
        string Translate(string text, string fromLang, string toLang);
        List<string> TranslateList(List<string> texts, string fromLang, string toLang);
    }

    public class TranslationService : ITranslationService
    {
        private readonly Dictionary<string, string> _enToKn = new(StringComparer.OrdinalIgnoreCase);
        private readonly ILogger<TranslationService> _logger;

        public TranslationService(IWebHostEnvironment env, ILogger<TranslationService> logger)
        {
            _logger = logger;
            LoadDictionary(env.ContentRootPath);
        }

        private void LoadDictionary(string contentRoot)
        {
            var jsonPath = Path.Combine(contentRoot, "Data", "en_to_kn_complete.json");
            if (!File.Exists(jsonPath))
            {
                _logger.LogError("Translation file not found at {Path}", jsonPath);
                return;
            }

            try
            {
                var json = File.ReadAllText(jsonPath);
                var data = JsonSerializer.Deserialize<TranslationData>(json);
                if (data == null) return;

                foreach (var section in new[]
                {
                    data.ErrorTitles, data.Descriptions, data.Solutions,
                    data.Categories, data.Severity, data.MatchTypes, data.RootCauses
                })
                {
                    if (section == null) continue;
                    foreach (var kvp in section)
                        _enToKn.TryAdd(kvp.Key, kvp.Value);
                }

                _logger.LogInformation("Translation dictionary loaded: {Count} entries from {Path}",
                    _enToKn.Count, jsonPath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load translation dictionary");
            }
        }

        public string Translate(string text, string fromLang, string toLang)
        {
            if (string.IsNullOrWhiteSpace(text) || fromLang == toLang || toLang != "kn")
                return text;

            if (_enToKn.TryGetValue(text.Trim(), out var exact))
                return exact;

            // Sentence-level: split multi-sentence text and translate each sentence
            var parts = text.Split(new[] { ". ", "\n", "\r\n" }, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length <= 1)
            {
                _logger.LogWarning("Missing translation for: '{Text}'", text.Trim());
                return text;
            }

            var translated = parts.Select(p =>
                _enToKn.TryGetValue(p.Trim(), out var t) ? t : p.Trim());
            return string.Join(". ", translated);
        }

        public List<string> TranslateList(List<string> texts, string fromLang, string toLang)
        {
            if (texts == null || texts.Count == 0) return texts ?? new List<string>();
            return texts.Select(t => Translate(t, fromLang, toLang)).ToList();
        }
    }

    internal class TranslationData
    {
        [JsonPropertyName("error_titles")] public Dictionary<string, string>? ErrorTitles { get; set; }
        [JsonPropertyName("descriptions")]  public Dictionary<string, string>? Descriptions  { get; set; }
        [JsonPropertyName("solutions")]     public Dictionary<string, string>? Solutions     { get; set; }
        [JsonPropertyName("categories")]    public Dictionary<string, string>? Categories    { get; set; }
        [JsonPropertyName("severity")]      public Dictionary<string, string>? Severity      { get; set; }
        [JsonPropertyName("match_types")]   public Dictionary<string, string>? MatchTypes    { get; set; }
        [JsonPropertyName("root_causes")]   public Dictionary<string, string>? RootCauses    { get; set; }
    }
}

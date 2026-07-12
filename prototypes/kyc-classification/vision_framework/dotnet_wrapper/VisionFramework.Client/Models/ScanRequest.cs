using System.Text.Json.Serialization;

namespace VisionFramework.Client.Models
{
    /// <summary>JSON body for /api/kyc/scan-document-json.</summary>
    public class ScanRequest
    {
        /// <summary>Base64-encoded image string (with or without data-URI prefix).</summary>
        [JsonPropertyName("image")]
        public string Image { get; set; } = string.Empty;
    }
}

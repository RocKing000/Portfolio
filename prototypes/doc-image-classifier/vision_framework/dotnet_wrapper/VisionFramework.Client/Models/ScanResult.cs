using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace VisionFramework.Client.Models
{
    /// <summary>Response from POST /api/kyc/scan-document or scan-document-json.</summary>
    public class ScanResult
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        /// <summary>Classified document type: aadhaar | pan | passport | driving_license | unknown</summary>
        [JsonPropertyName("document_type")]
        public string? DocumentType { get; set; }

        /// <summary>Extracted fields keyed by field name (e.g. aadhaar_number, name, dob).</summary>
        [JsonPropertyName("extracted_data")]
        public Dictionary<string, object?>? ExtractedData { get; set; }

        /// <summary>Base64-encoded image with sensitive digits masked (Aadhaar only).</summary>
        [JsonPropertyName("masked_image_base64")]
        public string? MaskedImageBase64 { get; set; }

        /// <summary>Time taken (ms) per pipeline step.</summary>
        [JsonPropertyName("step_times")]
        public Dictionary<string, double>? StepTimes { get; set; }

        /// <summary>List of validation error messages (empty when valid).</summary>
        [JsonPropertyName("validation_errors")]
        public List<string>? ValidationErrors { get; set; }

        [JsonPropertyName("message")]
        public string? Message { get; set; }
    }
}

using System.Text.Json.Serialization;

namespace VisionFramework.Client.Models
{
    /// <summary>Response from GET /framework/health.</summary>
    public class FrameworkHealth
    {
        [JsonPropertyName("status")]
        public string? Status { get; set; }

        [JsonPropertyName("framework_version")]
        public string? FrameworkVersion { get; set; }

        [JsonPropertyName("python_version")]
        public string? PythonVersion { get; set; }

        [JsonPropertyName("platform")]
        public string? Platform { get; set; }

        [JsonPropertyName("gpu_available")]
        public bool GpuAvailable { get; set; }

        [JsonPropertyName("gpu_count")]
        public int GpuCount { get; set; }

        [JsonPropertyName("gpu_name")]
        public string? GpuName { get; set; }

        [JsonPropertyName("models_registered")]
        public int ModelsRegistered { get; set; }

        [JsonPropertyName("models_loaded")]
        public int ModelsLoaded { get; set; }

        [JsonPropertyName("plugins_loaded")]
        public int PluginsLoaded { get; set; }
    }
}

using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using VisionFramework.Client.Interfaces;
using VisionFramework.Client.Models;

namespace VisionFramework.Client
{
    /// <summary>
    /// HTTP client for the Vision Framework Python API.
    ///
    /// Responsibilities: serialize requests, call FastAPI endpoints, deserialize responses.
    /// No business logic — all processing happens server-side.
    ///
    /// Configure base URL via the constructor or appsettings.json.
    /// All operations are async; retries are handled internally.
    /// </summary>
    public class VisionFrameworkClient : IVisionFramework, IDisposable
    {
        private readonly HttpClient _http;
        private readonly JsonSerializerOptions _jsonOptions;
        private readonly int _maxRetries;

        /// <summary>
        /// Initialise the client with a base URL.
        /// </summary>
        /// <param name="baseUrl">Base URL of the Vision Framework API (e.g. http://localhost:8000).</param>
        /// <param name="timeoutSeconds">HTTP request timeout in seconds. Default 60.</param>
        /// <param name="maxRetries">Number of retries on transient failure. Default 2.</param>
        public VisionFrameworkClient(
            string baseUrl = "http://localhost:8000",
            int timeoutSeconds = 60,
            int maxRetries = 2)
        {
            _http = new HttpClient
            {
                BaseAddress = new Uri(baseUrl.TrimEnd('/')),
                Timeout = TimeSpan.FromSeconds(timeoutSeconds),
            };
            _maxRetries = maxRetries;
            _jsonOptions = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
                WriteIndented = false,
            };
        }

        /// <inheritdoc />
        public async Task<ScanResult> ScanDocumentAsync(byte[] imageBytes)
        {
            var b64 = Convert.ToBase64String(imageBytes);
            var body = new { image = b64 };
            return await PostJsonAsync<ScanResult>("/api/kyc/scan-document-json", body);
        }

        /// <inheritdoc />
        public async Task<ScanResult> ScanDocumentFromFileAsync(string filePath)
        {
            if (!File.Exists(filePath))
                throw new FileNotFoundException("Image file not found.", filePath);

            var bytes = await File.ReadAllBytesAsync(filePath);

            using var content = new MultipartFormDataContent();
            var fileContent = new ByteArrayContent(bytes);
            var ext = Path.GetExtension(filePath).TrimStart('.').ToLowerInvariant();
            var mimeType = ext switch
            {
                "jpg" or "jpeg" => "image/jpeg",
                "png" => "image/png",
                "bmp" => "image/bmp",
                "webp" => "image/webp",
                _ => "application/octet-stream",
            };
            fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(mimeType);
            content.Add(fileContent, "file", Path.GetFileName(filePath));

            return await PostMultipartAsync<ScanResult>("/api/kyc/scan-document", content);
        }

        /// <inheritdoc />
        public async Task<FaceResult> CaptureFaceAsync(byte[] imageBytes)
        {
            var b64 = Convert.ToBase64String(imageBytes);
            var body = new { image = b64 };
            return await PostJsonAsync<FaceResult>("/api/kyc/capture-face", body);
        }

        /// <inheritdoc />
        public async Task<LivenessResult> VerifyLivenessAsync(List<byte[]> frames, string challenge)
        {
            var b64Frames = new List<string>(frames.Count);
            foreach (var frame in frames)
                b64Frames.Add(Convert.ToBase64String(frame));

            var body = new { frames = b64Frames, challenge };
            return await PostJsonAsync<LivenessResult>("/api/kyc/verify-liveness", body);
        }

        /// <inheritdoc />
        public async Task<MatchResult> MatchFacesAsync(byte[] documentImage, byte[] selfie)
        {
            var body = new
            {
                document_image = Convert.ToBase64String(documentImage),
                selfie = Convert.ToBase64String(selfie),
            };
            return await PostJsonAsync<MatchResult>("/api/kyc/match-face", body);
        }

        /// <inheritdoc />
        public async Task<FrameworkHealth> GetHealthAsync()
        {
            return await GetAsync<FrameworkHealth>("/framework/health");
        }

        // ------------------------------------------------------------------
        // Private HTTP helpers
        // ------------------------------------------------------------------

        private async Task<T> PostJsonAsync<T>(string path, object body)
        {
            var json = JsonSerializer.Serialize(body, _jsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            for (var attempt = 0; attempt <= _maxRetries; attempt++)
            {
                try
                {
                    var response = await _http.PostAsync(path, content);
                    await EnsureSuccessAsync(response);
                    return await DeserializeAsync<T>(response);
                }
                catch (HttpRequestException) when (attempt < _maxRetries)
                {
                    await Task.Delay(TimeSpan.FromMilliseconds(300 * (attempt + 1)));
                }
            }

            throw new InvalidOperationException($"All {_maxRetries + 1} attempts failed for POST {path}.");
        }

        private async Task<T> PostMultipartAsync<T>(string path, MultipartFormDataContent content)
        {
            for (var attempt = 0; attempt <= _maxRetries; attempt++)
            {
                try
                {
                    var response = await _http.PostAsync(path, content);
                    await EnsureSuccessAsync(response);
                    return await DeserializeAsync<T>(response);
                }
                catch (HttpRequestException) when (attempt < _maxRetries)
                {
                    await Task.Delay(TimeSpan.FromMilliseconds(300 * (attempt + 1)));
                }
            }

            throw new InvalidOperationException($"All {_maxRetries + 1} attempts failed for POST {path}.");
        }

        private async Task<T> GetAsync<T>(string path)
        {
            var response = await _http.GetAsync(path);
            await EnsureSuccessAsync(response);
            return await DeserializeAsync<T>(response);
        }

        private async Task<T> DeserializeAsync<T>(HttpResponseMessage response)
        {
            var stream = await response.Content.ReadAsStreamAsync();
            var result = await JsonSerializer.DeserializeAsync<T>(stream, _jsonOptions);
            if (result is null)
                throw new InvalidOperationException("Received null response from Vision Framework API.");
            return result;
        }

        private static async Task EnsureSuccessAsync(HttpResponseMessage response)
        {
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException(
                    $"Vision Framework API returned {(int)response.StatusCode}: {body}");
            }
        }

        /// <inheritdoc />
        public void Dispose() => _http.Dispose();
    }
}

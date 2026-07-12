using System.Collections.Generic;
using System.Threading.Tasks;
using VisionFramework.Client.Models;

namespace VisionFramework.Client.Interfaces
{
    /// <summary>
    /// Contract for the Vision Framework .NET client.
    /// All methods are async; callers should await them.
    /// The client never contains business logic — only HTTP calls.
    /// </summary>
    public interface IVisionFramework
    {
        /// <summary>Scan a KYC document from raw image bytes.</summary>
        Task<ScanResult> ScanDocumentAsync(byte[] imageBytes);

        /// <summary>Scan a KYC document from a local file path.</summary>
        Task<ScanResult> ScanDocumentFromFileAsync(string filePath);

        /// <summary>Detect a face in raw image bytes.</summary>
        Task<FaceResult> CaptureFaceAsync(byte[] imageBytes);

        /// <summary>
        /// Verify liveness from a sequence of frames.
        /// </summary>
        /// <param name="frames">Ordered list of frame byte arrays.</param>
        /// <param name="challenge">Challenge type: passive | blink | smile | turn_left | turn_right | nod</param>
        Task<LivenessResult> VerifyLivenessAsync(List<byte[]> frames, string challenge);

        /// <summary>Match a document photo against a live selfie.</summary>
        Task<MatchResult> MatchFacesAsync(byte[] documentImage, byte[] selfie);

        /// <summary>Retrieve framework health and GPU status.</summary>
        Task<FrameworkHealth> GetHealthAsync();
    }
}

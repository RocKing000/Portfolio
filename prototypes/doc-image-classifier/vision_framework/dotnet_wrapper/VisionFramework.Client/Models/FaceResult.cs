using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace VisionFramework.Client.Models
{
    /// <summary>Response from POST /api/kyc/capture-face.</summary>
    public class FaceResult
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("face_detected")]
        public bool FaceDetected { get; set; }

        /// <summary>[x, y, w, h] bounding box of the detected face.</summary>
        [JsonPropertyName("bounding_box")]
        public List<int>? BoundingBox { get; set; }

        [JsonPropertyName("confidence")]
        public double? Confidence { get; set; }

        [JsonPropertyName("liveness_required")]
        public bool LivenessRequired { get; set; }

        /// <summary>Challenge to present to the user: blink | smile | turn_left | turn_right | nod</summary>
        [JsonPropertyName("challenge")]
        public string? Challenge { get; set; }

        [JsonPropertyName("step_times")]
        public Dictionary<string, double>? StepTimes { get; set; }

        [JsonPropertyName("message")]
        public string? Message { get; set; }
    }

    /// <summary>Response from POST /api/kyc/verify-liveness.</summary>
    public class LivenessResult
    {
        [JsonPropertyName("is_live")]
        public bool IsLive { get; set; }

        [JsonPropertyName("motion_score")]
        public double? MotionScore { get; set; }

        [JsonPropertyName("challenge_passed")]
        public bool ChallengePassed { get; set; }

        [JsonPropertyName("confidence")]
        public double Confidence { get; set; }

        [JsonPropertyName("challenge")]
        public string? Challenge { get; set; }

        [JsonPropertyName("step_times")]
        public Dictionary<string, double>? StepTimes { get; set; }

        [JsonPropertyName("message")]
        public string? Message { get; set; }
    }

    /// <summary>Response from POST /api/kyc/match-face.</summary>
    public class MatchResult
    {
        [JsonPropertyName("is_match")]
        public bool IsMatch { get; set; }

        [JsonPropertyName("similarity_score")]
        public double SimilarityScore { get; set; }

        /// <summary>high | medium | no_match</summary>
        [JsonPropertyName("confidence_level")]
        public string? ConfidenceLevel { get; set; }

        [JsonPropertyName("threshold")]
        public double? Threshold { get; set; }

        [JsonPropertyName("message")]
        public string? Message { get; set; }
    }
}

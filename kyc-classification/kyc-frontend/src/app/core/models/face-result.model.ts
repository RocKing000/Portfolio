export interface FaceResult {
  success: boolean;
  face_detected: boolean;
  bounding_box: number[] | null;
  landmarks: Record<string, number[]> | null;
  confidence: number;
  face_image_base64: string | null;
  liveness_required: boolean;
  challenge: string | null;
  message: string;
}

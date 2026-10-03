export interface ExtractedData {
  document_number: string | null;
  document_number_valid: boolean;
  name: string | null;
  dob: string | null;
  gender: string | null;
  address: string | null;
}

export interface ScanResult {
  success: boolean;
  failed_at_step: string | null;
  document_type: string | null;
  extracted_data: ExtractedData | null;
  corrected_image_base64: string | null;
  masked_image_base64: string | null;
  step_times: Record<string, number>;
  total_time_ms: number;
  validation_errors: string[];
  hand_detected: boolean;
  occlusion_ratio: number;
  message: string | null;
}

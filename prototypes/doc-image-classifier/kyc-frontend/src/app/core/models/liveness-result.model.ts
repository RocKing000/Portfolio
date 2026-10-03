export interface LivenessResult {
  is_live: boolean;
  motion_score: number;
  challenge: string;
  challenge_passed: boolean;
  confidence: number;
  message: string;
}

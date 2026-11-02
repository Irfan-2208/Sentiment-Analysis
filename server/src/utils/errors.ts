export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'YOUTUBE_VIDEO_NOT_FOUND'
  | 'YOUTUBE_VIDEO_PRIVATE'
  | 'YOUTUBE_COMMENTS_DISABLED'
  | 'YOUTUBE_QUOTA_EXCEEDED'
  | 'YOUTUBE_INVALID_KEY'
  | 'YOUTUBE_INVALID_URL'
  | 'AI_PROVIDER_ERROR'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'ANALYSIS_NOT_FOUND'
  | 'ANALYSIS_ALREADY_RUNNING'
  | 'ANALYSIS_CANCELLED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SSRF_BLOCKED'
  | 'INVALID_INPUT'
  | 'INVALID_URL'
  | 'FILE_TOO_LARGE'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_REQUEST_FAILED'
  | 'PROVIDER_DATA_INVALID';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class YouTubeError extends AppError {
  constructor(code: ErrorCode, message: string, details?: unknown) {
    const statusMap: Record<string, number> = {
      YOUTUBE_VIDEO_NOT_FOUND: 404,
      YOUTUBE_VIDEO_PRIVATE: 403,
      YOUTUBE_COMMENTS_DISABLED: 422,
      YOUTUBE_QUOTA_EXCEEDED: 429,
      YOUTUBE_INVALID_KEY: 401,
      YOUTUBE_INVALID_URL: 400,
    };
    super(code, message, statusMap[code] ?? 400, details);
    this.name = 'YouTubeError';
    Object.setPrototypeOf(this, YouTubeError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super('NOT_FOUND', message, 404);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class AIProviderError extends AppError {
  constructor(message: string, details?: unknown) {
    super('AI_PROVIDER_ERROR', message, 503, details);
    this.name = 'AIProviderError';
    Object.setPrototypeOf(this, AIProviderError.prototype);
  }
}

export const friendlyMessages: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'The request contains invalid data.',
  NOT_FOUND: 'The requested resource was not found.',
  INTERNAL_ERROR: 'An internal server error occurred. Please try again.',
  YOUTUBE_VIDEO_NOT_FOUND: 'The YouTube video was not found. Please check the URL.',
  YOUTUBE_VIDEO_PRIVATE: 'This video is private and cannot be analyzed.',
  YOUTUBE_COMMENTS_DISABLED:
    'Comments are disabled on this video. There is nothing to analyze.',
  YOUTUBE_QUOTA_EXCEEDED:
    'YouTube API quota has been exceeded. Please try again later or use Demo Mode.',
  YOUTUBE_INVALID_KEY: 'The YouTube API key is invalid or missing.',
  YOUTUBE_INVALID_URL:
    'The URL is not a valid YouTube video URL. Supported formats: watch, youtu.be, shorts, embed, live.',
  AI_PROVIDER_ERROR: 'The AI provider encountered an error. Results may use fallback analysis.',
  AI_PROVIDER_UNAVAILABLE:
    'The AI provider is currently unavailable. Analysis will use fallback mode.',
  ANALYSIS_NOT_FOUND: 'Analysis not found.',
  ANALYSIS_ALREADY_RUNNING: 'An analysis for this video is already running.',
  ANALYSIS_CANCELLED: 'The analysis was cancelled.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please slow down.',
  SSRF_BLOCKED: 'Invalid request: only YouTube video IDs are accepted.',
  INVALID_INPUT: 'The input provided is invalid. Please check your data and try again.',
  INVALID_URL: 'The provided URL is invalid or not supported.',
  FILE_TOO_LARGE: 'The uploaded file exceeds the 5 MB or 5,000 row limit.',
  PROVIDER_NOT_CONFIGURED: 'The requested external provider is not configured or disabled.',
  PROVIDER_REQUEST_FAILED: 'External provider request failed. Please verify credentials and connectivity.',
  PROVIDER_DATA_INVALID: 'External provider returned invalid or unparseable review data.',
};

export type SafeErrorDetails = Record<string, unknown>;

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: SafeErrorDetails;

  constructor(statusCode: number, code: string, message: string, details?: SafeErrorDetails) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

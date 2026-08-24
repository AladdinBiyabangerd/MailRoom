import type { AxiosError } from "axios";

export interface ApiErrorBody {
  code?: string;
  message?: string;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message === "INVALID_CREDENTIALS") {
    return fallback;
  }
  const axiosError = error as AxiosError<ApiErrorBody>;
  const message = axiosError.response?.data?.message;
  if (message) return message;
  const code = axiosError.response?.data?.code;
  if (code) return code;
  return fallback;
}

export function isInvalidCredentials(error: unknown): boolean {
  const axiosError = error as AxiosError<ApiErrorBody>;
  return (
    axiosError.response?.data?.code === "INVALID_CREDENTIALS" ||
    axiosError.response?.status === 401
  );
}

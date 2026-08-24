export function isTokenExpired(token: string, bufferSeconds = 30): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1])) as { exp?: number };
    if (!payload.exp) return true;
    return Date.now() >= (payload.exp - bufferSeconds) * 1000;
  } catch {
    return true;
  }
}

export function isValidToken(token: string | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  return !isTokenExpired(token);
}

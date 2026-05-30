const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

type ApiProblemDetails = {
  message?: string;
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
};

type ApiRequestError = Error & {
  response?: {
    status: number;
    data?: ApiProblemDetails;
  };
};

function getAuthToken(): string | null {
  const directLocalToken = localStorage.getItem("auth.token");
  if (directLocalToken) return directLocalToken;

  const directSessionToken = sessionStorage.getItem("auth.token");
  if (directSessionToken) return directSessionToken;

  const localAuthRaw = localStorage.getItem("auth");
  if (localAuthRaw) {
    try {
      const parsed = JSON.parse(localAuthRaw) as { token?: string };
      if (parsed?.token) return parsed.token;
    } catch {
      // ignore malformed local auth payload
    }
  }

  const sessionAuthRaw = sessionStorage.getItem("auth");
  if (sessionAuthRaw) {
    try {
      const parsed = JSON.parse(sessionAuthRaw) as { token?: string };
      if (parsed?.token) return parsed.token;
    } catch {
      // ignore malformed session auth payload
    }
  }

  return null;
}

function extractErrorPayload(
  text: string,
  status: number
): {
  message: string;
  data?: ApiProblemDetails;
} {
  const fallback = `Request failed (${status})`;

  try {
    const json = JSON.parse(text) as ApiProblemDetails;

    if (typeof json?.message === "string" && json.message.trim()) {
      return {
        message: json.message.trim(),
        data: json,
      };
    }

    if (json?.errors && typeof json.errors === "object") {
      const firstKey = Object.keys(json.errors)[0];
      const firstMessage = firstKey ? json.errors[firstKey]?.[0] : undefined;

      if (firstMessage?.trim()) {
        return {
          message: firstMessage.trim(),
          data: json,
        };
      }

      return {
        message: fallback,
        data: json,
      };
    }

    if (typeof json?.detail === "string" && json.detail.trim()) {
      return {
        message: json.detail.trim(),
        data: json,
      };
    }

    if (typeof json?.title === "string" && json.title.trim()) {
      return {
        message: json.title.trim(),
        data: json,
      };
    }
  } catch {
    if (text.trim()) {
      return { message: text.trim() };
    }
  }

  return { message: fallback };
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;

  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error("Network error. Please check your connection.");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const payload = extractErrorPayload(text, res.status);

    const error = new Error(payload.message) as ApiRequestError;
    error.response = {
      status: res.status,
      data: payload.data,
    };

    throw error;
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();

  if (!text.trim()) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}
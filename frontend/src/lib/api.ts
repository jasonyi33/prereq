const FLASK_API_URL = process.env.NEXT_PUBLIC_FLASK_API_URL || "http://localhost:5000";

async function request(baseUrl: string, path: string, options?: RequestInit) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "1",
    ...((options?.headers as Record<string, string>) || {}),
  };

  // Inject auth header from localStorage token
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  return res.json();
}

export const flaskApi = {
  get: (path: string) => request(FLASK_API_URL, path),
  post: (path: string, body: unknown) =>
    request(FLASK_API_URL, path, { method: "POST", body: JSON.stringify(body) }),
  put: (path: string, body: unknown) =>
    request(FLASK_API_URL, path, { method: "PUT", body: JSON.stringify(body) }),
};

export const nextApi = {
  get: (path: string) => request("", path),
  post: (path: string, body: unknown) =>
    request("", path, { method: "POST", body: JSON.stringify(body) }),
};

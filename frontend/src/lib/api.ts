const FLASK_API_URL = process.env.NEXT_PUBLIC_FLASK_API_URL || "http://localhost:5000";

async function request(baseUrl: string, path: string, options?: RequestInit) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
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

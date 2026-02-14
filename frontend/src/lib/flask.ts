const FLASK_API_URL =
  process.env.FLASK_API_URL || "http://localhost:5000";

export async function flaskGet<T>(path: string): Promise<T> {
  const res = await fetch(`${FLASK_API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Flask GET ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function flaskPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${FLASK_API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Flask POST ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function flaskPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${FLASK_API_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Flask PUT ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

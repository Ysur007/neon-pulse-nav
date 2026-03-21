export async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
    credentials: "same-origin",
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    let payload = null;

    try {
      payload = await response.json();
      if (payload?.error) {
        message = payload.error;
      }
    } catch {}

    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

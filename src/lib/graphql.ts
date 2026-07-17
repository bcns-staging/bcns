// Astro's static build bakes import.meta.env values in at build time, so
// this picks the local dev server in `astro dev` and the deployed Cloud
// Run service otherwise.
export const GRAPHQL_ENDPOINT = import.meta.env.DEV
  ? "http://localhost:4000/graphql"
  : "https://bcns-graphql-api-751371770492.us-central1.run.app/graphql";

export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal,
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

// GraphQL subscriptions stream over Server-Sent Events: one HTTP response
// whose body keeps arriving in `data: {...}` frames as the server has new
// values to push, instead of the client repeatedly asking for updates.
export async function* graphqlSubscribe<T>(
  query: string,
  variables?: Record<string, unknown>,
  signal?: AbortSignal,
): AsyncGenerator<T> {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ query, variables }),
    signal,
  });
  if (!res.body) throw new Error("Subscription response had no body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) return;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const dataLine = frame.split("\n").find((line) => line.startsWith("data:"));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (!payload) continue;

      const json = JSON.parse(payload);
      if (json.errors) throw new Error(json.errors[0].message);
      if (json.data) yield json.data as T;
    }
  }
}

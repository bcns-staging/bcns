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

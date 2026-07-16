import { useEffect, useState } from "react";

type BeaconStatus = "ACTIVE" | "PLANNED" | "ARCHIVED";

interface Beacon {
  id: string;
  name: string;
  description: string;
  status: BeaconStatus;
}

// Astro's static build bakes import.meta.env values in at build time, so
// this picks the local dev server in `astro dev` and the deployed Cloud
// Run service otherwise.
const GRAPHQL_ENDPOINT = import.meta.env.DEV
  ? "http://localhost:4000/graphql"
  : "https://bcns-graphql-api-751371770492.us-central1.run.app/graphql";

const QUERY = /* GraphQL */ `
  query Beacons($status: BeaconStatus) {
    beacons(status: $status) {
      id
      name
      description
      status
    }
  }
`;

const FILTERS: Array<{ label: string; value: BeaconStatus | "" }> = [
  { label: "All", value: "" },
  { label: "Active", value: "ACTIVE" },
  { label: "Planned", value: "PLANNED" },
  { label: "Archived", value: "ARCHIVED" },
];

export default function BeaconsDirectory() {
  const [beacons, setBeacons] = useState<Beacon[]>([]);
  const [status, setStatus] = useState<BeaconStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: QUERY,
        variables: { status: status || null },
      }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.errors) throw new Error(json.errors[0].message);
        setBeacons(json.data.beacons);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [status]);

  return (
    <div className="beacons-directory">
      <div className="beacons-filters">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            className={f.value === status ? "active" : ""}
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <p>Loading beacons…</p>}
      {error && <p className="beacons-error">Failed to load: {error}</p>}

      {!loading && !error && (
        <ul className="beacons-list">
          {beacons.map((b) => (
            <li key={b.id}>
              <h3>{b.name}</h3>
              <p>{b.description}</p>
              <span className={`beacon-status status-${b.status.toLowerCase()}`}>
                {b.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

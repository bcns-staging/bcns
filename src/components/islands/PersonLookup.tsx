import { useEffect, useState } from "react";
import { graphqlRequest } from "../../lib/graphql";

type UserRole = "PUBLIC" | "PRIVATE" | "ADMIN";

interface PersonSummary {
  id: string;
  userName: string;
}

interface Person {
  id: string;
  userName: string;
  gender: string;
  country: string;
  age: number;
  dob: string | null;
  socials: string | null;
  imageUrl: string | null;
  ssn: string | null;
  contact: string | null;
  creditCardNumber: string | null;
  dlNumber: string | null;
}

const PEOPLE_QUERY = /* GraphQL */ `
  query People {
    people {
      id
      userName
    }
  }
`;

// Mirrors the server's field tiers (graphql-api/src/persons.ts) so the
// client only ever *asks* for fields the selected role can see - the
// response itself then only contains those keys, instead of the full
// field set with nulls for whatever the role wasn't allowed to view.
const FIELDS_BY_ROLE: Record<UserRole, string> = {
  PUBLIC: "id userName gender country age",
  PRIVATE: "id userName gender country age dob socials imageUrl",
  ADMIN:
    "id userName gender country age dob socials imageUrl ssn contact creditCardNumber dlNumber",
};

function buildPersonQuery(role: UserRole) {
  return /* GraphQL */ `
    query Person($id: ID!, $role: UserRole!) {
      person(id: $id, role: $role) {
        ${FIELDS_BY_ROLE[role]}
      }
    }
  `;
}

const ROLES: UserRole[] = ["PUBLIC", "PRIVATE", "ADMIN"];

const FIELD_LABELS: Array<[keyof Person, string]> = [
  ["userName", "User name"],
  ["gender", "Gender"],
  ["country", "Country"],
  ["age", "Age"],
  ["dob", "Date of birth"],
  ["socials", "Socials"],
  ["imageUrl", "Image"],
  ["ssn", "SSN"],
  ["contact", "Contact"],
  ["creditCardNumber", "Credit card number"],
  ["dlNumber", "DL number"],
];

export default function PersonLookup() {
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [role, setRole] = useState<UserRole>("PUBLIC");
  const [personId, setPersonId] = useState("");
  const [result, setResult] = useState<Person | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    graphqlRequest<{ people: PersonSummary[] }>(PEOPLE_QUERY)
      .then((data) => {
        setPeople(data.people);
        if (data.people.length > 0) setPersonId(data.people[0].id);
      })
      .catch((err) => setError(err.message));
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!personId) return;

    setLoading(true);
    setError(null);
    setResult(null);

    graphqlRequest<{ person: Person }>(buildPersonQuery(role), { id: personId, role })
      .then((data) => setResult(data.person))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  return (
    <div className="person-lookup">
      <form className="person-lookup-form" onSubmit={handleSubmit}>
        <label>
          User type
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0) + r.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>

        <label>
          Person
          <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.userName}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" disabled={loading || !personId}>
          {loading ? "Loading…" : "Submit"}
        </button>
      </form>

      {error && <p className="person-lookup-error">Failed to load: {error}</p>}

      {result && (
        <dl className="person-lookup-result">
          {FIELD_LABELS.map(([field, label]) => {
            const value = result[field];
            if (value === null || value === undefined) return null;
            return (
              <div key={field}>
                <dt>{label}</dt>
                <dd>
                  {field === "imageUrl" ? (
                    <img src={String(value)} alt={`${result.userName} avatar`} width={64} height={64} />
                  ) : (
                    String(value)
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}

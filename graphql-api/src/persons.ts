import { firestore } from "./firestore.js";

export type UserRole = "PUBLIC" | "PRIVATE" | "ADMIN";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface PersonRecord {
  id: string;
  userName: string;
  gender: string;
  country: string;
  age: number;
  dob: string;
  socials: string;
  imageUrl: string;
  ssn: string;
  contact: string;
  creditCardNumber: string;
  dlNumber: string;
  lastKnownLocation: Coordinates;
}

// Field tiers matching the access-control diagram: each role sees its own
// fields plus everything from the tier(s) below it.
const PUBLIC_FIELDS = ["id", "userName", "gender", "country", "age"] as const;
const PRIVATE_FIELDS = [...PUBLIC_FIELDS, "dob", "socials", "imageUrl"] as const;
const ADMIN_FIELDS = [
  ...PRIVATE_FIELDS,
  "ssn",
  "contact",
  "creditCardNumber",
  "dlNumber",
  "lastKnownLocation",
] as const;

const FIELDS_BY_ROLE: Record<UserRole, readonly (keyof PersonRecord)[]> = {
  PUBLIC: PUBLIC_FIELDS,
  PRIVATE: PRIVATE_FIELDS,
  ADMIN: ADMIN_FIELDS,
};

// This is the field-level authorization step from the diagram: given a full
// record and a role, return only the fields that role is allowed to see
// (the rest come back as null, per the GraphQL schema's nullable fields).
// The role here is a caller-supplied argument, not a verified identity - see
// README for what would be needed to make this a real access control check.
export function maskPersonForRole(
  person: PersonRecord,
  role: UserRole,
): Partial<PersonRecord> {
  const allowed = FIELDS_BY_ROLE[role];
  const masked: Partial<PersonRecord> = {};
  for (const field of allowed) {
    masked[field] = person[field] as never;
  }
  return masked;
}

const collection = () => firestore.collection("persons");

export async function getAllPersons(): Promise<PersonRecord[]> {
  const snapshot = await collection().get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<PersonRecord, "id">),
  }));
}

export async function getPersonById(id: string): Promise<PersonRecord | null> {
  const doc = await collection().doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as Omit<PersonRecord, "id">) };
}

// No real GPS feed behind this demo - simulates believable movement (like a
// vehicle driving) as a small random step from the last position, clamped/
// wrapped to stay within valid lat/lng ranges over a long-running walk.
export function randomWalkStep(from: Coordinates): Coordinates {
  const STEP = 0.0015; // ~150m per tick at these latitudes - stays roughly in-city over a demo session
  let lat = from.lat + (Math.random() - 0.5) * STEP;
  let lng = from.lng + (Math.random() - 0.5) * STEP;
  lat = Math.max(-90, Math.min(90, lat));
  lng = ((((lng + 180) % 360) + 360) % 360) - 180;
  return { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
}

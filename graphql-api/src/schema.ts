import { createSchema } from "graphql-yoga";
import { GraphQLError } from "graphql";
import { beacons, type BeaconStatus } from "./data.js";
import {
  getAllPersons,
  getPersonById,
  maskPersonForRole,
  randomWalkStep,
  type UserRole,
} from "./persons.js";

const typeDefs = /* GraphQL */ `
  enum BeaconStatus {
    ACTIVE
    PLANNED
    ARCHIVED
  }

  type Beacon {
    id: ID!
    name: String!
    description: String!
    status: BeaconStatus!
  }

  enum UserRole {
    PUBLIC
    PRIVATE
    ADMIN
  }

  type Coordinates {
    lat: Float!
    lng: Float!
  }

  type Person {
    id: ID!
    userName: String!
    gender: String!
    country: String!
    age: Int!
    dob: String
    socials: String
    imageUrl: String
    ssn: String
    contact: String
    creditCardNumber: String
    dlNumber: String
    lastKnownLocation: Coordinates
  }

  type Query {
    beacons(status: BeaconStatus): [Beacon!]!
    people(role: UserRole = PUBLIC): [Person!]!
    person(id: ID!, role: UserRole!): Person
  }

  type Subscription {
    personLocationUpdated(id: ID!, role: UserRole!): Coordinates!
  }
`;

const resolvers = {
  Query: {
    beacons: (_parent: unknown, args: { status?: BeaconStatus }) =>
      args.status ? beacons.filter((b) => b.status === args.status) : beacons,
    people: async (_parent: unknown, args: { role?: UserRole }) => {
      const records = await getAllPersons();
      return records.map((r) => maskPersonForRole(r, args.role ?? "PUBLIC"));
    },
    person: async (_parent: unknown, args: { id: string; role: UserRole }) => {
      const record = await getPersonById(args.id);
      return record ? maskPersonForRole(record, args.role) : null;
    },
  },
  Subscription: {
    personLocationUpdated: {
      // lastKnownLocation is ADMIN-tier only (same field, same rule as the
      // person/people queries) - enforced here too since a subscription is
      // its own separate access path, not covered by the query resolvers.
      subscribe: async function* (_parent: unknown, args: { id: string; role: UserRole }) {
        if (args.role !== "ADMIN") {
          throw new GraphQLError("Not authorized to view this field.");
        }
        const record = await getPersonById(args.id);
        if (!record) return;

        let current = record.lastKnownLocation;
        while (true) {
          await new Promise((resolve) => setTimeout(resolve, 2500));
          current = randomWalkStep(current);
          yield { personLocationUpdated: current };
        }
      },
    },
  },
};

export const schema = createSchema({ typeDefs, resolvers });

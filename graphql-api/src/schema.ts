import { createSchema } from "graphql-yoga";
import { beacons, type BeaconStatus } from "./data.js";
import { getAllPersons, getPersonById, maskPersonForRole, type UserRole } from "./persons.js";

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

  type PersonSummary {
    id: ID!
    userName: String!
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
  }

  type Query {
    beacons(status: BeaconStatus): [Beacon!]!
    people: [PersonSummary!]!
    person(id: ID!, role: UserRole!): Person
  }
`;

const resolvers = {
  Query: {
    beacons: (_parent: unknown, args: { status?: BeaconStatus }) =>
      args.status ? beacons.filter((b) => b.status === args.status) : beacons,
    people: () => getAllPersons(),
    person: async (_parent: unknown, args: { id: string; role: UserRole }) => {
      const record = await getPersonById(args.id);
      return record ? maskPersonForRole(record, args.role) : null;
    },
  },
};

export const schema = createSchema({ typeDefs, resolvers });

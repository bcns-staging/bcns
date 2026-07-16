import { createSchema } from "graphql-yoga";
import { beacons, type BeaconStatus } from "./data.js";

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

  type Query {
    beacons(status: BeaconStatus): [Beacon!]!
  }
`;

const resolvers = {
  Query: {
    beacons: (_parent: unknown, args: { status?: BeaconStatus }) =>
      args.status ? beacons.filter((b) => b.status === args.status) : beacons,
  },
};

export const schema = createSchema({ typeDefs, resolvers });

import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { useDisableIntrospection } from "@graphql-yoga/plugin-disable-introspection";
import { schema } from "./schema.js";

const allowedOrigins = [
  "https://www.7beacons.com",
  "https://7beacons.com",
  "http://localhost:4321",
];

const isProduction = process.env.NODE_ENV === "production";

const yoga = createYoga({
  schema,
  cors: {
    origin: allowedOrigins,
    methods: ["POST"],
  },
  // Schema introspection and the GraphiQL playground reveal every field
  // name (including ones access-controlled at the resolver level, like
  // ssn/creditCardNumber) to anyone who asks - fine for local exploration,
  // not for the public internet.
  graphiql: !isProduction,
  plugins: isProduction ? [useDisableIntrospection()] : [],
});

const server = createServer(yoga);

const port = Number(process.env.PORT) || 8080;
server.listen(port, () => {
  console.log(`GraphQL API listening on :${port}${yoga.graphqlEndpoint}`);
});

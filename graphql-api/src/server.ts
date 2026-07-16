import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { schema } from "./schema.js";

const allowedOrigins = [
  "https://www.7beacons.com",
  "https://7beacons.com",
  "http://localhost:4321",
];

const yoga = createYoga({
  schema,
  cors: {
    origin: allowedOrigins,
    methods: ["POST"],
  },
});

const server = createServer(yoga);

const port = Number(process.env.PORT) || 8080;
server.listen(port, () => {
  console.log(`GraphQL API listening on :${port}${yoga.graphqlEndpoint}`);
});

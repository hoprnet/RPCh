const {
  // Database connection url
  DB_CONNECTION_URL,
} = process.env;

// Port that server will listen for requests
const PORT = process.env.PORT ? Number(process.env.PORT) : 3050;

const METRIC_PREFIX = "availability_monitor";

export { DB_CONNECTION_URL, PORT, METRIC_PREFIX };

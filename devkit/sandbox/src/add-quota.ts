/**
 * FOR DEVELOPMENT ONLY
 * Add quota for discovery platform
 */
import fetch from "node-fetch";

// we do not run this build this file via turbo
/* eslint-disable turbo/no-undeclared-env-vars */
const { NODE_ENV = "development" } = process.env;

const DP_API_ENDPOINT = process.env.DP_API_ENDPOINT ?? "http://localhost:3020";
const CLIENT = "sandbox";
const QUOTA = 1000;

const debug = NODE_ENV === "production" ? () => {} : console.log;

const headers = {
  "Content-Type": "application/json",
  "Accept-Content": "application/json",
};

const addQuota = async (): Promise<string> => {
  const url = new URL("/api/v1/client/quota", DP_API_ENDPOINT);
  const body = {
    client: CLIENT,
    quota: QUOTA,
  };
  debug("Adding quota", body);

  return fetch(url.toString(), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }).then((res) => res.json());
};

addQuota().then(console.log).catch(console.error);

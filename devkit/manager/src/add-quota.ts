import fetch from "node-fetch";
import { utils } from "@rpch/common";
import { createLogger } from "./utils";

const log = createLogger(["add-quota"]);

/**
 * Add quota to a client by interacting with the
 * discovery platform API.
 * @param discoveryPlatformEndpoint
 * @param client client who we want to add quota
 * @param quota amount of quota
 */
export default async function main(
  discoveryPlatformEndpoint: string,
  client: string,
  quota: string
): Promise<void> {
  log.normal("Adding quota", {
    discoveryPlatformEndpoint,
    client,
    quota,
  });

  const [url, headers] = utils.createApiUrl(
    "http",
    discoveryPlatformEndpoint,
    "/api/v1/client/quota"
  );

  const result = await fetch(url.toString(), {
    method: "POST",
    headers,
    body: JSON.stringify({
      client,
      quota,
    }),
  });

  if (result.status !== 200) {
    log.error("Could not add quota", await result.text());
    throw Error("Could not add quota");
  }
}

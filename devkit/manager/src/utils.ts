import fetch from "node-fetch";
import { utils } from "@rpch/common";

export const createLogger = utils.LoggerFactory("sandbox");

export async function getBalances(
  hoprdEndpoint: string,
  hoprdToken: string
): Promise<{ hopr: string; native: string }> {
  const [url, headers] = utils.createApiUrl(
    "http",
    hoprdEndpoint,
    "/api/v2/account/balances",
    hoprdToken
  );

  return fetch(url, {
    method: "GET",
    headers,
  }).then((res) => res.json());
}

export async function getHoprTokenAddress(
  hoprdEndpoint: string,
  hoprdToken: string
): Promise<string> {
  const [url, headers] = utils.createApiUrl(
    "http",
    hoprdEndpoint,
    "/api/v2/node/info",
    hoprdToken
  );

  return fetch(url.toString(), {
    method: "GET",
    headers,
  })
    .then((res) => res.json())
    .then((res: any) => res.hoprToken);
}

export async function withdraw(
  hoprdEndpoint: string,
  hoprdToken: string,
  currency: "NATIVE" | "HOPR",
  amount: string,
  recipient: string
) {
  const [url, headers] = utils.createApiUrl(
    "http",
    hoprdEndpoint,
    "/api/v2/account/withdraw",
    hoprdToken
  );

  return fetch(url.toString(), {
    method: "POST",
    headers,
    body: JSON.stringify({
      currency,
      amount,
      recipient,
    }),
  })
    .then((res) => res.json())
    .then((res: { receipt: string }) => res.receipt);
}

export async function getPeerId(
  hoprdEndpoint: string,
  hoprdToken: string
): Promise<string> {
  const [url, headers] = utils.createApiUrl(
    "http",
    hoprdEndpoint,
    "/api/v2/account/addresses",
    hoprdToken
  );

  return fetch(url.toString(), {
    method: "GET",
    headers,
  })
    .then((res) => res.json())
    .then((res: { hopr: string; native: string }) => res.hopr);
}

export async function getInfo(
  hoprdEndpoint: string,
  hoprdToken: string
): Promise<{ hoprToken: string }> {
  const [url, headers] = utils.createApiUrl(
    "http",
    hoprdEndpoint,
    "/api/v2/node/info",
    hoprdToken
  );

  return fetch(url.toString(), {
    method: "GET",
    headers,
  })
    .then((res) => res.json())
    .then((res: { hoprToken: string }) => res);
}

export async function openChannel(
  hoprdEndpoint: string,
  hoprdToken: string,
  hoprAmount: string,
  counterpartyPeerId: string
) {
  const [url, headers] = utils.createApiUrl(
    "http",
    hoprdEndpoint,
    "/api/v2/channels",
    hoprdToken
  );

  const response = await fetch(url.toString(), {
    method: "POST",
    headers,
    body: JSON.stringify({
      peerId: counterpartyPeerId,
      amount: hoprAmount,
    }),
  });

  if (response.status !== 201 && response.status !== 409) {
    throw Error(
      `Failed to open channel from '${hoprdEndpoint}' to '${counterpartyPeerId}'`
    );
  }
}

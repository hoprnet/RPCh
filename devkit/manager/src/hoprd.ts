/**
 * Various HOPRd API functions.
 * TODO: replace with HOPRd SDK once its published
 */
import { utils } from "@rpch/common";

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
  }).then((res) => res.json() as unknown as { hopr: string; native: string });
}

export async function withdraw(
  hoprdEndpoint: string,
  hoprdToken: string,
  currency: "NATIVE" | "HOPR",
  amount: string,
  recipient: string
): Promise<string> {
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
    .then((res) => res.json() as unknown as { receipt: string })
    .then((res) => res.receipt);
}

export async function getAddresses(
  hoprdEndpoint: string,
  hoprdToken: string
): Promise<{ hopr: string; native: string }> {
  const [url, headers] = utils.createApiUrl(
    "http",
    hoprdEndpoint,
    "/api/v2/account/addresses",
    hoprdToken
  );

  return fetch(url.toString(), {
    method: "GET",
    headers,
  }).then((res) => res.json() as unknown as { hopr: string; native: string });
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
  }).then((res) => res.json() as unknown as { hoprToken: string });
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

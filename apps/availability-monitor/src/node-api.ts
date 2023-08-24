export function getPeers({
  apiEndpoint,
  accessToken,
}: {
  apiEndpoint: URL;
  accessToken: string;
}): Promise<{ connected: any[] }> {
  const url = new URL(apiEndpoint.toString());
  url.pathname = "/api/v2/node/peers";
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-auth-token": accessToken,
  };
  return fetch(url, { headers }).then((res) => res.json());
}

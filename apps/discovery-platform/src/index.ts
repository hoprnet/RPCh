import { entryServer } from "./entry-server";

const PORT = 3000;

const main = () => {
  const server = entryServer();
  server.listen(3000);
};

main();

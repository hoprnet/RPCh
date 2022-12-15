import { DBInstance } from "./db";
import { entryServer } from "./entry-server";

const { PORT = 3000 } = process.env;

const main = () => {
  const db: DBInstance = {
    data: {
      registeredNodes: [],
    },
  };
  const server = entryServer({ db });
  server.listen(PORT);
};

main();

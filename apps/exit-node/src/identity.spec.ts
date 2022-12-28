import assert from "assert";
import { utils } from "ethers";
import { fixtures } from "@rpch/common";
import * as identity from "./identity";

const PRIV_KEY = utils.arrayify(fixtures.EXIT_NODE_PRIV_KEY_A);
const PASSWORD = "somepassword123";

// encrypted privat key updated when 'storePrivateKey' is called
let storage: Buffer;
jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  promises: {
    writeFile: jest.fn(async (_fileDir: string, encrypted: Buffer) => {
      storage = encrypted;
    }),
    readFile: jest.fn(async () => {
      return storage;
    }),
  },
}));

describe("test identity.ts", function () {
  it("should generate a private key using createPrivateKey", async function () {
    const privKey = await identity.createPrivateKey();
    assert(privKey instanceof Uint8Array);
  });

  it("should encrypt and store the private key using storePrivateKey", async function () {
    const encrypted = await identity.storePrivateKey(PRIV_KEY, PASSWORD, "");
    assert.deepEqual(storage, encrypted);
  });

  it("should load and decrypt the private key using loadPrivateKey", async function () {
    const decrypted = await identity.loadPrivateKey(PASSWORD, "");
    assert.deepEqual(decrypted, PRIV_KEY);
  });

  it("should load identity via password", async function () {
    const myIdentity = await identity.getIdentity({
      identityDir: "",
      password: PASSWORD,
    });
    assert(!!myIdentity);
  });
});

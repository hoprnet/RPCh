import { ParamSchema } from "express-validator";
import { RegisteredNode } from "../../../types";
import { isListSafe } from "../../../utils";

// Sanitization and Validation
export const registerNodeSchema: Record<keyof RegisteredNode, ParamSchema> = {
  peerId: {
    in: "body",
    exists: {
      errorMessage: "Expected peerId to be in the body",
      bail: true,
    },
    isString: true,
  },
  chainId: {
    in: "body",
    exists: {
      errorMessage: "Expected chainId to be in the body",
      bail: true,
    },
    isNumeric: true,
    toInt: true,
  },
  exitNodePubKey: {
    in: "body",
    exists: {
      errorMessage: "Expected exitNodePubKey to be in the body",
      bail: true,
    },
    isString: true,
  },
  hasExitNode: {
    in: "body",
    exists: {
      errorMessage: "Expected hasExitNode to be in the body",
      bail: true,
    },
    isBoolean: true,
    toBoolean: true,
  },
  hoprdApiEndpoint: {
    in: "body",
    exists: {
      errorMessage: "Expected hoprdApiEndpoint to be in the body",
      bail: true,
    },
    isString: true,
  },
  hoprdApiToken: {
    in: "body",
    exists: {
      errorMessage: "Expected hoprdApiToken to be in the body",
      bail: true,
    },
    isString: true,
  },
  nativeAddress: {
    in: "body",
    exists: {
      errorMessage: "Expected nativeAddress to be in the body",
      bail: true,
    },
    isString: true,
  },
};

export const getNodeSchema: Record<
  keyof { excludeList?: string; hasExitNode?: string },
  ParamSchema
> = {
  excludeList: {
    optional: true,
    in: "query",
    custom: {
      options: (value) => {
        return isListSafe(value);
      },
    },
  },
  hasExitNode: {
    optional: true,
    in: "query",
    isBoolean: true,
  },
};

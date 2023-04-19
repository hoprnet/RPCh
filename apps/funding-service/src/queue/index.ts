import { Signer } from "ethers";
import { blockchain } from "@rpch/common";
import { RequestDB } from "../types";
import { RequestService } from "../request";
import { CustomError, createLogger } from "../utils";
import * as constants from "../constants";
import type { Counter } from "prom-client";

const log = createLogger(["queue"]);

/**
 * Scans through all requests and fulfills the oldest fresh request
 * @param requestService
 * @param signer ethers signer that will send the transaction
 * @param confirmations amount of confirmations to wait for every transaction
 * @param changeState updates a higher lever boolean that stops this function from running
 * @param register Prometheus register that will hold metrics
 * while it is already running
 */
export const checkFreshRequests = async (ops: {
  requestService: RequestService;
  signer: Signer;
  confirmations: number;
  changeState: (state: boolean) => void;
  counterSuccessfulFundingNodes: Counter<string>;
  counterFailedFundingNodes: Counter<string>;
}) => {
  ops.changeState(true);
  let freshRequest: RequestDB | null | undefined;
  try {
    freshRequest = await ops.requestService.getOldestFreshRequest();
    log.verbose("Starting to fulfill request: ", JSON.stringify(freshRequest));
    if (!freshRequest) throw new CustomError("No pending fresh request");
    log.normal(
      "handling request: ",
      freshRequest.id,
      log.createMetric({ id: freshRequest.id })
    );
    // check if request and signer are valid
    if (!ops.signer) throw new CustomError("Missing signer transaction");
    if (!freshRequest.chain_id)
      throw new CustomError("Request is missing chainId");
    // check if signer has enough to fund request
    const provider = ops.signer.provider
      ? ops.signer.provider
      : await blockchain.getProvider(freshRequest.chain_id);
    let connectedSigner = ops.signer.provider
      ? ops.signer
      : ops.signer.connect(provider);
    let address = await connectedSigner.getAddress();
    const balance = await blockchain.getBalance(
      constants.SMART_CONTRACTS_PER_CHAIN?.[
        freshRequest.chain_id as keyof typeof constants.SMART_CONTRACTS_PER_CHAIN
      ],
      address,
      provider
    );

    if (BigInt(balance) < BigInt(freshRequest.amount))
      throw new CustomError(
        "Signer does not have enough balance to fund request"
      );
    log.verbose("Request is on the wire ", freshRequest.id);
    // set request status to pending while it is on the wire
    await ops.requestService.updateRequest(freshRequest.id, {
      status: "PENDING",
      access_token_hash: freshRequest.access_token_hash,
      node_address: freshRequest.node_address,
      chain_id: freshRequest.chain_id,
      amount: BigInt(freshRequest.amount),
      id: freshRequest.id,
    });

    // sent transaction to fund request
    const { hash: txHash } = await blockchain.sendTransaction({
      smartContractAddress:
        constants.SMART_CONTRACTS_PER_CHAIN?.[
          freshRequest.chain_id as keyof typeof constants.SMART_CONTRACTS_PER_CHAIN
        ],
      from: connectedSigner,
      to: freshRequest?.node_address,
      amount: freshRequest.amount.toString(),
    });
    // set request status to pending while it is confirmed or failed
    await ops.requestService.updateRequest(freshRequest.id, {
      transaction_hash: txHash,
      status: "PENDING",
      access_token_hash: freshRequest.access_token_hash,
      node_address: freshRequest.node_address,
      chain_id: freshRequest.chain_id,
      amount: BigInt(freshRequest.amount),
      id: freshRequest.id,
    });
    // wait for transaction to reach a certain amount of confirmations
    const txReceipt = await blockchain.waitForTransaction(
      txHash,
      provider,
      ops.confirmations
    );
    log.verbose(
      "Request has been confirmed",
      freshRequest,
      txReceipt.status === 1 ? "SUCCESS" : "FAILED"
    );

    ops.counterSuccessfulFundingNodes.inc();

    // update request to success or failed
    await ops.requestService.updateRequest(freshRequest.id, {
      status: txReceipt.status === 1 ? "SUCCESS" : "FAILED",
      transaction_hash: txHash,
      access_token_hash: freshRequest.access_token_hash,
      node_address: freshRequest.node_address,
      chain_id: freshRequest.chain_id,
      amount: BigInt(freshRequest.amount),
      id: freshRequest.id,
    });
  } catch (e: any) {
    if (freshRequest) {
      // check if request was rejected
      if (e instanceof CustomError) {
        log.verbose("Request was rejected", freshRequest, e.message);
        // update request to rejected and why
        await ops.requestService.updateRequest(freshRequest?.id, {
          status: "REJECTED-DURING-PROCESSING",
          reason: e.message,
          access_token_hash: freshRequest.access_token_hash,
          node_address: freshRequest.node_address,
          chain_id: freshRequest.chain_id,
          amount: BigInt(freshRequest.amount),
          id: freshRequest.id,
        });
      } else {
        log.verbose(
          "Request failed during processing",
          freshRequest,
          e.message
        );

        // update request to failed during processing and save the reason it unexpectedly failed
        await ops.requestService.updateRequest(freshRequest?.id, {
          status: "FAILED-DURING-PROCESSING",
          reason: e.message ?? JSON.stringify(e),
          access_token_hash: freshRequest.access_token_hash,
          node_address: freshRequest.node_address,
          chain_id: freshRequest.chain_id,
          amount: BigInt(freshRequest.amount),
          id: freshRequest.id,
        });
      }
    } else {
      if (e instanceof CustomError) {
        log.error("Could not fulfill pending request", e.message);
      } else {
        log.error("Unexpected error trying to fulfill pending request", e);
      }
    }
  } finally {
    ops.counterFailedFundingNodes.inc();
    ops.changeState(false);
  }
};

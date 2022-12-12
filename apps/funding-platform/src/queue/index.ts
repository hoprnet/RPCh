import { ethers, Signer } from "ethers";
import { utils } from "rpch-common";
import {
  getProvider,
  sendTransaction,
  waitForTransaction,
} from "../blockchain";
import { RequestService } from "../request";

const { log, logError } = utils.createLogger(["funding-platform", "queue"]);

/**
 * Scans through all requests and fulfills the oldest fresh reqeust
 * @param requestService
 * @param signer ethers signer that will send the transaction
 * @param confirmations amount of confirmations to wait for every transaction
 * @param changeState updates a higher lever boolean that stops this function from running
 * while it is already running
 */
export const checkFreshRequests = async (ops: {
  requestService: RequestService;
  signer: Signer;
  confirmations: number;
  changeState: (state: boolean) => void;
}) => {
  ops.changeState(true);
  const freshRequest = await ops.requestService.getOldestFreshRequest();
  log("handling request: ", freshRequest?.requestId);
  try {
    // TODO: add funding checks
    if (!ops.signer) throw new Error("Missing signer  transaction");
    if (!freshRequest) throw new Error("No pending fresh request");
    if (!freshRequest?.chainId) throw new Error("Request is missing chainId");
    // fund request
    const provider = ops.signer.provider
      ? ops.signer.provider
      : await getProvider(freshRequest.chainId);
    let connectedSigner = ops.signer.provider
      ? ops.signer
      : ops.signer.connect(provider);
    const txHash = await sendTransaction({
      from: connectedSigner,
      to: freshRequest?.nodeAddress,
      amount: ethers.utils.parseEther(freshRequest.amount).toString(),
    });
    await ops.requestService.updateRequest(freshRequest.requestId, {
      ...freshRequest,
      transactionHash: txHash,
      status: "PENDING",
    });
    const txReceipt = await waitForTransaction(
      txHash,
      provider,
      ops.confirmations
    );
    // update db
    await ops.requestService.updateRequest(freshRequest.requestId, {
      ...freshRequest,
      transactionHash: txHash,
      status: txReceipt.status === 1 ? "SUCCESS" : "FAILED",
    });
  } catch (e: any) {
    logError(e);
    if (freshRequest) {
      await ops.requestService.updateRequest(freshRequest?.requestId, {
        ...freshRequest,
        status: "FAILED",
        reason: e.message ?? JSON.stringify(e),
      });
    }
  } finally {
    ops.changeState(false);
  }
};

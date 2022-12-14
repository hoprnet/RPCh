import { BigNumber, ethers, Signer } from "ethers";
import { utils } from "rpch-common";
import {
  getProvider,
  sendTransaction,
  waitForTransaction,
} from "../blockchain";
import { RequestService } from "../request";
import { CustomError, validConnectionInfo } from "../utils";

const { log, logError } = utils.createLogger(["funding-platform", "queue"]);

/**
 * Scans through all requests and fulfills the oldest fresh request
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
    // check if request and signer is valid
    if (!ops.signer) throw new CustomError("Missing signer  transaction");
    if (!freshRequest) throw new CustomError("No pending fresh request");
    if (!freshRequest?.chainId)
      throw new CustomError("Request is missing chainId");
    const provider = ops.signer.provider
      ? ops.signer.provider
      : await getProvider(validConnectionInfo, freshRequest.chainId);
    let connectedSigner = ops.signer.provider
      ? ops.signer
      : ops.signer.connect(provider);
    const balance = await connectedSigner.getBalance();
    // check if signer has enough to fund request
    if (balance < BigNumber.from(freshRequest.amount))
      throw new CustomError(
        "Signer does not have enough balance to fund request"
      );
    // sent transaction to fund request
    const txHash = await sendTransaction({
      from: connectedSigner,
      to: freshRequest?.nodeAddress,
      amount: ethers.utils.parseEther(freshRequest.amount).toString(),
    });
    // set request status to pending while it is confirmed or rejected
    await ops.requestService.updateRequest(freshRequest.requestId, {
      ...freshRequest,
      transactionHash: txHash,
      status: "PENDING",
    });
    // wait for transaction to reach a certain amount of confirmations
    const txReceipt = await waitForTransaction(
      txHash,
      provider,
      ops.confirmations
    );
    // update request to success or failed and add the transaction hash to the request
    await ops.requestService.updateRequest(freshRequest.requestId, {
      ...freshRequest,
      transactionHash: txHash,
      status: txReceipt.status === 1 ? "SUCCESS" : "FAILED",
    });
  } catch (e: any) {
    logError(e);
    if (freshRequest) {
      // check if request was not accepted or if it failed unexpectedly
      if (e instanceof CustomError) {
        // update request to not accepted and why it was not accepted
        await ops.requestService.updateRequest(freshRequest?.requestId, {
          ...freshRequest,
          status: "REJECTED-DURING-PROCESSING",
          reason: e.message,
        });
      } else {
        // update request to failed and save the reason it unexpected failed
        await ops.requestService.updateRequest(freshRequest?.requestId, {
          ...freshRequest,
          status: "FAILED-DURING-PROCESSING",
          reason: e.message ?? JSON.stringify(e),
        });
      }
    }
  } finally {
    ops.changeState(false);
  }
};

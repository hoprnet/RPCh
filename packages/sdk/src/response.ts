export function messageToBody(msg: string, request: Request, counter: BigInt, crypto): { success: true, body: string, counter: BigInt} | success: false, error: string} {
    try {
    this.crypto.unbox_response(
      request.session,
      new crypto.Envelope(
        utils.arrayify(msg),
        request.entryNodeId,
        request.exitNodeId
      ),
      counter
    );
    } catch (err) {
        return {success: false, error: err };
    }

    const decrypted = utils.toUtf8String(request.session.get_response_data());
  const parts = decrypted.split("|");
  if (parts.length === 0) {
    return { success: false, error: "empty response body" };
  }

  const count = parseInt(parts[0], 10);
  if (count !== 2) {
    return { success: false, error: `invalid response parts: ${count}` };
  }

  const type = parts[1]
  if (type !== "response") {
      return {success: false, error: `wrong response type ${type}`}
  }
  const compressedDecrypted = parts[2];
const decompressedDecrypted = Compression.decompressRpcRequest( compressedDecrypted);
 const newCount = request.session.updated_count();
  return {
    success: true,
    body: decompressedDecrypted,
    counter: newCount
  };

}

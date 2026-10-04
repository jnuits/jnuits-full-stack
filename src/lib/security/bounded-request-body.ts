import "server-only";

export class RequestBodyTooLargeError extends Error {
  constructor() { super("Request body exceeds the allowed byte limit."); }
}

/** Read bounded bytes before decoding so chunking and UTF-8 cannot bypass the cap. */
export async function readBoundedRequestText(request: Request, maxBytes: number): Promise<string> {
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    await request.body?.cancel().catch(() => undefined);
    throw new RequestBodyTooLargeError();
  }
  if (request.signal.aborted) {
    await request.body?.cancel().catch(() => undefined);
    throw new Error("Request aborted.");
  }
  if (!request.body) return "";
  const reader = request.body.getReader();
  const abort = () => { void reader.cancel().catch(() => undefined); };
  request.signal.addEventListener("abort", abort, { once: true });
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      if (request.signal.aborted) throw new Error("Request aborted.");
      const { value, done } = await reader.read();
      if (request.signal.aborted) throw new Error("Request aborted.");
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } finally {
    request.signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

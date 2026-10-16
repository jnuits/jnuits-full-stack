/** Finish a failed disposable upstream without replacing an emitted response. */
export function finishLocalProxyError(response) {
  if (response.destroyed || response.writableEnded) return;
  if (response.headersSent) response.destroy();
  else response.writeHead(502).end();
}

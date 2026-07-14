export function shouldCommitRequest(requestId: number, latestRequestId: number, signal: AbortSignal): boolean {
  return requestId === latestRequestId && !signal.aborted;
}

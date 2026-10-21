const ONE_HOUR_MS = 60 * 60 * 1000;

type Entry = { atMs: number };

class RequestsCounter {
  private entries: Entry[] = [];

  add(atMs = Date.now()) {
    this.entries.push({ atMs });
    this.prune(atMs);
  }

  countLastHour(nowMs = Date.now()) {
    this.prune(nowMs);
    return this.entries.length;
  }

  private prune(nowMs: number) {
    const cutoff = nowMs - ONE_HOUR_MS;
    while (this.entries.length > 0 && this.entries[0]!.atMs < cutoff) {
      this.entries.shift();
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __crTrackerRequestsCounter: RequestsCounter | undefined;
}

export const requestsCounter =
  globalThis.__crTrackerRequestsCounter ?? new RequestsCounter();

globalThis.__crTrackerRequestsCounter = requestsCounter;


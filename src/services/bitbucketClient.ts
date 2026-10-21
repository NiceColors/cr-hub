import { createBitbucketClient } from "@/lib/bitbucket/client";

declare global {
  // eslint-disable-next-line no-var
  var __crTrackerBitbucketClient:
    | ReturnType<typeof createBitbucketClient>
    | undefined;
}

export const bitbucketClient =
  globalThis.__crTrackerBitbucketClient ?? createBitbucketClient();

globalThis.__crTrackerBitbucketClient = bitbucketClient;


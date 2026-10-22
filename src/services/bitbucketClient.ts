import { createBitbucketClient } from "@/lib/bitbucket/client";
import { recordTokenHttpStatus } from "@/lib/tokenStatus";
import { ensureStoredCredentialsLoaded } from "@/services/storedCredentials";

ensureStoredCredentialsLoaded();

export const bitbucketClient = createBitbucketClient({
  onResponse: (status) => recordTokenHttpStatus(status),
});

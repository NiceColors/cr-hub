import { createBitbucketClient } from "@/lib/bitbucket/client";
import { recordTokenHttpStatus } from "@/lib/tokenStatus";

export const bitbucketClient = createBitbucketClient({
  onResponse: (status) => recordTokenHttpStatus(status),
});

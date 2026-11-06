import { afterEach, vi } from "vitest";
import { clearBitbucketRateLimit } from "@/lib/bitbucket/rateLimit";

afterEach(() => {
  clearBitbucketRateLimit();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});


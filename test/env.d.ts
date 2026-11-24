import type { Env as WorkerEnv } from "../worker/env";

declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {
      TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
    }
  }
}

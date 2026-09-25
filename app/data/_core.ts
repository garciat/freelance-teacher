console.log(`DENO_KV_PATH=${Deno.env.get("DENO_KV_PATH")}`);

export const kv = await Deno.openKv(Deno.env.get("DENO_KV_PATH"));

const COMMIT_RETRIES = 3;

export async function tryCommit(op: Deno.AtomicOperation) {
  for (let i = 0; i < COMMIT_RETRIES; ++i) {
    const result = await op.commit();

    if (result.ok) {
      return { versionstamp: result.versionstamp };
    }
  }

  throw new Error("kv: tryCommit: retries exhausted");
}

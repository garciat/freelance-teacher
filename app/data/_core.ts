console.log(`DENO_KV_PATH=${Deno.env.get("DENO_KV_PATH")}`);

export const kv = await Deno.openKv(Deno.env.get("DENO_KV_PATH"));

import type { RequestHandler } from "../../../queue/$types";
import fs from "node:fs/promises";
import { env } from "$env/dynamic/private";
import path from "node:path";
import { json } from "@sveltejs/kit";

export const DELETE: RequestHandler = async ({ params, request }) => {

  let pwd = request.headers.get("QUEUE-AUTH");
  if (pwd !== env.ADMIN_PASSWORD) return json({ status: "fail" });

  for (const f of await fs.readdir(env.COVER_DIR)) {
    if (f == "." || f == "..") continue;
    fs.rm(path.join(env.COVER_DIR, f), { recursive: true, maxRetries: 5 });
  }

  return json({ status: "ok" });
}

import type { RequestHandler } from "../../../queue/$types";
import { env } from "$env/dynamic/private";
import fs from "node:fs/promises";
import path from "node:path";
import { json } from "@sveltejs/kit";

interface CoverEntry {
  name: string;
  data: string; // base64-encoded image bytes
}

export const POST: RequestHandler = async ({ request }) => {
  const { covers } = (await request.json()) as { covers: CoverEntry[] };
  let pwd = request.headers.get("QUEUE-AUTH");
  if (pwd !== env.ADMIN_PASSWORD) return json({ status: "fail" });

  await Promise.all(
    covers.map(({ name, data }) => {
      const p = path.join(env.COVER_DIR, name);
      const buffer = Buffer.from(data, "base64");
      return fs.writeFile(p, buffer);
    }),
  );

  return json({ status: "ok" });
};

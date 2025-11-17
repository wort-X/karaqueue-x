import type { RequestHandler } from "../../../queue/$types";
import { env } from "$env/dynamic/private";
import fs from "node:fs/promises";
import path from "node:path";

export const GET: RequestHandler = async ({ params }) => {
  let file;

  try {
    file = await fs.readFile(path.join(env.COVER_DIR, params.url));
  } catch {
    if (env.DEFAULT_COVER) {
      file = await fs.readFile(env.DEFAULT_COVER);
    }
  }

  return new Response(file);
};

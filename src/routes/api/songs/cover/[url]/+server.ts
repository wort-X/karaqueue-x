import type { RequestHandler } from "../../../queue/$types";
import cover from "$lib/assets/cover.jpg";
import { read } from "$app/server";

export const GET: RequestHandler = async ({ url, params }) => {
  console.log(`Getting cover image ${params.url}`);

  return read(cover);
};

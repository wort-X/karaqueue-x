import { env } from "$env/dynamic/private";
import { getSongs, writeSongs, type TSongs } from "$lib/server/data.svelte";
import { json, type Actions, type RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ url }) => {
  let filter = url.searchParams.get("filter");
  let page_index = Number.parseInt(url.searchParams.get("page_index") ?? "0");
  let page_size = Number.parseInt(url.searchParams.get("page_size") ?? "20");
  // let conf = await request.json();
  return json(
    await getSongs({
      filter: filter,
      page_index: page_index ?? 0,
      page_size: page_size ?? 0,
    }),
  );
};

export const POST: RequestHandler = async ({ request }) => {
  let pwd = request.headers.get("QUEUE-AUTH");
  if (pwd !== env.ADMIN_PASSWORD) return json({ status: "fail" });
  let songs: TSongs = await request.json();
  await writeSongs(songs);
  return json({ status: "ok" });
}

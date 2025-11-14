import { getSongs } from "$lib/server/data.svelte";
import { json, type Actions, type RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ url }) => {
  let filter = url.searchParams.get("filter");
  let page_index = Number.parseInt(url.searchParams.get("page_index") ?? "0");
  let page_size = Number.parseInt(url.searchParams.get("page_size") ?? "20");
  // let conf = await request.json();
  return json(
    getSongs({
      filter: filter,
      page_index: page_index ?? 0,
      page_size: page_size ?? 0,
    }),
  );
};

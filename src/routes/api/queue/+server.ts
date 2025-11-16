import {
  clearQueue,
  dequeueNext,
  enqueue,
  getQueue,
  type TSong,
} from "$lib/server/data.svelte";
import { json, type RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ url }) => {
  return json(getQueue());
};

export const DELETE: RequestHandler = async ({ url, request }) => {
  let b = await request.text();

  if (b === "clear") {
    clearQueue();
  } else {
    dequeueNext();
  }

  return json(getQueue());
};

export const POST: RequestHandler = async ({ url, request }) => {
  let r: { song: TSong; requestor: string } = await request.json();
  enqueue(r);
  return json(getQueue());
};

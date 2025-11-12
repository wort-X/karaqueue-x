import { query } from "$app/server";
import rawSongs from "$lib/assets/songs.json";
import * as z from "zod";

export type TSong = {
  title: string;
  artist: string;
  duration: number;
  tags: any[];
  cover_image: string;
  bpm: number;
  gap: number;
};

export type TSongs = TSong[];

const songs: TSongs = rawSongs as TSongs;

export const getSongs = (config: {
  filter: string | null;
  page_index: number;
  page_size: number;
}) => {
  let filter = make_filter(config.filter);

  let filtered = songs.filter((s) => filter(s.title, s.artist));
  console.log(filtered);

  return {
    songs: filtered.slice(
      config.page_index * config.page_size,
      (config.page_index + 1) * config.page_size,
    ),
    pages: Math.ceil(filtered.length / config.page_size),
  };
};

const make_filter = (filter: string | null) => {
  if (filter == null) {
    return () => true;
  }

  let filters = filter
    .toLowerCase()
    .split(" ")
    .filter((f) => f.trim().length > 0)
    .map((f) => f.trim());
  console.log(filters);
  return (title: string, artist: string) => {
    let t = title.toLowerCase();
    let a = artist.toString().toLowerCase();
    for (var f of filters) {
      if (!(t.includes(f) || a.includes(f))) {
        return false;
      }
    }

    return true;
  };
};

export type SongQueue = {
  song: TSong;
  requestor: string;
}[];

const queue: SongQueue = $state([]);

export const getQueue = () => {
  return queue;
};

export const enqueue = (r: { song: TSong; requestor: string }) => {
  queue.push(r);
};

export const dequeueNext = () => {
  queue.shift();
};

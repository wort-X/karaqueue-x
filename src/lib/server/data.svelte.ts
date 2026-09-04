import { env } from "$env/dynamic/private";
import fs from "node:fs/promises";

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

let songData: TSongs | undefined;

const songs = async () => {
  if (songData === undefined) {
    let songsRaw = await fs.readFile(env.SONG_FILE!, "utf-8");
    songData = JSON.parse(songsRaw);
  }
  return songData!;
};

export const getSongs = async (config: {
  filter: string | null;
  page_index: number;
  page_size: number;
}) => {
  let filter = make_filter(config.filter);

  let filtered = (await songs()).filter((s) => filter(s.title, s.artist));

  return {
    songs: filtered.slice(
      config.page_index * config.page_size,
      (config.page_index + 1) * config.page_size,
    ),
    pages: Math.ceil(filtered.length / config.page_size),
  };
};

export const writeSongs = async (songs: TSongs) => {
  await fs.writeFile(env.SONG_FILE, JSON.stringify(songs));
  songData = undefined;
}

const make_filter = (filter: string | null) => {
  if (filter == null) {
    return () => true;
  }

  let filters = filter
    .toLowerCase()
    .split(" ")
    .filter((f) => f.trim().length > 0)
    .map((f) => f.trim());
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

export type SongRequest = {
  song: TSong;
  requestor: string;
}

export type SongQueue = {
  song_requests: SongRequest[];
  // instant as epoch time
  song_start: number;
}

let queue: SongQueue = $state({song_requests: [], song_start: new Date().getTime()});

export const getQueue = () => {
  return queue;
};

export const enqueue = (r: { song: TSong; requestor: string }) => {
  queue.song_requests.push(r);
  // Assume, we are starting now, if the first song is queued.
  if (!queue.song_requests) {
    queue.song_start = new Date().getTime();
  }
};

export const dequeueNext = () => {
  queue.song_requests.shift();
  queue.song_start = new Date().getTime();
};

export const clearQueue = () => {
  queue.song_requests = [];
  queue.song_start = new Date().getTime();
};

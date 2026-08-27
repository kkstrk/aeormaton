import { fetchFeed as defaultFetchFeed } from "./fetchFeed.js";

import type { BotClient, FeedItem, FeedSource } from "../types/index.js";

type FetchFeed = (url: string) => Promise<FeedItem[]>;

export const createPoller = (
    bot: BotClient,
    sources: FeedSource[],
    fetchFeed: FetchFeed = defaultFetchFeed,
) => {
    // per-source cursor of the newest item we've already posted, so a poll
    // only acts on items published after it
    const lastPublishedAt = new Map<string, Date>();

    const pollSource = async (source: FeedSource) => {
        const items = await fetchFeed(source.url);
        const lastSeen = lastPublishedAt.get(source.name);

        if (!lastSeen) {
            // first poll for this source: just establish a baseline instead
            // of posting everything currently in the feed
            const timestamps = items.map((item) => item.publishedAt.getTime());
            if (timestamps.length > 0) {
                lastPublishedAt.set(source.name, new Date(Math.max(...timestamps)));
            }
            return;
        }

        const newItems = items
            .filter((item) => item.publishedAt > lastSeen)
            .toSorted((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
        if (newItems.length === 0) {
            return;
        }

        console.log(`Found ${newItems.length} new item(s) for "${source.name}".`);
        const posts = await source.parser(newItems);
        for (const post of posts) {
            if (Array.isArray(post)) {
                await bot.postThread(post);
            } else {
                await bot.post(post);
            }
        }

        lastPublishedAt.set(source.name, newItems.at(-1)?.publishedAt ?? lastSeen);
    };

    const pollOnce = async () => {
        for (const source of sources) {
            try {
                await pollSource(source);
            } catch (error) {
                console.error(`Could not poll feed "${source.name}".`, error);
            }
        }
    };

    const start = (intervalMs: number) => {
        void pollOnce();
        const interval = setInterval(() => void pollOnce(), intervalMs);
        return () => clearInterval(interval);
    };

    return { pollOnce, start };
};

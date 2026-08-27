import { fetchFeed as defaultFetchFeed } from "./fetchFeed.js";

import type { BotClient, FeedItem, FeedSource } from "../types/index.js";

type FetchFeed = (url: string) => Promise<FeedItem[]>;

interface PollerOptions {
    fetchFeed?: FetchFeed;
    minIntervalMs?: number;
    maxIntervalMs?: number;
    backoffMultiplier?: number;
}

export const createPoller = (
    bot: BotClient,
    sources: FeedSource[],
    options: PollerOptions = {},
) => {
    const {
        backoffMultiplier = 1.5,
        fetchFeed = defaultFetchFeed,
        maxIntervalMs = 2 * 60 * 60 * 1000,
        minIntervalMs = 5 * 60 * 1000,
    } = options;

    // per-source cursor of the newest item we've already posted, so a poll
    // only acts on items published after it
    const lastPublishedAt = new Map<string, Date>();
    // per-source adaptive interval: grows (up to maxIntervalMs) each time a
    // poll finds nothing new or fails, and resets to minIntervalMs as soon
    // as a new item shows up
    const intervalMs = new Map<string, number>();
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const pollSource = async (source: FeedSource): Promise<boolean> => {
        const items = await fetchFeed(source.url);
        const lastSeen = lastPublishedAt.get(source.name);

        if (!lastSeen) {
            // first poll for this source: just establish a baseline instead
            // of posting everything currently in the feed
            const timestamps = items.map((item) => item.publishedAt.getTime());
            if (timestamps.length > 0) {
                lastPublishedAt.set(source.name, new Date(Math.max(...timestamps)));
            }
            return false;
        }

        const newItems = items
            .filter((item) => item.publishedAt > lastSeen)
            .toSorted((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
        if (newItems.length === 0) {
            return false;
        }

        console.log(`Found ${newItems.length} new item(s) for "${source.name}".`);
        const posts = await source.parser(newItems);

        // advance the cursor before posting: if a post throws after the
        // write actually reached Bluesky (a lost response, not a genuine
        // failure), the next poll would otherwise see these items as new
        // again and post them a second time
        lastPublishedAt.set(source.name, newItems.at(-1)?.publishedAt ?? lastSeen);

        for (const post of posts) {
            if (Array.isArray(post)) {
                await bot.postThread(post);
            } else {
                await bot.post(post);
            }
        }

        return true;
    };

    const pollSourceAndAdapt = async (source: FeedSource) => {
        let foundNew = false;
        try {
            foundNew = await pollSource(source);
        } catch (error) {
            console.error(`Could not poll feed "${source.name}".`, error);
        }

        const previous = intervalMs.get(source.name) ?? minIntervalMs;
        intervalMs.set(
            source.name,
            foundNew ? minIntervalMs : Math.min(previous * backoffMultiplier, maxIntervalMs),
        );
    };

    const pollOnce = async () => {
        for (const source of sources) {
            await pollSourceAndAdapt(source);
        }
    };

    const runSource = async (source: FeedSource) => {
        await pollSourceAndAdapt(source);
        const timer = setTimeout(
            () => void runSource(source),
            intervalMs.get(source.name) ?? minIntervalMs,
        );
        timers.set(source.name, timer);
    };

    const start = () => {
        for (const source of sources) {
            void runSource(source);
        }
        return () => {
            for (const timer of timers.values()) {
                clearTimeout(timer);
            }
            timers.clear();
        };
    };

    const getIntervalMs = (sourceName: string) => intervalMs.get(sourceName) ?? minIntervalMs;

    return { getIntervalMs, pollOnce, start };
};

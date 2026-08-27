import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { createPoller } from "./poller.js";

import type { PostPayload } from "@skyware/bot";
import type { BotClient, FeedItem, FeedSource } from "../types/index.js";

const item = (title: string, publishedAt: Date): FeedItem => ({
    publishedAt,
    title,
    url: `https://example.com/${title}`,
});

const createStubBot = () => {
    const post = mock.fn(async (_post: PostPayload) => {});
    const postThread = mock.fn(async (_posts: PostPayload[]) => {});
    const bot: BotClient = { post, postThread, session: Promise.resolve() };
    return { bot, post, postThread };
};

const parser = (items: FeedItem[]) => items.map((feedItem) => ({ text: feedItem.title }));

describe("createPoller", () => {
    it("does not post anything on the first poll (establishes a baseline)", async () => {
        const { bot, post } = createStubBot();
        const fetchFeed = mock.fn(() => Promise.resolve([item("first", new Date("2026-01-01"))]));
        const source: FeedSource = { name: "blog", parser, url: "https://example.com/feed" };

        await createPoller(bot, [source], fetchFeed).pollOnce();

        assert.equal(post.mock.callCount(), 0);
    });

    it("posts only items published after the baseline on later polls", async () => {
        const { bot, post } = createStubBot();
        const older = item("older", new Date("2026-01-01"));
        const newer = item("newer", new Date("2026-01-02"));
        let items = [older];
        const fetchFeed = mock.fn(() => Promise.resolve(items));
        const source: FeedSource = { name: "blog", parser, url: "https://example.com/feed" };
        const poller = createPoller(bot, [source], fetchFeed);

        await poller.pollOnce();
        items = [older, newer];
        await poller.pollOnce();

        assert.equal(post.mock.callCount(), 1);
        assert.deepEqual(post.mock.calls[0]?.arguments[0], { text: "newer" });
    });

    it("does not re-post the same item on a later poll with no changes", async () => {
        const { bot, post } = createStubBot();
        const single = item("only", new Date("2026-01-01"));
        const fetchFeed = mock.fn(() => Promise.resolve([single]));
        const source: FeedSource = { name: "blog", parser, url: "https://example.com/feed" };
        const poller = createPoller(bot, [source], fetchFeed);

        await poller.pollOnce();
        await poller.pollOnce();
        await poller.pollOnce();

        assert.equal(post.mock.callCount(), 0);
    });

    it("keeps polling other sources when one source fails", async () => {
        const { bot, post } = createStubBot();
        const failingFetch = mock.fn(() => Promise.reject(new Error("network error")));
        const workingFetch = mock.fn(() => Promise.resolve([item("ok", new Date("2026-01-01"))]));
        const sources: FeedSource[] = [
            { name: "broken", parser, url: "https://example.com/broken" },
            { name: "working", parser, url: "https://example.com/working" },
        ];
        const fetchFeed = mock.fn((url: string) =>
            url.includes("broken") ? failingFetch() : workingFetch(),
        );

        await createPoller(bot, sources, fetchFeed).pollOnce();

        assert.equal(workingFetch.mock.callCount(), 1);
        assert.equal(post.mock.callCount(), 0);
    });
});

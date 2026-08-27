import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { setTimeout } from "node:timers/promises";

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

        await createPoller(bot, [source], { fetchFeed }).pollOnce();

        assert.equal(post.mock.callCount(), 0);
    });

    it("posts only items published after the baseline on later polls", async () => {
        const { bot, post } = createStubBot();
        const older = item("older", new Date("2026-01-01"));
        const newer = item("newer", new Date("2026-01-02"));
        let items = [older];
        const fetchFeed = mock.fn(() => Promise.resolve(items));
        const source: FeedSource = { name: "blog", parser, url: "https://example.com/feed" };
        const poller = createPoller(bot, [source], { fetchFeed });

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
        const poller = createPoller(bot, [source], { fetchFeed });

        await poller.pollOnce();
        await poller.pollOnce();
        await poller.pollOnce();

        assert.equal(post.mock.callCount(), 0);
    });

    it("does not retry an item on the next poll if posting it throws (e.g. a lost response after a successful write)", async () => {
        const { bot, post } = createStubBot();
        const older = item("older", new Date("2026-01-01"));
        const newer = item("newer", new Date("2026-01-02"));
        let items = [older];
        const fetchFeed = mock.fn(() => Promise.resolve(items));
        const source: FeedSource = { name: "blog", parser, url: "https://example.com/feed" };
        const poller = createPoller(bot, [source], { fetchFeed });

        // baseline = older
        await poller.pollOnce();

        items = [older, newer];
        post.mock.mockImplementationOnce(() => {
            throw new Error("upstream timeout, but the write may have gone through");
        });
        // detects "newer", attempts to post, throws
        await poller.pollOnce();

        // should not retry "newer"
        await poller.pollOnce();

        assert.equal(post.mock.callCount(), 1);
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

        await createPoller(bot, sources, { fetchFeed }).pollOnce();

        assert.equal(workingFetch.mock.callCount(), 1);
        assert.equal(post.mock.callCount(), 0);
    });
});

describe("createPoller adaptive interval", () => {
    it("backs off the interval on each poll that finds nothing new, up to the max", async () => {
        const { bot } = createStubBot();
        const fetchFeed = mock.fn(() => Promise.resolve([item("only", new Date("2026-01-01"))]));
        const source: FeedSource = { name: "blog", parser, url: "https://example.com/feed" };
        const poller = createPoller(bot, [source], {
            backoffMultiplier: 2,
            fetchFeed,
            maxIntervalMs: 100,
            minIntervalMs: 10,
        });

        // baseline poll counts as "nothing new" too: 10 -> 20
        await poller.pollOnce();
        assert.equal(poller.getIntervalMs("blog"), 20);
        // nothing new: 20 -> 40
        await poller.pollOnce();
        assert.equal(poller.getIntervalMs("blog"), 40);
        // nothing new: 40 -> 80
        await poller.pollOnce();
        assert.equal(poller.getIntervalMs("blog"), 80);
        // nothing new: 80 -> 160, clamped to 100
        await poller.pollOnce();
        assert.equal(poller.getIntervalMs("blog"), 100);
        // stays clamped at the max
        await poller.pollOnce();
        assert.equal(poller.getIntervalMs("blog"), 100);
    });

    it("resets the interval to the minimum as soon as a new item shows up", async () => {
        const { bot } = createStubBot();
        const older = item("older", new Date("2026-01-01"));
        const newer = item("newer", new Date("2026-01-02"));
        let items = [older];
        const fetchFeed = mock.fn(() => Promise.resolve(items));
        const source: FeedSource = { name: "blog", parser, url: "https://example.com/feed" };
        const poller = createPoller(bot, [source], {
            backoffMultiplier: 2,
            fetchFeed,
            maxIntervalMs: 1000,
            minIntervalMs: 10,
        });

        await poller.pollOnce();
        await poller.pollOnce();
        await poller.pollOnce();
        assert.equal(poller.getIntervalMs("blog"), 80);

        items = [older, newer];
        await poller.pollOnce();

        assert.equal(poller.getIntervalMs("blog"), 10);
    });

    it("backs off after a failed poll too, so a broken source isn't hammered", async () => {
        const { bot } = createStubBot();
        const fetchFeed = mock.fn(() => Promise.reject(new Error("network error")));
        const source: FeedSource = { name: "broken", parser, url: "https://example.com/broken" };
        const poller = createPoller(bot, [source], {
            backoffMultiplier: 2,
            fetchFeed,
            maxIntervalMs: 1000,
            minIntervalMs: 10,
        });

        await poller.pollOnce();
        assert.equal(poller.getIntervalMs("broken"), 20);
        await poller.pollOnce();
        assert.equal(poller.getIntervalMs("broken"), 40);
    });

    it("start() reschedules each source with its own adaptive interval", async () => {
        const { bot } = createStubBot();
        const fetchFeed = mock.fn(() => Promise.resolve([item("only", new Date("2026-01-01"))]));
        const source: FeedSource = { name: "blog", parser, url: "https://example.com/feed" };
        const poller = createPoller(bot, [source], { fetchFeed, minIntervalMs: 10 });

        const stop = poller.start();
        await setTimeout(50);
        stop();

        assert.ok(fetchFeed.mock.callCount() >= 2);
    });
});

import { Bot } from "@skyware/bot";

import { requiredEnv } from "../utils/useEnv.js";
import { retry } from "../utils/retry.js";
import { login } from "./login.js";
import { handleCommands } from "./commands.js";
import BotPosts from "./posts.js";

import type { PostPayload } from "@skyware/bot";

const bot = new Bot();
const session = login(bot);

const botPosts = new BotPosts();

await session;
console.log("Has session:", bot.hasSession);

try {
    const { posts } = await retry(() =>
        bot.getUserPosts(requiredEnv("BSKY_DID"), { filter: "posts_and_author_threads" }),
    );
    posts.forEach((post) => botPosts.add(post));
    console.log("Successfully fetched posts.");
} catch (error) {
    console.error("Could not fetch bot posts.", error);
}

// listen to events
bot.on("reply", handleCommands);
bot.on("mention", handleCommands);

bot.on("error", (error) => {
    console.error("Bot encountered an error.", error);
});

const botClient = {
    session,
    post: async (post: PostPayload) => {
        if (botPosts.has(post)) {
            console.log(`Skipping post ${JSON.stringify(post)} because it is a duplicate.`);
        } else {
            await session;
            // mark as posted before attempting the call: if bot.post()
            // throws after the write actually reached Bluesky (a lost
            // response, not a genuine failure -- this account has seen
            // plenty of those), we'd otherwise retry and post it twice
            botPosts.add(post);
            console.log(`Posting ${JSON.stringify(post)}.`);
            await bot.post(post);
            console.log("Successfully posted to Bluesky.");
        }
    },
    postThread: async (posts: PostPayload[]) => {
        const [post, ...replies] = posts;
        if (!post) {
            return;
        }
        if (botPosts.has(post)) {
            console.log(`Skipping thread ${JSON.stringify(post)} because it is a duplicate.`);
        } else {
            await session;
            botPosts.add(post);
            console.log(`Posting thread with ${replies.length} replies.`);
            const { uri, cid } = await bot.post(post);
            console.log("Successfully posted first post to Bluesky.");

            const root = { uri, cid };
            const parent = { uri, cid };
            for (const reply of replies) {
                const replyRef = await bot.post({ ...reply, replyRef: { parent, root } });
                parent.uri = replyRef.uri;
                parent.cid = replyRef.cid;
                console.log(`Successfully posted reply ${JSON.stringify(reply)} to Bluesky.`);
            }
        }
    },
};

export default botClient;

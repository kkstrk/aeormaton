import { Bot, type PostPayload } from '@skyware/bot';

import { useEnv } from '../utils/useEnv';
import { login } from './login';
import { handleCommands } from './commands';
import BotPosts from './posts';

useEnv();

const bot = new Bot();
const session = login(bot);

const botPosts = new BotPosts();

(async () => {
    // login to bsky
    await session;
    console.log('Has session: ', bot.hasSession);

    // fetch posts
    try {
        const { posts } = await bot.getUserPosts(
            process.env.BSKY_DID,
            { filter: 'posts_and_author_threads' }
        );
        posts.forEach((post) => botPosts.add(post));
        console.log('Successfully fetched posts.');
    } catch (error) {
        console.error('Could not fetch bot posts.', error);
    }
})();

// listen to events
bot.on('reply', handleCommands);
bot.on('mention', handleCommands);

export default {
    session,
    post: async (post: PostPayload) => {
        if (botPosts.has(post)) {
            console.log(`Skipping post ${JSON.stringify(post)} because it is a duplicate.`);
        } else {
            await session;
            console.log(`Posting ${JSON.stringify(post)}.`);
            await bot.post(post);
            botPosts.add(post);
            console.log('Successfully posted to Bluesky.');
        }
    },
    postThread: async (posts: PostPayload[]) => {
        const [post, ...replies] = posts;
        if (botPosts.has(post)) {
            console.log(`Skipping thread ${JSON.stringify(post)} because it is a duplicate.`);
        } else {
            await session;
            console.log(`Posting thread with ${replies.length} replies.`);
            const { uri, cid } = await bot.post(post);
            botPosts.add(post);
            console.log('Successfully posted first post to Bluesky.');

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

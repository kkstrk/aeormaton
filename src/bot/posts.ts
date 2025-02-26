import type { Post, PostPayload } from '@skyware/bot';

class BotPosts {
    #posts: string[] = [];

    add = (post: Post | PostPayload) => {
        this.#posts.push(post.text);
        if (this.#posts.length > 100) {
            this.#posts.shift();
        }
    }

    has = (post: PostPayload) => (
        this.#posts.includes(post.text)
    );
}

export default BotPosts;

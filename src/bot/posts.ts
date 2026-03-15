import type { Post, PostPayload } from "@skyware/bot";

class BotPosts {
    #posts: string[] = [];

    add = (post: Post | PostPayload) => {
        if (!post.text) {
            return;
        }
        this.#posts.push(String(post.text));
        if (this.#posts.length > 100) {
            this.#posts.shift();
        }
    };

    has = (post: PostPayload) => {
        if (!post.text) {
            return false;
        }
        return this.#posts.includes(String(post.text));
    };
}

export default BotPosts;

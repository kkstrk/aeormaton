import type { PostPayload } from "@skyware/bot";

export interface SuperfeedrItem {
    title: string;
    permalinkUrl: string;
    published: number;
    summary: string;
}

export interface FeedItem {
    title: string;
    url: string;
    publishedAt: Date;
}

export interface FeedSource {
    name: string;
    url: string;
    parser: (
        items: FeedItem[],
    ) => (PostPayload | PostPayload[])[] | Promise<(PostPayload | PostPayload[])[]>;
}

export interface BotClient {
    session: unknown;
    post: (post: PostPayload) => Promise<unknown>;
    postThread: (posts: PostPayload[]) => Promise<unknown>;
}

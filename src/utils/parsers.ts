import { convert } from "html-to-text";

import { crMembers, newsBlacklist, newsSources } from "../constants/index.js";
import { getDifference } from "./dates.js";
import decodeGoogleNewsUrl from "./decodeGoogleNewsUrl.js";

import type { PostPayload } from "@skyware/bot";
import type { FeedItem, SuperfeedrItem } from "../types/index.js";

const newsSourcesRegex = new RegExp(
    `(${Object.keys(newsSources)
        .map((handle) => handle.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
        .join("|")})$`,
    "u",
);

// /(?:@Marisha Ray641|@Marisha_Ray|...)(?!\.\w)|(?:Marisha Ray|...)/gmiu
const crMembersRegex = new RegExp(
    `(?:${crMembers
        .flatMap(({ tiktok, twitter }) =>
            [tiktok, twitter]
                .filter(Boolean)
                .map((str) => str?.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&")),
        )
        .join("|")})(?!\\.\\w)|(?:${crMembers
        .map(({ name }) => name.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
        .join("|")})`,
    "gmiu",
);
const parseMembers = (
    text: string,
    replace = ({ name, bsky = name }: { name: string; bsky?: string }): string => bsky,
) => {
    const replacedMembers = new Set<string>();
    return text.replace(crMembersRegex, (match) => {
        const matchValue = match.toLowerCase();
        const member = crMembers.find(
            ({ name, tiktok, twitter }) =>
                matchValue === name.toLowerCase() ||
                matchValue === tiktok?.toLowerCase() ||
                matchValue === twitter?.toLowerCase(),
        );
        if (!member) {
            return match;
        }
        const key = member.bsky ?? member.name;
        if (!replacedMembers.has(key)) {
            replacedMembers.add(key);
            return replace(member);
        }
        return member.name;
    });
};

const isRecentlyPublished = (publishedAt: Date) => getDifference(publishedAt) >= -48;

const limit = 300;
const parseText = (text: string) => {
    const trimmedText = text.trim();
    if (trimmedText.length <= limit) {
        return trimmedText;
    }
    const words = trimmedText.split(" ");
    while (words.join(" ").length + 3 > limit) {
        words.pop();
    }
    return `${words.join(" ")}...`;
};

const splitText = (text: string): string[] => {
    const trimmedText = text.trim();
    if (trimmedText.length <= limit) {
        return [trimmedText];
    }
    const words = trimmedText.split(" ");
    return words.reduce(
        (parts, word) => {
            const part = parts.at(-1);
            const extendedPart = part ? `${part} ${word}` : word;
            if (extendedPart.length <= limit) {
                parts[parts.length - 1] = extendedPart;
            } else {
                parts.push(word);
            }
            return parts;
        },
        [""],
    );
};

export const parseItems = (items: FeedItem[]): PostPayload[] =>
    items.map((item) => ({
        external: item.url,
        text: parseText(item.title),
    }));

// Unused: no endpoint calls this since /tiktok was removed. TikTok has no
// free API, and the only scraping route we found (RSSHub) is currently
// blocked on its public instance -- kept in case a workable source shows up.
export const parseTikTokItems = (items: SuperfeedrItem[]): PostPayload[] =>
    items.map((item) => {
        // remove mentions and hashtags at the end of the string
        let text = item.title.replace(/[@#][\s@#\w'`’]*$/u, "");
        text = parseMembers(text);
        text = parseText(text);

        const [, thumbnailUrl] = /<img\s+[^>]*src="(?<url>[^"]+)"/iu.exec(item.summary) || [];

        return {
            external: {
                description: "TikTok video by Critical Role",
                title: text,
                uri: item.permalinkUrl,
                ...(thumbnailUrl ? { thumb: { data: thumbnailUrl } } : {}),
            },
            text,
        };
    });

export const parseNewsItems = async (items: FeedItem[]): Promise<PostPayload[]> => {
    // filter items published less than 2 days ago and not in blacklist
    const filteredItems = items.filter(({ publishedAt, title }) => {
        const isBlacklisted = newsBlacklist.some((expression) => {
            if (expression instanceof RegExp) {
                return expression.test(title);
            }
            return title.includes(expression);
        });
        return isRecentlyPublished(publishedAt) && !isBlacklisted;
    });

    const decodedUrls = await Promise.all(
        filteredItems.map(async (item) => await decodeGoogleNewsUrl(item.url)),
    );

    return filteredItems.map((item, index) => {
        let text = item.title.replace(/Critical Role(?:[’'‘`´]s)?/u, "#CriticalRole");
        text = parseMembers(text, ({ name, bsky }) => (bsky ? `${name} (${bsky})` : name));
        text = text.replace(
            newsSourcesRegex,
            (match) => `${match} (${newsSources[match as keyof typeof newsSources]})`,
        );
        text = parseText(text);

        return {
            external: decodedUrls[index],
            text,
        };
    });
};

const videoRegex = /\[video:(?<url>[^\]]+)\]/gimu;
const imageRegex = /\[img:(?<url>[^\]]+)\]/gimu;

// Unused: no endpoint calls this since /twitter was removed. Twitter/X has
// no free API -- scraping it needs a real logged-in account's session token,
// not worth the ban risk -- kept in case that changes.
export const parseTwitterItems = (items: SuperfeedrItem[]): (PostPayload | PostPayload[])[] => {
    // filter items published less than 2 days ago and retweets and replies
    const filteredItems = items.filter(({ published, title }) => {
        const isRetweetOrReply = /^(?:RT\s|Re\s)/gu.test(title);
        return isRecentlyPublished(new Date(published * 1000)) && !isRetweetOrReply;
    });
    return filteredItems.map((item) => {
        let text = convert(item.summary, {
            wordwrap: false,
            preserveNewlines: true,
            selectors: [
                {
                    selector: "img",
                    format: "image",
                    options: { linkBrackets: ["[img:", "]"] },
                },
                {
                    selector: "video",
                    format: "image",
                    options: { linkBrackets: ["[video:", "]"] },
                },
            ],
        });

        const [, videoUrl] = videoRegex.exec(text) || [];
        if (videoUrl) {
            text = text.replaceAll(videoRegex, "");
        }

        let images: PostPayload["images"] | undefined;
        const imageMatches = [...text.matchAll(imageRegex)].slice(0, 4);
        if (imageMatches.length > 0) {
            text = text.replaceAll(imageRegex, "");
            images = imageMatches.map(([, url]) => ({ data: url })) as PostPayload["images"];
        }

        text = `[Twitter] ${text}`.replaceAll(/\n+$/giu, "");
        text = parseMembers(text);
        const [postText, ...repliesText] = splitText(text);

        const post = {
            text: postText ?? "",
            ...(videoUrl ? { video: { data: videoUrl } } : {}),
            ...(!videoUrl && images ? { images } : {}),
        };

        if (repliesText.length > 0) {
            return [post, ...repliesText.map((reply) => ({ text: reply }))];
        }

        return post;
    });
};

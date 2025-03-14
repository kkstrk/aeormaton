import { convert } from 'html-to-text';
import type { PostPayload } from '@skyware/bot';

import type { SuperfeedrItem } from '../types';
import { crMembers, newsBlacklist, newsSources } from '../constants';
import { getDifference } from './dates';
import decodeGoogleNewsUrl from './decodeGoogleNewsUrl';

const newsSourcesRegex = new RegExp(
    `(${Object.keys(newsSources)
        .map((handle) => handle.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
        .join('|')})$`,
    'u',
);

// /(?:@Marisha Ray641|@Marisha_Ray|...)(?!\.\w)|(?:Marisha Ray|...)/gmiu
const crMembersRegex = new RegExp(
    `(?:${crMembers
        .flatMap(({ tiktok, twitter }) =>
            [tiktok, twitter]
                .filter(Boolean)
                .map((str) => str.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')),
        )
        .join('|')})(?!\\.\\w)|(?:${crMembers
        .map(({ name }) => name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
        .join('|')})`,
    'gmiu',
);
const parseMembers = (text: string, replace = ({ name, bsky = name }): string => bsky) => {
    const replacedMembers = new Set<string>();
    return text.replace(crMembersRegex, (match) => {
        const matchValue = match.toLowerCase();
        const member = crMembers.find(
            ({ name, tiktok, twitter }) =>
                matchValue === name.toLowerCase() ||
                matchValue === tiktok?.toLowerCase() ||
                matchValue === twitter?.toLowerCase(),
        );
        if (!replacedMembers.has(member.name)) {
            replacedMembers.add(member.name);
            return replace(member);
        }
        return member.name;
    });
};

const isRecentlyPublished = (published: number) => getDifference(new Date(published * 1000)) >= -48;

const limit = 300;
const parseText = (text: string) => {
    const trimmedText = text.trim();
    if (trimmedText.length <= limit) {
        return trimmedText;
    }
    const words = trimmedText.split(' ');
    while (words.join(' ').length + 3 > limit) {
        words.pop();
    }
    return `${words.join(' ')}...`;
};

const splitText = (text: string): string[] => {
    const trimmedText = text.trim();
    if (trimmedText.length <= limit) {
        return [trimmedText];
    }
    const words = trimmedText.split(' ');
    return words.reduce(
        (parts, word) => {
            const part = parts[parts.length - 1];
            const extendedPart = part ? `${part} ${word}` : word;
            if (extendedPart.length <= limit) {
                parts[parts.length - 1] = extendedPart;
            } else {
                parts.push(word);
            }
            return parts;
        },
        [''],
    );
};

export const parseItems = (items: SuperfeedrItem[]): PostPayload[] =>
    items.map((item) => ({
        external: item.permalinkUrl,
        text: parseText(item.title),
    }));

export const parseTikTokItems = (items: SuperfeedrItem[]): PostPayload[] =>
    items.map((item) => {
        // remove mentions and hashtags at the end of the string
        let text = item.title.replace(/[@#][\s@#\w'`’]*$/u, '');
        text = parseMembers(text);
        text = parseText(text);

        const [, thumbnailUrl] = /<img\s+[^>]*src="(?<url>[^"]+)"/iu.exec(item.summary) || [];

        return {
            external: {
                description: 'TikTok video by Critical Role',
                title: text,
                uri: item.permalinkUrl,
                ...(thumbnailUrl ? { thumb: { data: thumbnailUrl } } : {}),
            },
            text,
        };
    });

export const parseNewsItems = async (items: SuperfeedrItem[]): Promise<PostPayload[]> => {
    // filter items published less than 2 days ago and not in blacklist
    const filteredItems = items.filter(({ published, title }) => {
        const isBlacklisted = newsBlacklist.some((expression) => {
            if (expression instanceof RegExp) {
                return expression.test(title);
            }
            return title.includes(expression);
        });
        return isRecentlyPublished(published) && !isBlacklisted;
    });

    const decodedUrls = await Promise.all(
        filteredItems.map(async (item) => await decodeGoogleNewsUrl(item.permalinkUrl)),
    );

    return filteredItems.map((item, index) => {
        let text = item.title.replace(/Critical Role(?:[’'‘`´]s)?/u, '#CriticalRole');
        text = parseMembers(text, ({ name, bsky }) => (bsky ? `${name} (${bsky})` : name));
        text = text.replace(newsSourcesRegex, (match) => `${match} (${newsSources[match]})`);
        text = parseText(text);

        return {
            external: decodedUrls[index],
            text,
        };
    });
};

const videoRegex = /\[video:(?<url>[^\]]+)\]/gimu;
const imageRegex = /\[img:(?<url>[^\]]+)\]/gimu;

export const parseTwitterItems = (items: SuperfeedrItem[]): (PostPayload | PostPayload[])[] => {
    // filter items published less than 2 days ago and retweets and replies
    const filteredItems = items.filter(({ published, title }) => {
        const isRetweetOrReply = /^(?:RT\s|Re\s)/gu.test(title);
        return isRecentlyPublished(published) && !isRetweetOrReply;
    });
    return filteredItems.map((item) => {
        let text = convert(item.summary, {
            wordwrap: false,
            preserveNewlines: true,
            selectors: [
                {
                    selector: 'img',
                    format: 'image',
                    options: { baseUrl: null, linkBrackets: ['[img:', ']'] },
                },
                {
                    selector: 'video',
                    format: 'image',
                    options: { baseUrl: null, linkBrackets: ['[video:', ']'] },
                },
            ],
        });

        const [, videoUrl] = videoRegex.exec(text) || [];
        if (videoUrl) {
            text = text.replaceAll(videoRegex, '');
        }

        let images;
        const imageMatches = [...text.matchAll(imageRegex)].slice(0, 4);
        if (imageMatches.length) {
            text = text.replaceAll(imageRegex, '');
            images = imageMatches.map(([, url]) => ({ data: url }));
        }

        text = `[Twitter] ${text}`.replace(/\n+$/giu, '');
        text = parseMembers(text);
        const [postText, ...repliesText] = splitText(text);

        const post = {
            text: postText,
            ...(videoUrl ? { video: { data: videoUrl } } : {}),
            ...(!videoUrl && images ? { images } : {}),
        };

        if (repliesText.length) {
            return [post, ...repliesText.map((reply) => ({ text: reply }))];
        }

        return post;
    });
};

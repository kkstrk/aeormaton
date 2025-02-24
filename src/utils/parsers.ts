import { convert } from 'html-to-text';
import type { PostPayload } from '@skyware/bot';

import type { SuperfeedrItem } from '../types';
import { crMembers, newsBlacklist, newsSources } from '../constants';
import { getDifference } from './dates';
import decodeGoogleNewsUrl from './decodeGoogleNewsUrl';

const parseText = (text: string, limit = 300) => {
    const trimmedText = text.trim();
    if (trimmedText.length <= limit) {
        return trimmedText;
    }
    const words = trimmedText.split(' ');
    while ((words.join(' ').length + 3) > limit) {
        words.pop();
    }
    return `${words.join(' ')}...`;
};

export const parseItems = (items: SuperfeedrItem[]): PostPayload[] =>
    items.map((item) => ({
        external: item.permalinkUrl,
        text: parseText(item.title),
    }));

const tiktokMembersRegex = new RegExp(
    crMembers
        .map(({ name, tiktok = name }) => tiktok.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
        .join('|'),
    'gu',
);

export const parseTikTokItems = (items: SuperfeedrItem[]): PostPayload[] =>
    items.map((item) => {
        // remove mentions and hashtags at the end of the string
        let text = item.title.replace(/[@#][\s@#\w'`’]*$/u, '');

        // replace TikTok handles with Bluesky handles
        text = text.replace(tiktokMembersRegex, (match) => {
            const member = crMembers.find(({ name, tiktok = name }) => tiktok === match);
            return member.bsky || member.name;
        });

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

const newsMembersRegex = new RegExp(
    crMembers.map(({ name }) => name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('|'),
    'gu',
);

const newsSourcesRegex = new RegExp(
    `(${Object.keys(newsSources)
        .map((handle) => handle.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
        .join('|')})$`,
    'u',
);

export const parseNewsItems = async (items: SuperfeedrItem[]): Promise<PostPayload[]> => {
    // filter items published less than 2 days ago and not in blacklist
    const filteredItems = items.filter(
        ({ published, title }) => {
            const isRecent = getDifference(new Date(published * 1000)) >= -48;
            const isBlacklisted = newsBlacklist.some((expression) => {
                if (expression instanceof RegExp) {
                    return expression.test(title);
                }
                return title.includes(expression);
            });
            return isRecent && !isBlacklisted;
        },
    );

    const decodedUrls = await Promise.all(
        filteredItems.map(async (item) => await decodeGoogleNewsUrl(item.permalinkUrl))
    );

    return filteredItems.map((item, index) => {
        let text = item.title.replace('Critical Role', '#CriticalRole');

        // add Bluesky handles for CR members
        const replacedMembers = new Set<string>();
        text = text.replace(newsMembersRegex, (match) => {
            const member = crMembers.find(({ name }) => name === match);
            if (!replacedMembers.has(match) && member.bsky) {
                replacedMembers.add(match);
                return `${match} (${member.bsky})`;
            }
            return match;
        });

        // add Bluesky handles for news sources
        text = text.replace(newsSourcesRegex, (match) => `${match} (${newsSources[match]})`);

        text = parseText(text);

        return {
            external: decodedUrls[index],
            text,
        };
    });
};

const videoRegex = /\[video:(?<url>[^\]]+)\]/gmui;
const imageRegex = /\[img:(?<url>[^\]]+)\]/gmui;
const twitterMembersRegex = new RegExp(
    crMembers
        .map(({ name, twitter = name }) => twitter.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
        .join('|'),
    'gu',
);

export const parseTwitterItems = (items: SuperfeedrItem[]): PostPayload[] => {
    // filter items that are retweets and replies
    const filteredItems = items.filter(({ title }) => !/^(?:RT\s|Re\s)/gu.test(title));
    return filteredItems.map((item) => {
        let text = convert(
            item.summary,
            {
                wordwrap: false,
                preserveNewlines: true,
                selectors: [{
                    selector: 'img',
                    format: 'image',
                    options: { baseUrl: null, linkBrackets: ['[img:', ']'] }
                }, {
                    selector: 'video',
                    format: 'image',
                    options: { baseUrl: null, linkBrackets: ['[video:', ']'] }
                }],
            }
        );

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

        // replace Twitter handles with Bluesky handles
        text = text.replace(twitterMembersRegex, (match) => {
            const member = crMembers.find(({ name, twitter = name }) => twitter === match);
            return member.bsky || member.name;
        });

        text = `[Twitter] ${text}`.replace(/\n+$/gui, '');
        text = parseText(text);

        return {
            text,
            ...(videoUrl ? { video: { data: videoUrl }} : {}),
            ...((!videoUrl && images) ? { images } : {}),
        }
    });
};

import type { SuperfeedrItem } from '../types';
import { crMembers, newsBlacklist, newsSources } from '../constants';
import { getDifference } from './dates';

// todo: keep text within bsky char limit
const parseText = (text: string) => {
    const parsedText = text.trim();
    return parsedText;
};

export const parseItems = (items: SuperfeedrItem[]) =>
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

export const parseTikTokItems = (items: SuperfeedrItem[]) =>
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

export const parseNewsItems = (items: SuperfeedrItem[]) => {
    // filter items published less than 2 days ago and not in blacklist
    const filteredItems = items.filter(
        ({ published, title }) =>
            getDifference(new Date(published * 1000)) >= -48 &&
            !newsBlacklist.some((blacklist) => title.includes(blacklist)),
    );
    return filteredItems.map((item) => {
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
            external: {
                description: 'Google News - Critical Role',
                title: item.title,
                uri: item.permalinkUrl,
            },
            text,
        };
    });
};

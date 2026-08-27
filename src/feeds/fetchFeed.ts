import * as cheerio from "cheerio";

import { userAgent } from "../constants/index.js";

import type { FeedItem } from "../types/index.js";

export const parseFeedXml = (xml: string): FeedItem[] => {
    const $ = cheerio.load(xml, { xmlMode: true });

    const rssItems = $("item")
        .map((_, element) => {
            const $item = $(element);
            return {
                publishedAt: new Date($item.find("pubDate").first().text().trim()),
                title: $item.find("title").first().text().trim(),
                url: $item.find("link").first().text().trim(),
            };
        })
        .get();
    if (rssItems.length > 0) {
        return rssItems;
    }

    // Atom feeds (e.g. YouTube) use <entry> with a <link href="..."> instead
    // of RSS' <item> with a <link> text node.
    return $("entry")
        .map((_, element) => {
            const $entry = $(element);
            return {
                publishedAt: new Date($entry.find("published").first().text().trim()),
                title: $entry.find("title").first().text().trim(),
                url: $entry.find("link").first().attr("href") ?? "",
            };
        })
        .get();
};

export const fetchFeed = async (url: string): Promise<FeedItem[]> => {
    const response = await fetch(url, { headers: { "User-Agent": userAgent } });
    if (!response.ok) {
        throw new Error(`Response status: ${response.status}.`);
    }
    return parseFeedXml(await response.text());
};

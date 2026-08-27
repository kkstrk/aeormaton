import { parseItems, parseNewsItems } from "../utils/parsers.js";

import type { FeedSource } from "../types/index.js";

const sources: FeedSource[] = [
    { name: "blog", parser: parseItems, url: "https://critrole.com/feed" },
    {
        name: "youtube",
        parser: parseItems,
        url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCpXBGqwsBkpvcYjsJBQ7LEQ",
    },
    {
        name: "news",
        parser: parseNewsItems,
        url: "https://news.google.com/rss/search?q=Critical+Role+dnd&hl=en-US&gl=US&ceid=US:en",
    },
];

export default sources;

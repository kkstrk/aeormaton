import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseFeedXml } from "./fetchFeed.js";

const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>Critical Role</title>
<item>
<title>A New Blog Post</title>
<link>https://critrole.com/a-new-blog-post/</link>
<pubDate>Thu, 27 Aug 2026 18:05:44 +0000</pubDate>
<description>Some description</description>
</item>
<item>
<title>An Older Blog Post</title>
<link>https://critrole.com/an-older-blog-post/</link>
<pubDate>Wed, 20 Aug 2026 12:00:00 +0000</pubDate>
<description>Some other description</description>
</item>
</channel>
</rss>`;

const atomFeed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
<link rel="self" href="http://www.youtube.com/feeds/videos.xml?channel_id=abc"/>
<title>Critical Role</title>
<entry>
<id>yt:video:abc123</id>
<title>Campaign 4 Returns</title>
<link rel="alternate" href="https://www.youtube.com/watch?v=abc123"/>
<published>2026-08-27T15:43:11+00:00</published>
<updated>2026-08-27T15:57:22+00:00</updated>
</entry>
</feed>`;

describe("parseFeedXml", () => {
    it("parses RSS <item> entries", () => {
        const items = parseFeedXml(rssFeed);

        assert.equal(items.length, 2);
        assert.deepEqual(items[0], {
            publishedAt: new Date("Thu, 27 Aug 2026 18:05:44 +0000"),
            title: "A New Blog Post",
            url: "https://critrole.com/a-new-blog-post/",
        });
        assert.deepEqual(items[1], {
            publishedAt: new Date("Wed, 20 Aug 2026 12:00:00 +0000"),
            title: "An Older Blog Post",
            url: "https://critrole.com/an-older-blog-post/",
        });
    });

    it("parses Atom <entry> entries", () => {
        const items = parseFeedXml(atomFeed);

        assert.equal(items.length, 1);
        assert.deepEqual(items[0], {
            publishedAt: new Date("2026-08-27T15:43:11+00:00"),
            title: "Campaign 4 Returns",
            url: "https://www.youtube.com/watch?v=abc123",
        });
    });

    it("returns an empty array for a feed with no entries", () => {
        const items = parseFeedXml(
            '<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>',
        );

        assert.deepEqual(items, []);
    });
});

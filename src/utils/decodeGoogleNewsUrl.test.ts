import assert from 'assert/strict';
import { describe, it } from 'node:test';

import decodeGoogleNewsUrl from './decodeGoogleNewsUrl';

describe('decodeGoogleNewsUrl', () => {
    it('should return decoded url', () => {
        [
            {
                encodedUrl: 'https://news.google.com/rss/articles/CBMigwFBVV95cUxOTFpsQlJPS2VUR2d6R2F4X1ZBRUpab3lNM2NsSGJlQ3JTdjN3NGEzMFNBUFgxajROWnJwOUI1cmVBdnNqUDg4WWlBblNNQ1pwdG9hOEdoY0pjZmd6RXJ4bTZTZjlFSk54akVyZmxrbzZpdnlncVppSmZaSmlXTGdFR1JKdw?oc=5%27',
                decodedUrl: 'https://mashable.com/article/legend-of-vox-machina-zerxuz-ilerez-exu-calamity',
            },
            {
                encodedUrl: 'https://news.google.com/rss/articles/CBMiygFBVV95cUxPS1FPLVVuY2ZGaU1pVUQyWktFNWVLdFRITWI5ZzB4elgxcnk3eU1IcW9mUzFVOTlDSVlHaXlVSzZ5UU1iRUpXb0VULTN5cGc5Qld3TTFmLVRaYzRKeWxJcWo2cUM0S0NkVUlGRmVNZDRsOGRvR2lxM0ZRcEVVWXRmYTc0LWQ4MFBZZjZQT0pHa2RkdkN4RkZ5V2psbGlrYUpDU2E2UnhqTjByVWN0Vmx1U1F2d0pNRGdmaDZHVmZua1YxQk1fVjNfVGhB?oc=5%27',
                decodedUrl: 'https://www.gamesradar.com/games/rpg/forget-baldurs-gate-3-the-critical-role-team-are-talking-about-creating-their-own-video-game/',
            },
            {
                encodedUrl: 'https://news.google.com/rss/articles/CBMijgFBVV95cUxNOC1KU1RIdXNONDFsdUJVeWZZMW1Fd1VBRUNneVI3TnRiNC1pSlQ1d2FSblU0NWN1Z1dJZGFTRWMzTzh0ZGdYN2FtU3lNWHpENVpSUExVb3dMc3NqQWlDeDFQU2ZVU3d1bEFCbEVqOHdZcGM4VWtFLWJ3OHpKa29rWU54ZHliQlJaODFBTDZ3?oc=5%27',
                decodedUrl: 'https://www.thegamer.com/critical-role-sam-riegel-diagnosed-recovering-tonsil-cancer/',
            },
        ].forEach(async ({ encodedUrl, decodedUrl }) => {
            const result = await decodeGoogleNewsUrl(encodedUrl);
            assert.equal(result, decodedUrl);
        });
    });
});
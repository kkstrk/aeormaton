import assert from 'assert/strict';
import { describe, it } from 'node:test';

import { getDifference, isToday } from './dates';

describe('isToday', () => {
    it('should return true if the date is today', () => {
        const date = new Date();
        assert(isToday(date));
    });

    it('should return false if the date is not today', () => {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        assert(!isToday(date));
    });
});

describe('getDifference', () => {
    it('should return the difference in hours', () => {
        const tomorrow = new Date();
        tomorrow.setHours(tomorrow.getHours() + 13);
        assert.equal(getDifference(tomorrow), 13);

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        assert.equal(getDifference(weekAgo), -7 * 24);
    });
});

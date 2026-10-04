/**
 * rate-limit.test.js: whether the api has told the reader to wait (#210).
 *
 * Held here: that a 429 starts a wait as long as it says -- its `Retry-After`,
 * else its body's window, and with neither until an answer succeeds -- that an
 * answer that succeeds ends one, that nothing else changes it, that listeners
 * hear each change, and that the module holds no limit or window of its own.
 *
 * Note: the clock is jest's, so a wait can be seen to end.
 */

import fs from 'fs';
import path from 'path';

import {
    limitedUntil,
    noteResponse,
    resetRateLimit,
    retryAfterSeconds,
    subscribe,
} from '../../import/general/rate-limit.js';
import { blockedAnswer } from '../../test-support/blocked-answer.js';

const NOW = Date.parse('2026-10-04T12:00:00Z');
const MINUTE = 60 * 1000;

//
// an answer of `status`, its body the one given
//
function answer(status, body = {}) {
    return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: () => Promise.resolve(body) };
}

beforeEach(() => {
    resetRateLimit();
    jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
    jest.useRealTimers();
    resetRateLimit();
});

describe('a wait', () => {
    it('is not there to begin with', () => {
        expect(limitedUntil()).toBeNull();
    });

    it('lasts as long as a 429 says in its Retry-After', async () => {
        await noteResponse(blockedAnswer({ retryAfter: 300 }));

        expect(limitedUntil()).toBe(NOW + 5 * MINUTE);
    });

    it('follows whatever the answer says, with no number of its own', async () => {
        await noteResponse(blockedAnswer({ retryAfter: 600 }));

        expect(limitedUntil()).toBe(NOW + 10 * MINUTE);
    });

    it('lasts until the date a Retry-After names', async () => {
        await noteResponse(blockedAnswer({ retryAfter: new Date(NOW + 2 * MINUTE).toUTCString() }));

        expect(limitedUntil()).toBe(NOW + 2 * MINUTE);
    });

    it('lasts the window the body names, where there is no Retry-After', async () => {
        await noteResponse(blockedAnswer({ retryAfter: null, body: { report: { error: 'wait', window_seconds: 120 } } }));

        expect(limitedUntil()).toBe(NOW + 2 * MINUTE);
    });

    it('reads the body from a copy, so the caller can still read its own', async () => {
        const blocked = blockedAnswer({ retryAfter: null });
        const copy = jest.spyOn(blocked, 'clone');
        const own = jest.spyOn(blocked, 'json');

        await noteResponse(blocked);

        expect(copy).toHaveBeenCalledTimes(1);
        expect(own).not.toHaveBeenCalled();
    });

    it.each([
        ['names no window', { report: { error: 'wait' } }],
        ['is not the envelope', { error: 'wait' }],
        ['is a string', 'wait'],
    ])('lasts until an answer succeeds, where the body %s', async (_, body) => {
        await noteResponse(blockedAnswer({ retryAfter: null, body: body }));

        expect(limitedUntil()).toBe(Infinity);

        await noteResponse(answer(200));

        expect(limitedUntil()).toBeNull();
    });

    it('lasts until an answer succeeds, where the body can\'t be read at all', async () => {
        const blocked = { ...blockedAnswer({ retryAfter: null }), clone: () => ({ json: () => Promise.reject(new SyntaxError('html')) }) };

        await noteResponse(blocked);

        expect(limitedUntil()).toBe(Infinity);
    });

    it('lasts until an answer succeeds, where the answer can\'t be copied', async () => {
        const blocked = { ...blockedAnswer({ retryAfter: null }), clone: () => { throw new TypeError('used'); } };

        await noteResponse(blocked);

        expect(limitedUntil()).toBe(Infinity);
    });

    it('ends by itself at its end, and not a moment before', async () => {
        await noteResponse(blockedAnswer({ retryAfter: 300 }));

        jest.setSystemTime(NOW + 5 * MINUTE - 1);
        expect(limitedUntil()).toBe(NOW + 5 * MINUTE);

        jest.setSystemTime(NOW + 5 * MINUTE);
        expect(limitedUntil()).toBeNull();
    });

    it('ends early at an answer that succeeds', async () => {
        await noteResponse(blockedAnswer());
        await noteResponse(answer(200));

        expect(limitedUntil()).toBeNull();
    });

    it('keeps the later end of two', async () => {
        await noteResponse(blockedAnswer({ retryAfter: 600 }));
        await noteResponse(blockedAnswer({ retryAfter: 300 }));

        expect(limitedUntil()).toBe(NOW + 10 * MINUTE);
    });

    it.each([400, 403, 404, 500, 503])('is neither started nor ended by a %s', async (status) => {
        await noteResponse(answer(status));
        expect(limitedUntil()).toBeNull();

        await noteResponse(blockedAnswer());
        await noteResponse(answer(status));
        expect(limitedUntil()).toBe(NOW + 5 * MINUTE);
    });

    it.each([
        ['nothing', undefined],
        ['an error', new Error('offline')],
        ['an answer with no status', { ok: true }],
    ])('is left alone by %s', async (_, value) => {
        await noteResponse(blockedAnswer());

        await expect(noteResponse(value)).resolves.toBe(NOW + 5 * MINUTE);
        expect(limitedUntil()).toBe(NOW + 5 * MINUTE);
    });
});

describe('who hears of it', () => {
    it('hears a wait start, with its end, and a success end it', async () => {
        const heard = jest.fn();
        subscribe(heard);

        await noteResponse(blockedAnswer());
        await noteResponse(answer(200));

        expect(heard.mock.calls).toEqual([[NOW + 5 * MINUTE], [null]]);
    });

    it('hears nothing of an answer that changes nothing', async () => {
        const heard = jest.fn();
        subscribe(heard);

        await noteResponse(answer(200));
        await noteResponse(answer(500));

        expect(heard).not.toHaveBeenCalled();
    });

    it('hears nothing once it stops listening', async () => {
        const heard = jest.fn();
        const stop = subscribe(heard);

        stop();
        await noteResponse(blockedAnswer());

        expect(heard).not.toHaveBeenCalled();
    });
});

describe('a Retry-After header', () => {
    it.each([
        ['300', 300],
        ['0', 0],
        [' 60 ', 60],
    ])('of %p is that many seconds', (value, seconds) => {
        expect(retryAfterSeconds(value, NOW)).toBe(seconds);
    });

    it('naming a date is the seconds until it, and none for one past', () => {
        expect(retryAfterSeconds(new Date(NOW + 90 * 1000).toUTCString(), NOW)).toBe(90);
        expect(retryAfterSeconds(new Date(NOW - 90 * 1000).toUTCString(), NOW)).toBe(0);
    });

    it.each([
        ['missing', null],
        ['undefined', undefined],
        ['blank', '  '],
        ['negative', '-5'],
        ['neither a count nor a date', 'soon'],
    ])('that is %s says nothing', (_, value) => {
        expect(retryAfterSeconds(value, NOW)).toBeNull();
    });
});

describe('the module itself', () => {
    it('holds no limit or window of the api\'s', () => {
        //
        // the wait comes from each blocked answer, so a change to the api's limit
        // or its window needs no change here
        //
        const source = fs.readFileSync(
            path.resolve(__dirname, '../../import/general/rate-limit.js'),
            'utf8'
        ).replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');

        expect(source).not.toMatch(/\b(100|120|300|600)\b/);
    });
});

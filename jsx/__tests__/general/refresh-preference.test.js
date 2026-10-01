/**
 * refresh-preference.test.js: whether /stream refreshes on its own, kept
 * between visits.
 *
 * Note: setup.js installs a localStorage shim for every suite. The failure paths
 *       replace it with one that throws, as Safari's private mode does, and put
 *       it back after.
 */

import { readRefresh, writeRefresh, KEY } from '../../import/general/refresh-preference.js';

const real = window.localStorage;

function blocked() {
    Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: {
            getItem() { throw new Error('access denied'); },
            setItem() { throw new Error('quota exceeded'); },
            removeItem() { throw new Error('access denied'); },
        },
    });
}

afterEach(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: real });
    window.localStorage.clear();
});

describe('readRefresh', () => {
    it('is on for a reader who never chose', () => {
        expect(readRefresh()).toBe(true);
    });

    it('is off once the reader switched it off', () => {
        window.localStorage.setItem(KEY, 'off');

        expect(readRefresh()).toBe(false);
    });

    it('reads anything else kept there as on', () => {
        window.localStorage.setItem(KEY, '{"v":9}');

        expect(readRefresh()).toBe(true);
    });

    it('is on where the browser keeps nothing, rather than throwing', () => {
        blocked();

        expect(readRefresh()).toBe(true);
    });
});

describe('writeRefresh', () => {
    it('keeps it off', () => {
        expect(writeRefresh(false)).toBe(true);

        expect(window.localStorage.getItem(KEY)).toBe('off');
        expect(readRefresh()).toBe(false);
    });

    it('keeps nothing for on, which is what holding nothing means', () => {
        writeRefresh(false);

        expect(writeRefresh(true)).toBe(true);

        expect(window.localStorage.getItem(KEY)).toBeNull();
        expect(readRefresh()).toBe(true);
    });

    it.each([[true], [false]])('reports a choice it could not keep (%s) rather than throwing', (on) => {
        blocked();

        expect(writeRefresh(on)).toBe(false);
    });
});

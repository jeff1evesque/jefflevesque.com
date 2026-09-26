/**
 * theme-preference.test.js: which theme the page is in -- by the reader's clock,
 * unless they asked for the other one.
 *
 * What is held here is the schedule and the promise the switch makes: light from 7
 * in the morning until 7 in the evening on the reader's own clock, dark otherwise;
 * a choice made with the switch kept until the schedule's next switch, through a
 * reload, and not after; and nothing a browser can do to storage keeping the page
 * from drawing.
 *
 * Note: every moment here is New York's, the zone jest.config.js pins, so '09:00'
 *       is nine in the morning on the reader's clock. The same hours are local
 *       in any zone -- a reader in California switches three hours after one in
 *       Maryland, at 7 on their own clock.
 */

import {
    applyTheme,
    currentTheme,
    nextSwitch,
    readTheme,
    scheduledTheme,
    writeTheme,
    ATTRIBUTE,
    KEY,
} from '../../import/general/theme-preference.js';

const storage = window.localStorage;

//
// a moment on the reader's clock, on 2026-09-26 unless another day is named
//
const at = (time, day = '2026-09-26') => new Date(`${day}T${time}:00`);

//
// a storage that throws on every access, as Safari's private mode and blocked
// site data do
//
function refusing() {
    Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: {
            getItem() { throw new Error('denied'); },
            setItem() { throw new Error('denied'); },
            removeItem() { throw new Error('denied'); },
            clear() {},
        },
    });
}

beforeEach(() => {
    window.localStorage.clear();
});

afterEach(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    document.documentElement.removeAttribute(ATTRIBUTE);
});

describe('the schedule', () => {
    it.each([
        ['00:30', 'dark'],
        ['06:59', 'dark'],
        ['07:00', 'light'],
        ['12:00', 'light'],
        ['18:59', 'light'],
        ['19:00', 'dark'],
        ['23:30', 'dark'],
    ])('is %s on the reader\'s clock: %s', (time, theme) => {
        expect(scheduledTheme(at(time))).toBe(theme);
    });

    it('switches next at 7 in the evening, during the day', () => {
        expect(nextSwitch(at('09:15'))).toEqual(at('19:00'));
    });

    it('switches next at 7 the next morning, in the evening', () => {
        expect(nextSwitch(at('21:40'))).toEqual(at('07:00', '2026-09-27'));
    });

    it('switches next at 7 the same morning, after midnight', () => {
        expect(nextSwitch(at('02:10'))).toEqual(at('07:00'));
    });

    it('switches at 7 on the clock on a day that loses an hour', () => {
        //
        // clocks go forward at 2:00 on 2027-03-14 in New York; the morning still
        // starts at 7 on them, not 8
        //
        const next = nextSwitch(at('01:30', '2027-03-14'));

        expect(next.getHours()).toBe(7);
        expect(next.getDate()).toBe(14);
    });
});

describe('the reader\'s choice', () => {
    it('is nothing until they make one', () => {
        expect(readTheme(at('12:00'))).toBeNull();
        expect(currentTheme(at('12:00'))).toBe('light');
    });

    it('is the theme drawn, until the schedule\'s next switch', () => {
        writeTheme('light', at('20:00'));

        expect(currentTheme(at('20:00'))).toBe('light');
        expect(currentTheme(at('06:59', '2026-09-27'))).toBe('light');
        expect(readTheme(at('07:00', '2026-09-27'))).toBeNull();
    });

    it('lapses there into a schedule that has come round to it', () => {
        //
        // dark asked for at noon is dark again at 7, by the schedule, and follows
        // the schedule from then on
        //
        writeTheme('dark', at('12:00'));

        expect(currentTheme(at('18:59'))).toBe('dark');
        expect(readTheme(at('19:00'))).toBeNull();
        expect(currentTheme(at('19:00'))).toBe('dark');
        expect(currentTheme(at('07:00', '2026-09-27'))).toBe('light');
    });

    it('comes back from storage exactly as it was made, as the next visit reads it', () => {
        writeTheme('dark', at('10:00'));

        expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual({
            theme: 'dark',
            until: at('19:00').getTime(),
        });
        expect(KEY).toBe('jefflevesque.theme');
    });

    it('is cleared by asking for the theme the schedule already gives', () => {
        //
        // pressing the switch twice puts the page back on its schedule
        //
        writeTheme('dark', at('10:00'));
        writeTheme('light', at('10:05'));

        expect(window.localStorage.getItem(KEY)).toBeNull();
        expect(currentTheme(at('20:00'))).toBe('dark');
    });

    it('refuses to keep a value that is not a theme', () => {
        expect(writeTheme('sepia', at('10:00'))).toBe(false);
        expect(readTheme(at('10:00'))).toBeNull();
    });

    it.each([
        ['the bare word an earlier version kept', 'dark'],
        ['a record with no moment', JSON.stringify({ theme: 'dark' })],
        ['a record of no theme', JSON.stringify({ theme: 'Dark', until: Date.now() + 1e9 })],
        ['a record that is not a record', '[1, 2]'],
    ])('reads %s as no choice', (label, value) => {
        window.localStorage.setItem(KEY, value);

        expect(readTheme(at('12:00'))).toBeNull();
        expect(currentTheme(at('12:00'))).toBe('light');
    });

    it('is no choice at all where storage refuses, and the schedule still draws', () => {
        refusing();

        expect(readTheme(at('20:00'))).toBeNull();
        expect(writeTheme('light', at('20:00'))).toBe(false);
        expect(currentTheme(at('20:00'))).toBe('dark');
    });
});

describe('the theme on the page', () => {
    it('goes on the root element, where the stylesheet reads it', () => {
        applyTheme('dark');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

        applyTheme('light');
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('goes on as light for a value that is not a theme', () => {
        applyTheme('sepia');

        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('is the schedule\'s when nothing is said about the moment', () => {
        //
        // every function takes `now`, and a caller that gives none is asking
        // about the present
        //
        expect(['light', 'dark']).toContain(currentTheme());
        expect(['light', 'dark']).toContain(scheduledTheme());
        expect(nextSwitch().getTime()).toBeGreaterThan(Date.now());
        expect(readTheme()).toBeNull();

        const other = scheduledTheme() === 'light' ? 'dark' : 'light';

        expect(writeTheme(other)).toBe(true);
        expect(readTheme()).toBe(other);
    });
});

/**
 * index-html.test.js: the script in the page's head that puts the theme on the
 * page before anything is painted.
 *
 * It runs before the bundle has loaded, so it cannot import theme-preference.js and
 * has to agree with it by hand: the same key, the same record, the same attribute,
 * and the same schedule where the reader has not chosen. Two copies of one rule
 * drift the first time one of them changes, so this suite reads the script out of
 * index.html and RUNS it -- against a window, a document and a clock of its own --
 * and holds every answer it gives to the one the bundle gives at the same moment.
 *
 * Note: under meta/, beside the other suites that read a file of the repository
 *       rather than a module.
 */

const fs = require('fs');
const path = require('path');

import { ATTRIBUTE, KEY, currentTheme, writeTheme } from '../../import/general/theme-preference.js';

const INDEX = path.join(__dirname, '..', '..', '..', 'index.html');
const html = fs.readFileSync(INDEX, 'utf8');
const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
const script = (head.match(/<script>([\s\S]*?)<\/script>/) || [])[1];

//
// a moment on the reader's clock -- New York's, which jest.config.js pins
//
const at = (time, day = '2026-09-26') => new Date(`${day}T${time}:00`);

//
// the script, run at `now` against a window whose storage holds `stored` -- or
// throws, where `stored` is an Error. Answers what it put on the root.
//
function run(now, stored = null) {
    const set = {};
    const window = {
        localStorage: {
            getItem(key) {
                if (stored instanceof Error) {
                    throw stored;
                }

                return key === KEY ? stored : null;
            },
        },
    };
    const document = {
        documentElement: {
            setAttribute(name, value) {
                set[name] = value;
            },
        },
    };

    //
    // Date as the script sees it: `now`, whether it is asked for a new moment or
    // for the time in ms
    //
    class Clock extends Date {
        constructor(...args) {
            super(...(args.length ? args : [now.getTime()]));
        }

        static now() {
            return now.getTime();
        }
    }

    new Function('window', 'document', 'Date', script)(window, document, Clock);

    return set;
}

//
// what the bundle would store for a choice of `theme` made at `when`
//
function chosen(theme, when) {
    window.localStorage.clear();
    writeTheme(theme, when);

    return window.localStorage.getItem(KEY);
}

afterEach(() => {
    window.localStorage.clear();
});

describe('the theme script', () => {
    it('is in the head', () => {
        expect(script).toBeDefined();
    });

    it('comes before the stylesheet, so the page is never painted in the other theme', () => {
        expect(head.indexOf('<script>')).toBeLessThan(head.indexOf('/static/css/style.css'));
    });

    it('reads the key the bundle keeps the choice under', () => {
        expect(script).toContain(`'${KEY}'`);
    });

    it('sets the attribute the stylesheet reads, and nothing else', () => {
        expect(Object.keys(run(at('12:00')))).toEqual([ATTRIBUTE]);
    });

    it.each(['00:30', '06:59', '07:00', '12:00', '18:59', '19:00', '23:30'])(
        'draws the schedule\'s theme at %s, as the bundle does',
        (time) => {
            expect(run(at(time))[ATTRIBUTE]).toBe(currentTheme(at(time)));
        }
    );

    it('draws a choice the bundle kept, while it holds', () => {
        const record = chosen('light', at('20:00'));

        expect(run(at('23:00'), record)[ATTRIBUTE]).toBe('light');
        expect(run(at('06:59', '2026-09-27'), record)[ATTRIBUTE]).toBe('light');
    });

    it('draws the schedule once the choice has lapsed, as the bundle does', () => {
        const record = chosen('dark', at('09:00'));
        const later = at('07:30', '2026-09-27');

        window.localStorage.setItem(KEY, record);

        expect(run(later, record)[ATTRIBUTE]).toBe(currentTheme(later));
        expect(run(later, record)[ATTRIBUTE]).toBe('light');
    });

    it.each([
        ['the bare word an earlier version kept', 'dark'],
        ['a record with no moment', JSON.stringify({ theme: 'dark' })],
        ['a record of no theme', JSON.stringify({ theme: 'sepia', until: at('23:00').getTime() })],
    ])('reads %s as no choice', (label, value) => {
        expect(run(at('12:00'), value)[ATTRIBUTE]).toBe('light');
    });

    it('draws the schedule where storage refuses', () => {
        expect(run(at('21:00'), new Error('denied'))[ATTRIBUTE]).toBe('dark');
    });
});

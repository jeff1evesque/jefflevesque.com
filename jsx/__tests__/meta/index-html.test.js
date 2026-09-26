/**
 * index-html.test.js: the script in the page's head that puts the reader's theme on
 * the page before anything is painted.
 *
 * It runs before the bundle has loaded, so it cannot import theme-preference.js and
 * has to agree with it by hand: the same key, the same two values, the same
 * attribute, and the same answer where the reader has not chosen. Two copies of one
 * rule drift the first time one of them changes, so this suite reads the script out
 * of index.html and RUNS it, against a window and a document of its own, and holds
 * every answer it gives to the one the bundle gives.
 *
 * Note: under meta/, beside the other suites that read a file of the repository
 *       rather than a module.
 */

const fs = require('fs');
const path = require('path');

import { ATTRIBUTE, KEY, THEMES } from '../../import/general/theme-preference.js';

const INDEX = path.join(__dirname, '..', '..', '..', 'index.html');
const html = fs.readFileSync(INDEX, 'utf8');
const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
const script = (head.match(/<script>([\s\S]*?)<\/script>/) || [])[1];

//
// the script, run against a window whose storage holds `stored` -- or throws,
// where `stored` is an Error -- and whose system asks for `system`, or has no
// system to ask where that is undefined. Answers what it put on the root.
//
function run({ stored = null, system } = {}) {
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
        matchMedia: system === undefined
            ? undefined
            : (query) => ({ matches: query === '(prefers-color-scheme: dark)' && system === 'dark' }),
    };
    const document = {
        documentElement: {
            setAttribute(name, value) {
                set[name] = value;
            },
        },
    };

    new Function('window', 'document', script)(window, document);

    return set;
}

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
        expect(Object.keys(run({ stored: 'dark' }))).toEqual([ATTRIBUTE]);
    });

    it.each(THEMES)('draws a reader who chose %s in exactly that, whatever the system says', (theme) => {
        ['light', 'dark'].forEach((system) => {
            expect(run({ stored: theme, system })[ATTRIBUTE]).toBe(theme);
        });
    });

    it.each(THEMES)('follows a system asking for %s until the reader chooses', (system) => {
        expect(run({ system })[ATTRIBUTE]).toBe(system);
    });

    it('reads a stored value that is not a theme as no choice', () => {
        expect(run({ stored: 'Dark', system: 'light' })[ATTRIBUTE]).toBe('light');
        expect(run({ stored: 'sepia', system: 'dark' })[ATTRIBUTE]).toBe('dark');
    });

    it('follows the system where storage refuses', () => {
        expect(run({ stored: new Error('denied'), system: 'dark' })[ATTRIBUTE]).toBe('dark');
    });

    it('draws the light theme where there is no system to ask', () => {
        expect(run({})[ATTRIBUTE]).toBe('light');
    });
});

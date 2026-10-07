/**
 * figure-boxes-stylesheet.test.js: what '_figure-boxes.scss' promises about a
 * few figures side by side -- /stream's stream on its own (#206, #208), and a
 * dataset opened on its own on a phone, on /data (#230).
 *
 * jsdom lays nothing out and resolves no stylesheet, so no suite can see how
 * the figures stand or the color a value is drawn in. What can be held is the
 * rule that decides them: one ruled row on a wide screen and boxes on a phone,
 * the color of each tone a value is given, and the info icon after each name.
 * Where each page puts them is its own partial's -- see stylesheet.test.js
 * under layout/stream/, and cube-stylesheet.test.js.
 *
 * Note: read the way navigation/stylesheet.test.js reads '_navigation.scss':
 *       comments taken out, and a block found by its header, whole.
 */

import fs from 'fs';
import path from 'path';

//
// a partial's text, its comments taken out
//
function read(file) {
    return fs.readFileSync(path.resolve(__dirname, '../../../scss', file), 'utf8').replace(/\/\/.*$/gm, '');
}

const source = read('_figure-boxes.scss');

//
// the text between the braces of every block opened by `header`, at any depth
//
function blocks(text, header) {
    const found = [];
    const opener = new RegExp(`(^|\\s)${header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`, 'g');
    let match;

    while ((match = opener.exec(text)) !== null) {
        const start = match.index + match[0].length;
        let depth = 1;
        let at = start;

        while (depth > 0 && at < text.length) {
            if (text[at] === '{') depth += 1;
            if (text[at] === '}') depth -= 1;
            at += 1;
        }

        found.push(text.slice(start, at - 1));
    }

    return found;
}

//
// a block's own declarations, the blocks nested in it taken out
//
function own(text) {
    let out = text;
    let last;

    do {
        last = out;
        out = out.replace(/[^{};]*\{[^{}]*\}/g, '');
    } while (out !== last);

    return out;
}

//
// the first block a header opens -- the wide screen's, since the phone's rules
// come after it -- and the last, the phone's
//
const first = (header) => blocks(source, header)[0] || '';
const last = (header) => blocks(source, header).slice(-1)[0] || '';

//
// a declaration that says where a block stands, which is the page's to say: a
// margin of any side, or an order. 'border-' is no 'order'
//
const PLACED = /(^|[^-\w])(margin(-\w+)?|order)\s*:/;

describe('the figures on a wide screen (#208)', () => {
    const row = own(first('.stream-focus-figures'));
    const figure = own(first('.stream-focus-figure'));

    it('are one row, in three even columns', () => {
        expect(row).toMatch(/display\s*:\s*grid\s*;/);
        expect(row).toMatch(/grid-template-columns\s*:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)\s*;/);
        expect(row).not.toMatch(/(^|[^-])gap\s*:/);
    });

    it('are ruled above and below, with a divider between each and the next', () => {
        expect(row).toMatch(/border-top\s*:\s*1px solid \$gray-2\s*;/);
        expect(row).toMatch(/border-bottom\s*:\s*1px solid \$gray-2\s*;/);
        expect(own(first('.stream-focus-figure + .stream-focus-figure')))
            .toMatch(/border-left\s*:\s*1px solid \$gray-2\s*;/);
    });

    it('draw nothing filled or rounded that could read as a button', () => {
        //
        // as boxes the graph's width, cut short to one line, they read as tabs
        // under /stream's rate buttons
        //
        expect(figure).not.toMatch(/background|border|radius/);
    });

    it('set each figure on one line, centered in its third, on one baseline', () => {
        expect(figure).toMatch(/align-items\s*:\s*baseline\s*;/);
        expect(figure).toMatch(/justify-content\s*:\s*center\s*;/);
        expect(figure).not.toMatch(/flex-direction\s*:\s*column/);
        expect(figure).toMatch(/padding\s*:\s*0\.55rem 1rem\s*;/);
    });

    it('draw each value at a phone\'s size, under a title\'s', () => {
        expect(own(first('.stream-focus-figure-value'))).toMatch(/font-size\s*:\s*1\.3rem\s*;/);
    });

    it('leave where they stand to the page that draws them (#230)', () => {
        expect(row).not.toMatch(PLACED);
    });
});

describe('the figures on a phone (#206)', () => {
    it('split the line in three even columns, with room between and no rules', () => {
        const row = own(last('.stream-focus-figures'));

        expect(row).toMatch(/display\s*:\s*grid\s*;/);
        expect(row).toMatch(/grid-template-columns\s*:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)\s*;/);
        expect(row).toMatch(/gap\s*:\s*0\.75rem\s*;/);
        expect(row).toMatch(/border\s*:\s*0\s*;/);
        expect(row).not.toMatch(PLACED);
    });

    it('keep each figure in a box, its name over its value, both centered', () => {
        const box = own(last('.stream-focus-figure'));

        expect(box).toMatch(/align-items\s*:\s*center\s*;/);
        expect(box).toMatch(/flex-direction\s*:\s*column\s*;/);
        expect(box).toMatch(/background-color\s*:\s*\$white-2\s*;/);
        expect(box).toMatch(/border\s*:\s*1px solid \$gray-2\s*;/);
        expect(box).toMatch(/border-radius\s*:\s*0\.75rem\s*;/);
        expect(box).toMatch(/padding\s*:\s*0\.6rem 0\.25rem\s*;/);
    });

    it('draw a name and a count in their shorter forms', () => {
        expect(own(first('.stream-focus-short'))).toMatch(/display\s*:\s*none\s*;/);
        expect(own(last('.stream-focus-long'))).toMatch(/display\s*:\s*none\s*;/);
        expect(own(last('.stream-focus-short'))).toMatch(/display\s*:\s*inline\s*;/);
    });
});

describe('the color a value is drawn in (#206)', () => {
    const tone = (name) => own(blocks(source, `.stream-focus-figure-${name}`)[0] || '');

    it('is the site\'s green for a figure at 95% or more', () => {
        expect(tone('good')).toMatch(/color\s*:\s*\$green-6\s*;/);
    });

    it('is the bars\' own red for a Health under it', () => {
        expect(tone('bad')).toMatch(/color\s*:\s*var\(--stream-missed\)\s*;/);
    });

    it('is /stream\'s darkest blue for a total, which is the bars, or a month\'s rows, added up (#230)', () => {
        expect(tone('total')).toMatch(/color\s*:\s*var\(--stream-shade-0\)\s*;/);
    });

    it('has a night color of its own for each, so the dark page draws them lighter', () => {
        const stream = read('_stream.scss');
        const [day] = blocks(stream, ':root');
        const [night] = blocks(stream, ':root[data-theme=\'dark\']');
        const theme = read('_theme.scss');

        expect(day).toMatch(/--stream-missed\s*:\s*#d03b3b\s*;/);
        expect(day).toMatch(/--stream-shade-0\s*:\s*#1c5cab\s*;/);
        expect(night).toMatch(/--stream-missed\s*:\s*#e66767\s*;/);
        expect(night).toMatch(/--stream-shade-0\s*:\s*#86b6ef\s*;/);
        expect(theme).toMatch(/'green-6'\s*:\s*\(\s*\$green-6\s*,\s*\$dark-green-6\s*\)/);
    });
});

describe('the info icon after a figure\'s name (#206)', () => {
    const [noted] = blocks(source, '.stream-focus-figures .stream-focus-noted');
    const [icon] = noted ? blocks(noted, 'svg') : [];

    it('is scoped by the row the figures are in, so /data\'s are drawn alike (#230)', () => {
        expect(noted).toBeDefined();
    });

    it('stays on the name\'s line', () => {
        expect(own(noted)).toMatch(/white-space\s*:\s*nowrap\s*;/);
    });

    it('is the name\'s size, a little off it, and sits on its line as /graph\'s does', () => {
        expect(icon).toMatch(/font-size\s*:\s*1em\s*;/);
        expect(icon).toMatch(/margin-left\s*:\s*0\.2em\s*;/);
        expect(icon).toMatch(/vertical-align\s*:\s*-0\.125em\s*;/);
    });

    it('takes no color of its own, so it is the name\'s gray', () => {
        expect(icon).not.toMatch(/(^|[^-])color\s*:/);
    });
});

describe('where the stylesheet draws them (#230)', () => {
    it('is one partial, which the stylesheet takes in', () => {
        expect(read('style.scss')).toMatch(/@import 'figure-boxes';/);
    });
});

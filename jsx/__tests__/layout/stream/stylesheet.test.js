/**
 * stylesheet.test.js: what /stream's stylesheet promises about a stream on its
 * own (#206, #208), its rows' grips, and a phone's rows (#218), read out of
 * '_stream.scss'.
 *
 * jsdom lays nothing out and resolves no stylesheet, so no suite can see where
 * the figures stand or the color a value is drawn in. What can be held is the
 * rule that decides them: the figures as one ruled row on a wide screen and as
 * boxes on a phone, the dates over the graph on a phone alone, the color of
 * each tone stream-focus.jsx gives a value, and the info icon after each name.
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
    return fs.readFileSync(path.resolve(__dirname, '../../../../scss', file), 'utf8').replace(/\/\/.*$/gm, '');
}

const source = read('_stream.scss');

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

describe('the figures of a stream on its own, on a wide screen (#208)', () => {
    const row = own(first('.stream-focus-figures'));
    const figure = own(first('.stream-focus-figure'));

    it('are one row as wide as the graph, in three even columns', () => {
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
        // under the rate's buttons
        //
        expect(figure).not.toMatch(/background|border|radius/);
    });

    it('set each figure on one line, centered in its third, on one baseline', () => {
        expect(figure).toMatch(/align-items\s*:\s*baseline\s*;/);
        expect(figure).toMatch(/justify-content\s*:\s*center\s*;/);
        expect(figure).not.toMatch(/flex-direction\s*:\s*column/);
        expect(figure).toMatch(/padding\s*:\s*0\.55rem 1rem\s*;/);
    });

    it('draw each value at a phone\'s size, under the title\'s', () => {
        expect(own(first('.stream-focus-figure-value'))).toMatch(/font-size\s*:\s*1\.3rem\s*;/);
    });

    it('leave no line of dates over the graph, which said nothing more', () => {
        //
        // its first date is the first under the bars, and the line under the
        // title says where the window ends
        //
        expect(own(first('.stream-focus-axis'))).toMatch(/display\s*:\s*none\s*;/);
    });
});

describe('the figures of a stream on its own, on a phone (#206)', () => {
    it('split the line in three even columns under the graph, with room between and no rules', () => {
        const row = own(last('.stream-focus-figures'));

        expect(row).toMatch(/display\s*:\s*grid\s*;/);
        expect(row).toMatch(/grid-template-columns\s*:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)\s*;/);
        expect(row).toMatch(/gap\s*:\s*0\.75rem\s*;/);
        expect(row).toMatch(/border\s*:\s*0\s*;/);
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

    it('keep the line of dates over the graph, the only dates a phone has', () => {
        expect(own(last('.stream-focus-axis'))).toMatch(/display\s*:\s*flex\s*;/);
        expect(own(last('.stream-focus-ticks'))).toMatch(/display\s*:\s*none\s*;/);
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

    it('is the bars\' darkest blue for Total Records, which is the bars added up', () => {
        expect(tone('total')).toMatch(/color\s*:\s*var\(--stream-shade-0\)\s*;/);
    });

    it('has a night color of its own for each, so the dark page draws them lighter', () => {
        const [day] = blocks(source, ':root');
        const [night] = blocks(source, ':root[data-theme=\'dark\']');
        const theme = read('_theme.scss');

        expect(day).toMatch(/--stream-missed\s*:\s*#d03b3b\s*;/);
        expect(day).toMatch(/--stream-shade-0\s*:\s*#1c5cab\s*;/);
        expect(night).toMatch(/--stream-missed\s*:\s*#e66767\s*;/);
        expect(night).toMatch(/--stream-shade-0\s*:\s*#86b6ef\s*;/);
        expect(theme).toMatch(/'green-6'\s*:\s*\(\s*\$green-6\s*,\s*\$dark-green-6\s*\)/);
    });
});

describe('the info icon after a figure\'s name (#206)', () => {
    const [noted] = blocks(source, '.stream-focus .stream-focus-noted');
    const [icon] = noted ? blocks(noted, 'svg') : [];

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

describe('the rest of a row, while a bar of it is pointed at (#216)', () => {
    const DIM = '.stream-row-bars.is-pointing .stream-bar-slot:not(.is-pointed) .stream-bar';

    it('dims every bar of the row but the one pointed at', () => {
        expect(own(first(DIM))).toMatch(/opacity\s*:\s*0\.45\s*;/);
    });

    it('fades a bar in and out, quickly', () => {
        expect(own(first('.stream-bar'))).toMatch(/transition\s*:\s*opacity 0\.1s ease\s*;/);
    });

    it('dims a bar nowhere else: not another row, and not a row that is not pointed into', () => {
        const dims = source.match(/[^{};]*\{[^{}]*opacity\s*:\s*0\.45[^{}]*\}/g) || [];

        expect(dims.map((rule) => rule.split('{')[0].trim())).toEqual([DIM]);
        expect(own(first('.stream-row-bars'))).not.toMatch(/opacity/);
        expect(own(first('.stream-bar-slot'))).not.toMatch(/opacity/);
    });
});

describe('the Stream heading, which sorts by name (#216)', () => {
    it('stands at the start of its column, where the names are', () => {
        const heading = own(first('.stream-rows-head-name.stream-rows-sort'));

        expect(heading).toMatch(/justify-content\s*:\s*flex-start\s*;/);
        expect(heading).toMatch(/justify-self\s*:\s*start\s*;/);
    });
});

describe('the grip a row is dragged by (#218)', () => {
    const grip = own(first('.stream-row-grip-button'));

    it('takes a column of its own at the start of a wide screen\'s rows, folded or not', () => {
        const [folded] = blocks(source, '.stream-rows-folded');

        expect(own(first('.stream-row'))).toMatch(
            /grid-template-columns\s*:\s*1\.75rem 14rem 5\.5rem minmax\(0,\s*1fr\) 0 var\(--stream-figures-at\)\s*;/
        );
        expect(own(blocks(folded, '.stream-row')[0])).toMatch(
            /grid-template-columns\s*:\s*1\.75rem 14rem 5\.5rem minmax\(0,\s*1fr\)\s*;/
        );
        expect(own(first('.stream-rows-head-name'))).toMatch(/grid-column\s*:\s*2 \/ 4\s*;/);
        expect(own(first('.stream-row-figures'))).toMatch(/grid-column\s*:\s*6\s*;/);
    });

    it('is /data\'s grip, which a finger drags rather than scrolls', () => {
        expect(grip).toMatch(/width\s*:\s*1\.75rem\s*;/);
        expect(grip).toMatch(/color\s*:\s*\$gray-5\s*;/);
        expect(grip).toMatch(/touch-action\s*:\s*none\s*;/);
        expect(grip).toMatch(/cursor\s*:\s*grab\s*;/);
    });
});

describe('a phone\'s rows, a table of their own (#218)', () => {
    const [phone] = blocks(source, '@media (max-width: 767.98px)');
    const within = (header) => blocks(phone, header);

    it('sit in /data\'s frame, which keeps the stripes and the header\'s tint inside its corners', () => {
        const frame = own(within('.stream-rows-table').find((block) => /border\s*:/.test(block)) || '');

        expect(frame).toMatch(/border\s*:\s*1px solid \$gray-2\s*;/);
        expect(frame).toMatch(/border-radius\s*:\s*0\.5rem\s*;/);
        expect(frame).toMatch(/overflow\s*:\s*hidden\s*;/);
    });

    it('are headed in /data\'s header\'s look, folded figures or not', () => {
        const [head] = within('.stream-rows-folded .stream-rows-head');
        const [night] = blocks(head, '@include dark');

        expect(own(head)).toMatch(/background-color\s*:\s*\$form-panel\s*;/);
        expect(own(head)).toMatch(/border-bottom\s*:\s*1px solid \$gray-2\s*;/);
        expect(own(head)).toMatch(/color\s*:\s*\$graph-panel-label\s*;/);
        expect(own(head)).toMatch(/font-weight\s*:\s*600\s*;/);
        expect(own(head)).toMatch(/height\s*:\s*2\.6rem\s*;/);
        expect(own(head)).toMatch(/grid-template-areas\s*:\s*'grip name pick chevron'\s*;/);
        expect(night).toMatch(/background-color\s*:\s*\$dark-form-panel\s*;/);
        expect(night).toMatch(/color\s*:\s*\$gray-6\s*;/);
    });

    it('head only the figure the rows show, beside Stream', () => {
        const [hidden] = within('.stream-rows-head-figures > .stream-rows-sort:not(.stream-rows-head-pick)');

        expect(own(hidden)).toMatch(/display\s*:\s*none\s*;/);
        expect(own(within('.stream-rows-head .stream-rows-head-figures')[0])).toMatch(/display\s*:\s*flex\s*;/);
    });

    it('raise the grip over the link stretched across a row, so a finger on it drags', () => {
        const [grip] = within('.stream-row-grip-button');

        expect(own(grip)).toMatch(/position\s*:\s*relative\s*;/);
        expect(own(grip)).toMatch(/z-index\s*:\s*1\s*;/);
        expect(own(grip)).toMatch(/height\s*:\s*2\.25rem\s*;/);
    });

    it('stripe every other row of their own box, the header not counted', () => {
        const [striped] = within('.stream-rows-body > .stream-row:nth-of-type(even)');

        expect(own(striped)).toMatch(/background-color\s*:\s*rgba\(var\(--ink-rgb\),\s*0\.03\)\s*;/);
        expect(source).not.toMatch(/nth-of-type\(odd\)/);
    });

    it('leave Reset order to the sort button\'s menu, hiding a wide screen\'s pill', () => {
        const [hidden] = within('.stream-reset');

        expect(own(hidden)).toMatch(/display\s*:\s*none\s*;/);
        expect(own(first('.stream-reset'))).toMatch(/border-radius\s*:\s*999px\s*;/);
    });
});


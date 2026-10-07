/**
 * stylesheet.test.js: what /stream's stylesheet promises about a stream on its
 * own (#206, #208), its rows' grips, a phone's rows (#218), and a phone's line
 * of controls, which keeps to one line on every phone (#222, #224), read out of
 * '_stream.scss'.
 *
 * jsdom lays nothing out and resolves no stylesheet, so no suite can see where
 * the figures stand. What can be held is the rule that decides it: the figures
 * over the graph on a wide screen and under it on a phone, and the dates over
 * the graph on a phone alone. How the figures look -- one ruled row, or boxes,
 * the color of each tone, the info icon after each name -- is the boxes' own,
 * since /data draws them too: see figure-boxes-stylesheet.test.js (#230).
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

describe('a stream on its own, on a wide screen (#208)', () => {
    it('sets its figures 1.25rem over the graph, how they look being the boxes\' own (#230)', () => {
        expect(own(first('.stream-focus .stream-focus-figures'))).toMatch(/margin-bottom\s*:\s*1\.25rem\s*;/);
    });

    it('leaves no line of dates over the graph, which said nothing more', () => {
        //
        // its first date is the first under the bars, and the line under the
        // title says where the window ends
        //
        expect(own(first('.stream-focus-axis'))).toMatch(/display\s*:\s*none\s*;/);
    });
});

describe('a stream on its own, on a phone (#206)', () => {
    it('sets its figures under the graph, 1rem from it', () => {
        const row = own(last('.stream-focus .stream-focus-figures'));

        expect(row).toMatch(/margin\s*:\s*1rem 0 0\s*;/);
        expect(row).toMatch(/order\s*:\s*3\s*;/);
    });

    it('keeps the line of dates over the graph, the only dates a phone has', () => {
        expect(own(last('.stream-focus-axis'))).toMatch(/display\s*:\s*flex\s*;/);
        expect(own(last('.stream-focus-ticks'))).toMatch(/display\s*:\s*none\s*;/);
    });
});

describe('the figures\' boxes, which /data draws too (#230)', () => {
    it('look as \'_figure-boxes.scss\' draws them, not as this partial does', () => {
        //
        // how they look is held by figure-boxes-stylesheet.test.js
        //
        expect(source).not.toMatch(/(^|\s)\.stream-focus-figure\s*\{/);
        expect(source).not.toMatch(/\.stream-focus-figure-(good|bad|total)/);
        expect(source).not.toMatch(/\.stream-focus-(noted|long|short)/);
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

describe('the window menu between a phone\'s arrows (#222)', () => {
    const [phone] = blocks(source, '@media (max-width: 767.98px)');
    const within = (header) => blocks(phone, header);
    const holding = (header, pattern) => own(within(header).find((block) => pattern.test(own(block))) || '');

    it('is hidden on a wide screen, and drawn as the rate\'s menu is', () => {
        const [shared] = blocks(source, '.stream-window-menu');

        expect(own(shared)).toMatch(/display\s*:\s*none\s*;/);
        expect(blocks(shared, 'select')[0]).toMatch(/border-radius\s*:\s*999px\s*;/);
        expect(holding('.stream-window-menu', /display\s*:\s*flex/)).toMatch(/display\s*:\s*flex\s*;/);
    });

    it('is slim at its sides, with room left before its arrow, and the rate\'s menu is too (#224)', () => {
        const slim = holding('.stream-window-menu select', /padding\s*:/);

        expect(slim).toMatch(/padding\s*:\s*0 calc\(1\.7 \* var\(--fit-rem\)\) 0 calc\(0\.6 \* var\(--fit-rem\)\)\s*;/);
        expect(slim).toMatch(/background-position\s*:\s*right calc\(0\.55 \* var\(--fit-rem\)\) center\s*;/);
        expect(phone).toMatch(/\.stream-rate-menu select,\s*\.stream-window-menu select\s*\{[^{}]*padding\s*:/);
    });

    it('fills the line\'s spare room, so the arrows stay put as its label changes', () => {
        expect(holding('.stream-window-menu', /flex\s*:/)).toMatch(/flex\s*:\s*1 1 auto\s*;/);
        expect(holding('.stream-window-menu select', /width\s*:/)).toMatch(/width\s*:\s*100%\s*;/);
    });

    it('takes Now\'s place, since its first choice is the window ending now', () => {
        expect(own(within('.stream-now')[0])).toMatch(/display\s*:\s*none\s*;/);
    });
});

describe('a phone\'s line of controls, one line on every phone (#224)', () => {
    const [phone] = blocks(source, '@media (max-width: 767.98px)');
    const within = (header) => blocks(phone, header);
    const holding = (header, pattern) => own(within(header).find((block) => pattern.test(own(block))) || '');

    it('is a fit row: the line needs 23.25rem, and a stream on its own 25.25rem', () => {
        expect(holding('.stream-rows-bar', /'intro links'/)).toMatch(/@include fit-row\(23\.25\)\s*;/);
        expect(own(within('.stream-layout-focused .stream-rows-bar')[0])).toMatch(/@include fit-row\(25\.25\)\s*;/);
    });

    it('keeps to one line below 375px too, where it broke in two', () => {
        expect(blocks(source, '@media (max-width: 374.98px)')).toEqual([]);
    });

    it('sizes the menus, the arrows, the sort\'s button and their gaps in --fit-rem', () => {
        const round = holding('.stream-sort', /height\s*:/);

        expect(holding('.stream-window-menu', /font-size\s*:/)).toMatch(/font-size\s*:\s*calc\(0\.85 \* var\(--fit-rem\)\)\s*;/);
        expect(holding('.stream-window-menu select', /min-height\s*:/)).toMatch(/min-height\s*:\s*calc\(2\.75 \* var\(--fit-rem\)\)\s*;/);
        expect(phone).toMatch(/\.stream-page,\s*\.stream-sort\s*\{/);
        expect(round).toMatch(/height\s*:\s*calc\(2\.75 \* var\(--fit-rem\)\)\s*;/);
        expect(round).toMatch(/width\s*:\s*calc\(2\.75 \* var\(--fit-rem\)\)\s*;/);
        expect(round).toMatch(/font-size\s*:\s*calc\(1\.4 \* var\(--fit-rem\)\)\s*;/);
        expect(holding('.stream-controls', /gap\s*:/)).toMatch(/gap\s*:\s*calc\(0\.5 \* var\(--fit-rem\)\)\s*;/);
        expect(holding('.stream-pager', /gap\s*:/)).toMatch(/gap\s*:\s*calc\(0\.4 \* var\(--fit-rem\)\)\s*;/);
    });

    it('never squeezes an arrow into an oval', () => {
        expect(holding('.stream-page', /flex-shrink\s*:/)).toMatch(/flex-shrink\s*:\s*0\s*;/);
    });

    it('puts a stream on its own on one row: the rate\'s menu, the pager and the icons', () => {
        const focused = own(within('.stream-layout-focused .stream-rows-bar')[0]);

        expect(focused).toMatch(/grid-template-areas\s*:\s*'back back back'\s*'intro intro intro'\s*'rate pager links'\s*;/);
        expect(focused).toMatch(/grid-template-columns\s*:\s*auto minmax\(0,\s*1fr\) auto\s*;/);
        expect(focused).toMatch(/column-gap\s*:\s*0\s*;/);
        expect(own(within('.stream-layout-focused .stream-controls')[0])).toMatch(/display\s*:\s*contents\s*;/);
        expect(own(within('.stream-layout-focused .stream-pager')[0]))
            .toMatch(/margin\s*:\s*0 calc\(0\.4 \* var\(--fit-rem\)\)\s*;/);
    });

    it('sets a stream on its own\'s icons 0.25rem apart, sized in --fit-rem', () => {
        const [links] = within('.stream-layout-focused .stream-api-links');

        expect(own(links)).toMatch(/gap\s*:\s*calc\(0\.25 \* var\(--fit-rem\)\)\s*;/);
        expect(blocks(links, 'svg')[0]).toMatch(/font-size\s*:\s*calc\(1\.5 \* var\(--fit-rem\)\)\s*;/);
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

    it('say a first wait by the spinner alone, so no row grows while the page opens (#220)', () => {
        //
        // a line under each name made every row taller until its report came
        // in, and the table shrank to shape as they did
        //
        const [quiet] = within('.stream-row .stream-row-status-loading');

        expect(own(quiet)).toMatch(/display\s*:\s*none\s*;/);
        expect(within('.stream-row .stream-row-status-slow')).toHaveLength(0);
        expect(within('.stream-row .stream-row-status-failed')).toHaveLength(0);
    });

    it('leave Reset order to the sort button\'s menu, hiding a wide screen\'s pill', () => {
        const [hidden] = within('.stream-reset');

        expect(own(hidden)).toMatch(/display\s*:\s*none\s*;/);
        expect(own(first('.stream-reset'))).toMatch(/border-radius\s*:\s*999px\s*;/);
    });
});


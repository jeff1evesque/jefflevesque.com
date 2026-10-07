/**
 * cube-stylesheet.test.js: what '_cube_rows.scss' promises about a phone's rows
 * of cubes, and '_cube_chart.scss' about the tooltip's '+N more' (#188).
 *
 * jsdom lays nothing out, so no suite can see how tall a row stands or what the
 * pointer reaches. What can be held is the rules that decide them.
 *
 * And about the stack over the chart on a phone (#185): the page draws the api
 * icons in its month row below a tablet's width, so the rows' own copy is
 * hidden there, and the blocks over the chart keep room between them.
 *
 * And about a month of stock splits banded by sector (#190): the legend over
 * the chart, and the heads a day's tickers sit under.
 *
 * And about the month on a phone, beside the listing's title and in a
 * dataset's row with the icons, on one line on every phone (#224), across a
 * dataset's row (#230).
 *
 * Note: read the way navigation/stylesheet.test.js reads its partials:
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

describe('a phone\'s rows (#188)', () => {
    const rows = read('_cube_rows.scss');
    const [row] = blocks(rows, '.cube-rows-row');

    it('stand a fingertip tall, each', () => {
        expect(row).toMatch(/min-height\s*:\s*44px\s*;/);
    });

    it('set a row\'s name, count and share on a line over its bar', () => {
        expect(row).toMatch(/grid-template-areas\s*:\s*'name count share'\s*'bar bar bar'\s*;/);
    });

    it('hold the share\'s column one width on every row, room for its title and a figure like 6.6%, so the counts line up (#192)', () => {
        expect(rows).toMatch(/\$cube-rows-share\s*:\s*3\.8rem\s*;/);
        expect(row).toMatch(/grid-template-columns\s*:\s*minmax\(0, 1fr\) auto \$cube-rows-share\s*;/);
    });

    it('run the arrow down the end of every row of a list where any opens, so a row that opens nothing lines up', () => {
        const [arrows] = blocks(rows, '.cube-rows-list.has-arrows .cube-rows-row');

        expect(arrows).toMatch(/grid-template-areas\s*:\s*'name count share arrow'\s*'bar bar bar arrow'\s*;/);
        expect(arrows).toMatch(/grid-template-columns\s*:\s*minmax\(0, 1fr\) auto \$cube-rows-share 1\.5rem\s*;/);
        expect(blocks(row, '&.is-opening')[0]).toMatch(/cursor\s*:\s*pointer\s*;/);
    });

    it('stripe every other row a faint gray, as the site\'s phone tables are (#145)', () => {
        const [even] = blocks(rows, '.cube-rows-list > li:nth-child(even) .cube-rows-row');

        expect(even).toMatch(/background-color\s*:\s*rgba\(var\(--ink-rgb\), 0\.03\)\s*;/);
    });

    it('end a long list in a button a row\'s height', () => {
        const [more] = blocks(rows, '.cube-rows-more');

        expect(more).toMatch(/min-height\s*:\s*44px\s*;/);
        expect(more).toMatch(/width\s*:\s*100%\s*;/);
    });

    it('set a day\'s tickers three to a line', () => {
        const [tickers] = blocks(rows, '.cube-rows-tickers');

        expect(tickers).toMatch(/grid-template-columns\s*:\s*repeat\(3, minmax\(0, 1fr\)\)\s*;/);
    });

    it('sit the loader over the top of the rows, not their middle, and let the pointer through it', () => {
        const [overlay] = blocks(rows, '.cube-rows-overlay');

        expect(overlay).toMatch(/(^|[\s;{])top\s*:\s*0\s*;/);
        expect(overlay).toMatch(/max-height\s*:\s*24rem\s*;/);
        expect(overlay).toMatch(/pointer-events\s*:\s*none\s*;/);
    });

    it('hide their own api icons below a tablet\'s width, whose month row carries them (#185)', () => {
        const [phone] = blocks(rows, '@media (max-width: 767.98px)');

        expect(blocks(phone, '.cube-rows-actions')[0]).toMatch(/display\s*:\s*none\s*;/);
    });
});

describe('a month banded by sector (#190)', () => {
    const rows = read('_cube_rows.scss');
    const chart = read('_cube_chart.scss');

    it('wrap the sectors\' legend over a phone\'s rows, and keep none over a wide screen\'s chart (#192)', () => {
        expect(blocks(rows, '.cube-rows-legend')[0]).toMatch(/flex-wrap\s*:\s*wrap\s*;/);
        expect(chart).not.toMatch(/cube-chart-legend/);
    });

    it('mark the sector pointed at among the popup\'s rows (#192)', () => {
        const [tip] = blocks(chart, '.cube-chart-tip-row');

        expect(blocks(tip, '&.is-lit')[0]).toMatch(/font-weight\s*:\s*600\s*;/);
    });

    it('head a day\'s tickers with their sectors: one under another on a phone, down the list\'s columns on a wide screen', () => {
        const [sector] = blocks(chart, '.cube-list-sector');

        expect(blocks(rows, '.cube-rows-sectors')[0]).toMatch(/flex-direction\s*:\s*column\s*;/);
        expect(blocks(chart, '.cube-list-sectors')[0]).toMatch(/column-gap\s*:\s*2rem\s*;/);
        expect(sector).toMatch(/break-inside\s*:\s*avoid\s*;/);
        expect(blocks(sector, '&.is-long')[0]).toMatch(/break-inside\s*:\s*auto\s*;/);
        expect(blocks(chart, '.cube-list-sector-head')[0]).toMatch(/break-after\s*:\s*avoid\s*;/);
    });

    it('mark a sector\'s head on a wide screen while its band is lit, as a row is', () => {
        const [head] = blocks(chart, '.cube-list-sector-head');

        expect(blocks(head, '&.is-lit')[0]).toMatch(/background\s*:\s*rgba\(var\(--ink-rgb\), 0\.06\)\s*;/);
        expect(blocks(head, '.cube-list-name')[0]).toMatch(/flex\s*:\s*0 1 auto\s*;/);
    });
});

describe('the rows\' titles (#192)', () => {
    const rows = read('_cube_rows.scss');
    const [titles] = blocks(rows, '.cube-rows-titles');

    it('take the rows\' own columns, so each title sits over its own', () => {
        expect(titles).toMatch(/grid-template-columns\s*:\s*minmax\(0, 1fr\) auto \$cube-rows-share\s*;/);
        expect(blocks(titles, '&.has-arrows')[0]).toMatch(/grid-template-columns\s*:\s*minmax\(0, 1fr\) auto \$cube-rows-share 1\.5rem\s*;/);
        expect(blocks(titles, '.cube-rows-title-count')[0]).toMatch(/justify-self\s*:\s*end\s*;/);
        expect(blocks(titles, '.cube-rows-title-share')[0]).toMatch(/justify-self\s*:\s*end\s*;/);
    });

    it('stay in sight while the rows scroll, over them, and 57px down under a phone\'s pinned bar', () => {
        const [phone] = blocks(read('_navigation_anonymous.scss'), '.cube-rows-titles');

        expect(titles).toMatch(/position\s*:\s*sticky\s*;/);
        expect(titles).toMatch(/(^|[\s;{])top\s*:\s*0\s*;/);
        expect(titles).toMatch(/background-color\s*:\s*\$white-1\s*;/);
        expect(phone).toMatch(/top\s*:\s*57px\s*;/);
    });

    it('stand a fingertip tall, each title a button', () => {
        expect(blocks(titles, '.cube-rows-sort')[0]).toMatch(/min-height\s*:\s*44px\s*;/);
    });
});

describe('the listing\'s name cells (#196)', () => {
    it('stay table cells, vertically centered in their rows, outside a phone\'s cards', () => {
        //
        // the title's wrapper once shared their class, and its flex made every
        // row's name sit at the top of its row on a wide screen
        //
        const article = read('_article.scss');
        const outside = blocks(article, '.small-viewport').reduce((text, block) => text.replace(block, ''), article);

        expect(blocks(outside, '.listing-table-name').some((block) => /display\s*:/.test(block))).toBe(false);
        expect(blocks(article, '.listing-table-title-name')[0]).toMatch(/display\s*:\s*flex\s*;/);
    });
});

describe('the listing\'s title row on a wide screen (#194)', () => {
    const wide = blocks(read('_article.scss'), '.large-viewport .listing-table')
        .find((block) => block.includes('.listing-table-head.has-actions'));

    it('is three columns where it carries the page\'s own control, the control centered in the middle one', () => {
        expect(blocks(wide, '.listing-table-head.has-actions')[0])
            .toMatch(/grid-template-columns\s*:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\)\s*;/);
        expect(blocks(wide, '.listing-table-head.has-actions .listing-table-title')[0]).toMatch(/display\s*:\s*contents\s*;/);
        expect(blocks(wide, '.listing-table-head.has-actions .listing-table-actions')[0]).toMatch(/justify-self\s*:\s*center\s*;/);
        expect(blocks(wide, '.listing-table-head.has-actions .listing-table-tools')[0]).toMatch(/justify-self\s*:\s*end\s*;/);
    });

    it('sets Reset order a rem apart from the filter beside it, where half that ran them together (#220)', () => {
        const tools = blocks(wide, '.listing-table-tools').find((block) => /gap\s*:/.test(block));

        expect(tools).toMatch(/gap\s*:\s*1rem\s*;/);
    });
});

describe('the listing\'s None pill (#192)', () => {
    it('is outlined: a gray edge around the page\'s own color, drawn inside it', () => {
        const [off] = blocks(read('_article.scss'), '.listing-table-pill-off');

        expect(off).toMatch(/background-color\s*:\s*\$white-1\s*;/);
        expect(off).toMatch(/box-shadow\s*:\s*inset 0 0 0 1px \$gray-5\s*;/);
    });
});

describe('the stack over the chart on a phone (#185)', () => {
    it('keeps 1.25rem under the green bar, 0.75rem under the name and 1.25rem under the month row', () => {
        const [back] = blocks(read('_back-bar.scss'), '.data-back-row');
        const article = read('_article.scss');
        const [month] = blocks(article, '.filter-month');
        const [under] = blocks(article, '.data-listing .listing-graphic > .filter.filter-month');

        expect(back).toMatch(/margin\s*:\s*0\.5rem 0 1\.25rem\s*;/);
        expect(month).toMatch(/gap\s*:\s*0\.75rem\s*;/);
        expect(under).toMatch(/margin-bottom\s*:\s*1\.25rem\s*;/);
    });

    it('lays the month and the icons across the row, the icons at its end', () => {
        const [row] = blocks(read('_article.scss'), '.data-month-row');

        expect(row).toMatch(/display\s*:\s*flex\s*;/);
        expect(row).toMatch(/justify-content\s*:\s*space-between\s*;/);
        expect(row).toMatch(/align-items\s*:\s*center\s*;/);
    });
});

describe('the month on a phone, on one line on every phone (#224)', () => {
    const article = read('_article.scss');
    const [phone] = blocks(article, '@media (max-width: 767.98px)');
    const within = (header) => blocks(phone || '', header)[0] || '';

    it('sits beside the listing\'s title, and takes the rest of its row', () => {
        const title = within('.listing-table .listing-table-title.has-actions');
        const actions = within('.listing-table .listing-table-actions');

        expect(title).toMatch(/flex-wrap\s*:\s*nowrap\s*;/);
        expect(title).toMatch(/column-gap\s*:\s*0\.5rem\s*;/);
        expect(actions).toMatch(/flex\s*:\s*1 1 0\s*;/);
        expect(actions).toMatch(/min-width\s*:\s*0\s*;/);
        expect(actions).toMatch(/justify-content\s*:\s*flex-end\s*;/);
    });

    it('is a fit row: 18.25rem beside the title, and 22.25rem with a dataset\'s icons', () => {
        expect(within('.listing-table .listing-table-actions')).toMatch(/@include fit-row\(18\.25\)\s*;/);
        expect(within('.data-month-row')).toMatch(/@include fit-row\(22\.25\)\s*;/);
    });

    it('sizes the arrows, the menu and the icons in --fit-rem', () => {
        const step = within('.data-month-step');
        const menu = within('.data-month-menu select');
        const row = within('.data-month-row');

        expect(step).toMatch(/height\s*:\s*calc\(2\.75 \* var\(--fit-rem\)\)\s*;/);
        expect(step).toMatch(/width\s*:\s*calc\(2\.75 \* var\(--fit-rem\)\)\s*;/);
        expect(step).toMatch(/font-size\s*:\s*calc\(1\.4 \* var\(--fit-rem\)\)\s*;/);
        expect(menu).toMatch(/min-height\s*:\s*calc\(2\.75 \* var\(--fit-rem\)\)\s*;/);
        expect(menu).toMatch(/padding\s*:\s*0 calc\(1\.9 \* var\(--fit-rem\)\) 0 calc\(0\.9 \* var\(--fit-rem\)\)\s*;/);
        expect(within('.data-month')).toMatch(/gap\s*:\s*calc\(0\.4 \* var\(--fit-rem\)\)\s*;/);
        expect(blocks(row, '.api-links svg')[0]).toMatch(/font-size\s*:\s*calc\(1\.5 \* var\(--fit-rem\)\)\s*;/);
    });

    it('keeps the menu\'s 16px wherever the row has the room, the least an iPhone focuses without zooming', () => {
        const [menu] = blocks(article, '.data-month-menu');

        expect(blocks(menu, 'select')[0]).toMatch(/font-size\s*:\s*16px\s*;/);
        expect(within('.data-month-menu select')).toMatch(/font-size\s*:\s*calc\(16 \/ 14 \* var\(--fit-rem\)\)\s*;/);
    });
});

describe('a dataset\'s month across its row on a phone (#230)', () => {
    const article = read('_article.scss');
    const [phone] = blocks(article, '@media (max-width: 767.98px)');
    const within = (header) => blocks(phone || '', header)[0] || '';

    it('grows the month and its menu to fill the row, as /stream\'s window menu fills its line (#222)', () => {
        expect(phone).toMatch(/\.data-month-row \.data-month,\s*\.data-month-row \.data-month-menu\s*\{/);

        const grows = within('.data-month-row .data-month-menu');

        expect(grows).toMatch(/flex\s*:\s*1 1 auto\s*;/);
        expect(grows).toMatch(/min-width\s*:\s*0\s*;/);
    });

    it('stretches the menu across the room it takes', () => {
        const select = within('.data-month-row .data-month-menu select');

        expect(select).toMatch(/width\s*:\s*100%\s*;/);
        expect(select).toMatch(/min-width\s*:\s*0\s*;/);
    });

    it('leaves the listing\'s month, beside its title, its own width', () => {
        expect(within('.data-month')).not.toMatch(/flex\s*:/);
        expect(within('.data-month-menu select')).not.toMatch(/(^|[^-])width\s*:/);
    });

    it('keeps the row a fit row, so a phone without the room sees it smaller (#224)', () => {
        expect(within('.data-month-row')).toMatch(/@include fit-row\(22\.25\)\s*;/);
    });
});

describe('the tooltip\'s +N more (#188)', () => {
    const chart = read('_cube_chart.scss');

    it('lets the pointer through the rest of the tooltip, to the cubes under it', () => {
        const [tip] = blocks(chart, '.cube-chart-tip');

        expect(tip).toMatch(/pointer-events\s*:\s*none\s*;/);
    });

    it('takes the pointer itself, and reads as a link', () => {
        const [more] = blocks(chart, '.cube-chart-tip-more');

        expect(more).toMatch(/pointer-events\s*:\s*auto\s*;/);
        expect(more).toMatch(/cursor\s*:\s*pointer\s*;/);
        expect(more).toMatch(/color\s*:\s*\$blue-hyperlink\s*;/);
        expect(more).toMatch(/text-decoration\s*:\s*underline\s*;/);
    });
});

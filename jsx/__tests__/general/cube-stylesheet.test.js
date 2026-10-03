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

    it('hold the share\'s column wide enough for a figure like 6.6%, so every row\'s count ends in one place', () => {
        expect(row).toMatch(/grid-template-columns\s*:\s*minmax\(0, 1fr\) auto minmax\(2\.6rem, auto\)\s*;/);
    });

    it('run the arrow down the end of every row of a list where any opens, so a row that opens nothing lines up', () => {
        const [arrows] = blocks(rows, '.cube-rows-list.has-arrows .cube-rows-row');

        expect(arrows).toMatch(/grid-template-areas\s*:\s*'name count share arrow'\s*'bar bar bar arrow'\s*;/);
        expect(arrows).toMatch(/grid-template-columns\s*:\s*minmax\(0, 1fr\) auto minmax\(2\.6rem, auto\) 1\.5rem\s*;/);
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

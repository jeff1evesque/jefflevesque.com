/**
 * sunburst-stylesheet.test.js: what '_sunburst.scss' promises about the list
 * under the ring on a phone.
 *
 * jsdom lays nothing out, so no suite can see where the list stops. What can be
 * held is the rule that decides it: on a phone the list runs its whole length
 * with the page, rather than scrolling in a box of its own -- which, with no
 * scrollbar on a phone to say there was more, read as the end of the list six
 * days into a month of twenty.
 *
 * And about the stack over the ring on a phone (#185): the page draws the api
 * icons in its month row below a tablet's width, so the head over the ring,
 * which holds only the ring's copy, is hidden there, and the blocks over the
 * ring keep room between them.
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

describe('the list on a phone', () => {
    const [phone] = blocks(read('_sunburst.scss'), '.sunburst-phone');
    const [list] = phone ? blocks(phone, '.sunburst-list') : [];

    it('is laid out by a rule of its own', () => {
        expect(list).toBeDefined();
    });

    it('runs its whole length with the page, in no box of its own', () => {
        expect(list).toMatch(/overflow-y\s*:\s*visible\s*;/);
        expect(list).not.toMatch(/max-height/);
    });
});

describe('the stack over the ring on a phone (#185)', () => {
    const sunburst = read('_sunburst.scss');
    const [phone] = blocks(sunburst, '@media (max-width: 767.98px)');

    it('hides the head over the ring below a tablet\'s width, whose api icons the month row carries', () => {
        expect(blocks(phone, '.sunburst-phone .sunburst-head')[0]).toMatch(/display\s*:\s*none\s*;/);
    });

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

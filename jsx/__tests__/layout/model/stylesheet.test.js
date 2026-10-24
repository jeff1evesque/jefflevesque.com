/**
 * stylesheet.test.js: what '_model.scss' promises about a row of /model's list --
 * its columns, the bell's among them (#255, #259) -- about the pill of a model
 * taken down (#263), about where loss's three parts go on a model's page (#265),
 * about the rows that page's three cards share (#267), about a phone's
 * controls, their dropdowns and the room around them (#272), about a phone's
 * card, the arrow before how a score stands, and what both pages hold while the
 * listing is on its way (#274), and about loss's three parts in /model's list,
 * the score last, and a list too narrow for its columns (#283), read out of the
 * partial.
 *
 * jsdom lays nothing out and resolves no stylesheet, so no suite can see which
 * column a cell lands in. A wide screen places a row's cells by their order, so
 * what can be held is that the columns come in the order the cells do -- see
 * model-row.test.jsx -- with the bell's 2.5rem third, after the model's name, as a
 * /stream row's bell comes after the stream's name. A phone's card places each
 * cell by name instead, so its bell is held at the card's top right whatever the
 * order.
 *
 * Note: read the way layout/stream/stylesheet.test.js reads '_stream.scss': the
 *       comments taken out, and each rule found by its selectors.
 */

import fs from 'fs';
import path from 'path';
import { chartColors } from '../../../import/layout/model/scores.js';

const source = fs.readFileSync(path.resolve(__dirname, '../../../../scss/_model.scss'), 'utf8')
    .replace(/\/\/.*$/gm, '');

//
// every rule holding no rule of its own, as its selectors and its declarations
//
const RULES = (source.match(/[^{};]*\{[^{}]*\}/g) || []).map((rule) => ({
    selectors: rule.split('{')[0].split(',').map((selector) => selector.trim()),
    body: rule.slice(rule.indexOf('{') + 1, -1),
}));

function declared(rule, property) {
    const found = rule ? rule.body.match(new RegExp(`(^|;|\\s)${property}\\s*:\\s*([^;]+);`)) : null;

    return found ? found[2].replace(/\s+/g, ' ').trim() : null;
}

//
// a grid's tracks, one per column: 'minmax(12rem, 2fr)' is one
//
function tracks(value) {
    return value.match(/minmax\([^)]*\)|\S+/g);
}

describe('a row of the list, on a wide screen', () => {
    const grid = RULES.find((rule) => rule.selectors.join() === '.model-list-head,.model-row');

    it('heads the columns with the rows\' own grid, so each heading stays over its column', () => {
        expect(declared(grid, 'display')).toBe('grid');
    });

    it('has a column for each of a row\'s seven cells', () => {
        expect(tracks(declared(grid, 'grid-template-columns'))).toHaveLength(7);
    });

    it('gives the bell its 2.5rem third, after the model\'s name, as /stream does (#259)', () => {
        //
        // the model's name and description take the second, the one that grows.
        // The bell's was last, at the far right, where /stream has a row's figures
        //
        const [compare, model, bell] = tracks(declared(grid, 'grid-template-columns'));

        expect(compare).toBe('4.5rem');
        expect(model).toBe('minmax(12rem, 2fr)');
        expect(bell).toBe('2.5rem');
    });

    it('puts the live version, the attempts and the 60-day line after the bell, and the score last (#283)', () => {
        const [, , , live, went, trend, score] = tracks(declared(grid, 'grid-template-columns'));

        expect([live, went, trend]).toEqual(['8rem', '6rem', '140px']);
        expect(score).toBe('minmax(9rem, 1fr)');
    });
});

describe('the status pill of a model taken down (#263)', () => {
    //
    // '--stream-missed' as '_stream.scss' sets it, by day and by night
    //
    const stream = fs.readFileSync(path.resolve(__dirname, '../../../../scss/_stream.scss'), 'utf8');
    const missed = (block) => stream.match(new RegExp(`${block}\\s*\\{[^}]*--stream-missed:\\s*([^;]+);`))[1].trim();

    it('draws its dot in the red the charts draw worse in, in either theme', () => {
        const dot = RULES.find((rule) => rule.selectors.join() === '.model-pill-down .model-pill-dot');

        expect(declared(dot, 'background-color')).toBe('var(--stream-missed)');
        expect(missed(':root')).toBe(chartColors('light').worse);
        expect(missed(':root\\[data-theme=\'dark\'\\]')).toBe(chartColors('dark').worse);
    });
});

describe('a row on a phone, as a card', () => {
    const card = RULES.find((rule) => rule.selectors.join() === '.model-row' && declared(rule, 'grid-template-areas'));
    const placed = (cell) => declared(RULES.find((rule) => rule.selectors.join() === `.model-cell-${cell}`
        && declared(rule, 'grid-area')), 'grid-area');

    it('places each cell by name, so a row\'s order on a wide screen moves nothing on it', () => {
        ['compare', 'score', 'trend', 'live', 'went', 'alarm'].forEach((cell) => {
            expect({ cell, area: placed(cell) }).toEqual({ cell, area: cell });
        });
    });

    it('keeps its bell at the top right, after the box that ticks it, on the name\'s line (#274)', () => {
        const [top] = declared(card, 'grid-template-areas').match(/'[^']*'/g);

        expect(top).toBe('\'name name name compare alarm\'');
    });
});

describe('a phone\'s card (#274)', () => {
    //
    // the rule for a selector that declares a property: a phone's rules repeat
    // selectors the wide screen's declare other things under
    //
    const rule = (selector, property) => RULES.find((each) => each.selectors.join() === selector && declared(each, property));
    const card = rule('.model-row', 'grid-template-areas');

    it('is padded 1rem inside its edge, where 0.75rem crowded it', () => {
        expect(declared(card, 'padding')).toBe('1rem');
    });

    it('lets the model\'s cell give up its box: its name\'s line beside the box and the bell, the rest the card\'s width', () => {
        //
        // the address and the description stopped at the box's column, and left
        // the card's right side empty
        //
        const rows = declared(card, 'grid-template-areas').match(/'[^']*'/g);

        expect(declared(rule('.model-cell-model', 'display'), 'display')).toBe('contents');
        expect(declared(rule('.model-name-line', 'grid-area'), 'grid-area')).toBe('name');
        expect(declared(rule('.model-address', 'grid-area'), 'grid-area')).toBe('address');
        expect(declared(rule('.model-description', 'grid-area'), 'grid-area')).toBe('about');
        expect(rows.slice(1, 3)).toEqual(['\'address address address address address\'', '\'about about about about about\'']);
    });

    it('puts the live version, the attempts and the 60-day line in a row, the line at the right, and the score under them across the card (#283)', () => {
        //
        // each figure as wide as it needs, and the line in what is left. The
        // score had shared a row with the line, over the other two
        //
        const rows = declared(card, 'grid-template-areas').match(/'[^']*'/g);

        //
        // under the description, an options model's link to its picks, a line
        // no other row fills (#290)
        //
        expect(rows.slice(3)).toEqual(['\'picks picks picks picks picks\'', '\'live went trend trend trend\'', '\'score score score score score\'']);
        expect(declared(card, 'grid-template-columns')).toBe('auto auto minmax(0, 1fr) auto auto');
        expect(declared(card, 'column-gap')).toBe('0.75rem');
        expect(declared(rule('.model-cell-trend', 'grid-area'), 'justify-self')).toBe('end');
        expect(declared(rule('.model-trend,.model-trend-pending,.model-trend-none', 'width'), 'width')).toBe('$model-trend-width');
        expect(source).toMatch(/\$model-trend-width: 132px;/);
    });

    it('rules the score off from the figures over it, whichever score it is (#283)', () => {
        const score = rule('.model-cell-score,.model-list-parts .model-cell-parts', 'border-top');

        expect(declared(score, 'border-top')).toBe('1px solid $gray-2');
        expect(declared(score, 'padding-top')).toBe('0.6rem');
        expect(declared(score, 'grid-area')).toBe('score');
    });

    it('puts the 60-day line under the other two figures, at the left, on a phone too narrow for the three side by side (#283)', () => {
        expect(source).toMatch(/@media \(max-width: 374\.98px\) \{\s*\.model-row \{\s*grid-template-areas:[^;]*'live went went went went'\s*'trend trend trend trend trend'\s*'score score score score score';/);
        expect(source).toMatch(/@media \(max-width: 374\.98px\) \{[^@]*\.model-cell-trend \{\s*justify-self: start;/);
    });

    it('keeps the model\'s lines together, and puts 0.6rem over each row of figures', () => {
        expect(declared(card, 'gap')).toBeNull();
        expect(declared(card, 'row-gap')).toBeNull();
        expect(declared(rule('.model-cell-score,.model-cell-trend,.model-cell-live,.model-cell-went', 'margin-top'), 'margin-top'))
            .toBe('0.6rem');
    });

    it('makes the box\'s cell as tall as the name\'s line, so the box sits at its middle', () => {
        expect(declared(rule('.model-cell-compare', 'height'), 'height')).toBe('1.5rem');
    });

    it('raises the bell by half of what its button is taller than the line, takes as much off its foot, and brings it nearer the box', () => {
        //
        // so its glyph is at the line's middle as well, level with the box, and
        // 16px from it rather than 26px
        //
        const button = RULES.find((each) => each.selectors[0] === '#bootstrap-override .model-layout .control-tray .control-button');
        const line = parseFloat(declared(rule('.model-cell-compare', 'height'), 'height'));
        const [top, right, bottom, left] = declared(rule('.model-cell-alarm', 'margin'), 'margin').split(' ');

        expect(parseFloat(top)).toBeCloseTo(-(parseFloat(declared(button, 'height')) - line) / 2);
        expect(top).toMatch(/rem$/);
        expect(bottom).toBe(top);
        expect(right).toBe('0');
        expect(left).toBe('-0.75rem');
    });
});

describe('the arrow before how a score stands against the baseline (#274)', () => {
    const rule = (selector) => RULES.find((each) => each.selectors.join() === selector);

    it('is green while the score is better, as a model\'s page colors a better score in its box', () => {
        expect(declared(rule('.model-gap-better .model-gap-arrow'), 'color')).toBe('$green-6');
    });

    it('is dark red while it is worse, and a miss\'s red on /stream on a dark page', () => {
        expect(source).toMatch(/\.model-gap-worse \.model-gap-arrow \{\s*color: \$red-2;\s*@include dark \{\s*color: var\(--stream-missed\);\s*\}/);
    });

    it('colors the arrow alone, the words staying in the page\'s gray', () => {
        expect(declared(rule('.model-gap'), 'color')).toBe('$gray-7');
        expect(rule('.model-gap-better')).toBeUndefined();
        expect(rule('.model-gap-worse')).toBeUndefined();
    });
});

describe('what the two pages hold while the listing is on its way (#274)', () => {
    const rule = (selector) => RULES.find((each) => each.selectors.join() === selector);

    it('breathes the trend line\'s block in /graph\'s waiting gray, as its bars do', () => {
        const block = rule('.model-trend-pending');

        expect(declared(block, 'animation')).toBe('graph-pending-breathe 1.4s ease-in-out infinite');
        expect(declared(block, 'background-color')).toBe('$gray-2');
    });

    it('puts each line of text on a line of its own', () => {
        expect(declared(rule('.model-pending-line'), 'display')).toBe('block');
    });

    it('draws a chart\'s frame as its grid\'s lines, inside the room the chart keeps for its axes', () => {
        const frame = rule('.model-chart-pending');

        expect(declared(frame, 'justify-content')).toBe('space-between');
        expect(declared(frame, 'padding')).toBe('12px 12px 30px 56px');
        expect(declared(rule('.model-chart-pending-line'), 'height')).toBe('1px');
        expect(declared(rule('.model-chart-pending-line'), 'animation')).toBe('graph-pending-breathe 1.4s ease-in-out infinite');
    });

    it('runs the folded filters\' bar along the line its count is written on, adding nothing to its thickness', () => {
        //
        // down a wide screen's rail, whose words are turned on their side: sized
        // by its width, it stood across the rail and made it 74px wide, a width
        // the browser kept once the count replaced it
        //
        const bar = rule('.model-filters-summary > .graph-pending-bar');

        expect(declared(bar, 'inline-size')).toBe('4.5rem');
        expect(declared(bar, 'block-size')).toBe('0.7rem');
        expect(declared(bar, 'display')).toBe('block');
        expect(declared(bar, 'width')).toBeNull();
    });

    it('answers the pointer with no highlight where a filter\'s row is not a control yet', () => {
        expect(declared(rule('.model-filter-pending:hover'), 'background-color')).toBe('transparent');
    });

    it('stands still for a reader who asks for less motion', () => {
        expect(source).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.model-trend-pending,\s*\.model-chart-pending-line,\s*\.model-picks-strip-pending \{\s*animation: none;/);
    });
});

describe('loss\'s three parts on a model\'s page (#265)', () => {
    it('sit in the score\'s card now, so nothing places them in a column of the cards\' own (#267)', () => {
        //
        // they hung under the score's card, in its column, and left the space
        // under the other two cards blank
        //
        expect(RULES.find((rule) => rule.selectors.join() === '.model-summary-cards > .model-parts')).toBeUndefined();
    });

    it('put every line\'s figures under its name at once, where the list is too narrow for its longest line', () => {
        //
        // rather than that line's alone, which left the three lines uneven at
        // 1100px wide
        //
        const list = RULES.find((rule) => rule.selectors.join() === '.model-parts');

        expect(declared(list, 'container-type')).toBe('inline-size');
        expect(source).toMatch(/@container \(max-width: 29em\) \{\s*\.model-part \{\s*display: grid;/);
    });
});

describe('a model\'s three cards on a wide screen (#267)', () => {
    const rule = (selector) => RULES.find((each) => each.selectors.join() === selector);

    it('share the summary\'s two rows, each card spanning them by subgrid', () => {
        //
        // every card's top part in the first row and its rows in the second, so
        // each top part is as tall as the tallest and the three rules line up
        // wherever a line wraps
        //
        expect(declared(rule('.model-summary-cards'), 'grid-template-rows')).toBe('auto auto');
        expect(declared(rule('.model-stat'), 'grid-row')).toBe('span 2');
        expect(declared(rule('.model-stat'), 'grid-template-rows')).toBe('subgrid');
        expect(declared(rule('.model-stat'), 'row-gap')).toBe('0');
    });

    it('rule each card\'s rows off from its top part, and keep its top part\'s lines together', () => {
        expect(declared(rule('.model-stat-body'), 'border-top')).toBe('1px solid $gray-2');
        expect(declared(rule('.model-stat-head'), 'align-content')).toBe('start');
    });
});

describe('the controls on a phone (#272)', () => {
    //
    // the rule for `selector` that declares `property`, where a wide screen's
    // rule for it declares others
    //
    const rule = (selector, property) => RULES.find((each) => each.selectors.join() === selector && declared(each, property));

    it('put the score picker\'s and the sort\'s names in one column and their dropdowns in the next, each running to the line\'s end', () => {
        const pickers = rule('.model-scores,.model-sort', 'grid-template-columns');

        expect(declared(rule('.model-controls', 'grid-template-columns'), 'grid-template-columns')).toBe('auto minmax(0, 1fr)');
        expect(declared(pickers, 'grid-template-columns')).toBe('subgrid');
        expect(declared(pickers, 'grid-column')).toBe('1 / -1');
        expect(declared(rule('.model-score-menu', 'min-width'), 'display')).toBe('flex');
        expect(declared(rule('.model-score-menu select,.model-sort select', 'width'), 'width')).toBe('100%');
    });

    it('stand 0.75rem apart, and 1rem over a model page\'s figures', () => {
        expect(declared(rule('.model-controls', 'grid-template-columns'), 'row-gap')).toBe('0.75rem');
        expect(declared(rule('.model-page .model-controls', 'margin-bottom'), 'margin-bottom')).toBe('1rem');
    });

    it('put a card\'s Compare with on a line of its own, 0.75rem under the title and 1rem over the line under it, its dropdown running to the card\'s edge', () => {
        //
        // the card's head sets the line under it 0.3rem off already
        //
        const other = rule('.model-card-title .model-other', 'flex');

        expect(declared(rule('.model-card-title', 'row-gap'), 'row-gap')).toBe('0.75rem');
        expect(declared(other, 'flex')).toBe('1 1 100%');
        expect(declared(other, 'flex-wrap')).toBe('nowrap');
        expect(declared(other, 'margin-bottom')).toBe('calc(1rem - 0.3rem)');
        expect(source).toMatch(/\.model-card-head \{\s*display: grid;\s*gap: 0\.3rem;/);
        expect(declared(rule('.model-card-title .model-other select', 'flex'), 'flex')).toBe('1');
    });
});

describe('the pickers and the picks of #279', () => {
    const rule = (selector, property) => RULES.find((each) => each.selectors.join() === selector && declared(each, property));

    it('put each list\'s score picker 0.75rem under its task\'s heading, over its list', () => {
        expect(declared(rule('.model-group-controls', 'margin'), 'margin')).toBe('0.75rem 0 0.25rem');
    });

    it('answer the pointer with no highlight over a picker\'s outlines while the listing is on its way', () => {
        expect(declared(RULES.find((each) => each.selectors.join() === '&:hover' && /border-color: \$gray-3/.test(each.body)), 'border-color')).toBe('$gray-3');
        expect(source).toMatch(/\.model-score\.model-score-pending \{[^}]*cursor: default;/);
    });

    it('put the box a stock is looked up by on a line of its own on a phone, running to the card\'s edge', () => {
        expect(declared(rule('.model-card-title .model-picks-lookup', 'flex'), 'flex')).toBe('1 1 100%');
        expect(declared(rule('.model-picks-lookup input', 'flex'), 'flex')).toBe('1');
    });
});

describe('an options model\'s picks page (#290)', () => {
    //
    // every rule for `selector`, in the partial's order: a wide screen's first,
    // then a phone's
    //
    const rulesFor = (selector) => RULES.filter((each) => each.selectors.join() === selector);
    const rule = (selector, property) => rulesFor(selector).find((each) => declared(each, property));

    it('sets the When card beside the record\'s, a third and two thirds, and on a phone one over the other', () => {
        const [wide, phone] = rulesFor('.model-picks-summary');

        expect(declared(wide, 'grid-template-columns')).toBe('minmax(0, 1fr) minmax(0, 2fr)');
        expect(declared(phone, 'grid-template-columns')).toBe('minmax(0, 1fr)');
    });

    it('scrolls the picks sideways on a card too narrow for them, and reads the rank and the quote from the right', () => {
        expect(declared(rule('.model-picks-scroll', 'overflow-x'), 'overflow-x')).toBe('auto');
        expect(declared(rule('.model-pick-rank,.model-pick-quote', 'text-align'), 'text-align')).toBe('right');
    });

    it('draws what is better in the theme\'s green, and what is worse in a miss\'s red', () => {
        [
            ['.model-pick-gap.model-pick-above', 'color', '$green-6'],
            ['.model-pick-gap.model-pick-below', 'color', 'var(--stream-missed)'],
            ['.model-pick-bar-gap.model-pick-above', 'background-color', '$green-6'],
            ['.model-pick-bar-gap.model-pick-below', 'background-color', 'var(--stream-missed)'],
            ['.model-pick-span.model-pick-above', 'background-color', '$green-6'],
            ['.model-pick-span.model-pick-below', 'background-color', 'var(--stream-missed)'],
            ['.model-picks-strip-up', 'background-color', '$green-6'],
            ['.model-picks-strip-down', 'background-color', 'var(--stream-missed)'],
        ].forEach(([selector, property, value]) => {
            expect({ selector, value: declared(rule(selector, property), property) }).toEqual({ selector, value });
        });
    });

    it('puts the record\'s zero at half its bars\' height, the HALF the page draws them to', () => {
        const page = fs.readFileSync(path.resolve(__dirname, '../../../import/layout/model/picks-page.jsx'), 'utf8');
        const half = Number(page.match(/const HALF = (\d+);/)[1]);

        expect(declared(rule('.model-picks-strip', 'height'), 'height')).toBe(`${2 * half}px`);
        expect(declared(rule('.model-picks-strip-zero', 'top'), 'top')).toBe(`${half}px`);
    });

    it('draws the record 1.75rem wide a day, as wide as its card at most, and never so narrow its first and last day run together', () => {
        const frame = rule('.model-picks-strip-frame', 'width');

        expect(declared(frame, 'width')).toBe('min(100%, calc(var(--days) * (1.75rem + 6px) - 6px))');
        expect(declared(frame, 'min-width')).toBe('max-content');
        expect(declared(rule('.model-picks-strip-day', 'flex'), 'flex')).toBe('1 1 0');
        expect(declared(rule('.model-picks-strip-axis', 'column-gap'), 'column-gap')).toBe('0.75rem');
    });

    it('keeps each of the two cards\' parts at its top, sharing no rows, so no gap opens over the record\'s bars', () => {
        const cards = rule('.model-picks-summary > .model-stat', 'grid-template-rows');

        expect(declared(cards, 'grid-template-rows')).toBe('none');
        expect(declared(cards, 'grid-row')).toBe('auto');
        expect(declared(cards, 'align-content')).toBe('start');
    });

    describe('on a phone', () => {
        it('makes each pick a card: rank, stock and option, then the chance, the gain guess and the quote', () => {
            const card = rule('.model-picks-table tr', 'grid-template-areas');

            expect(declared(card, 'display')).toBe('grid');
            expect(declared(card, 'grid-template-areas')).toBe('\'rank stock option\' \'chance chance chance\' \'gain gain gain\' \'quote quote quote\'');
            expect(declared(rule('.model-picks-table thead', 'display'), 'display')).toBe('none');
        });

        it('names the chance and the gain guess over them by their columns\' headings, which the head no longer shows', () => {
            const names = '.model-picks-table .model-pick-chance::before,.model-picks-table .model-pick-gain::before';

            expect(declared(rule(names, 'content'), 'content')).toBe('attr(data-label)');
            expect(declared(rule(names, 'display'), 'display')).toBe('block');
        });
    });

    describe('/model\'s link to it', () => {
        it('runs across a phone\'s card under the description, a line no other row fills', () => {
            const areas = declared(RULES.filter((each) => each.selectors.join() === '.model-row' && declared(each, 'grid-template-areas'))[0], 'grid-template-areas');

            expect(areas).toMatch(/'about about about about about' 'picks picks picks picks picks'/);
            expect(declared(rule('.model-picks-link', 'grid-area'), 'grid-area')).toBe('picks');
        });
    });
});

describe('loss\'s three parts in /model\'s list (#283)', () => {
    //
    // every rule for `selector`, in the partial's order: a wide screen's, then a
    // narrower list's, then the narrowest's, then a phone's
    //
    const rulesFor = (selector) => RULES.filter((each) => each.selectors.join() === selector);
    const rule = (selector) => rulesFor(selector)[0];
    const grids = rulesFor('.model-list-parts .model-list-head,.model-list-parts .model-row');

    //
    // the text of the container query that opens at `query`, up to the next one
    //
    const within = (query) => source.slice(source.indexOf(query), source.indexOf('@container', source.indexOf(query) + 1));

    it('measure the list they are in, rather than the screen', () => {
        expect(declared(rule('.model-list'), 'container-type')).toBe('inline-size');
    });

    it('take a column each, of a set width, after the 60-day line, so the headings and every row line up', () => {
        //
        // the headings and each row are grids of their own: columns sized to
        // what each holds had left the rows' figures off their headings
        //
        const columns = tracks(declared(grids[0], 'grid-template-columns'));

        expect(columns).toHaveLength(9);
        expect(columns.slice(3, 6)).toEqual(['8rem', '6rem', '140px']);
        expect(columns.slice(6)).toEqual(['6.5rem', '10rem', '7rem']);
    });

    it('span the three by subgrid, the score\'s heading centered over a rule across them, every heading on the parts\' names\' line', () => {
        const spans = rule('.model-parts-head,.model-list-parts .model-cell-parts,.model-part-cells');
        const heading = rulesFor('> .model-noted')[0];

        expect(declared(spans, 'grid-column')).toBe('span 3');
        expect(declared(spans, 'grid-template-columns')).toBe('subgrid');
        expect(declared(heading, 'border-bottom')).toBe('1px solid $gray-3');
        expect(declared(heading, 'grid-column')).toBe('1 / -1');
        expect(declared(heading, 'text-align')).toBe('center');
        expect(declared(rule('.model-list-parts .model-list-head'), 'align-items')).toBe('end');
    });

    it('keep each part\'s name on one line over its column', () => {
        expect(declared(rulesFor('> span')[0], 'white-space')).toBe('nowrap');
    });

    it('name each part for a screen reader where the headings name them to the eye', () => {
        const name = rule('.model-part-cell-name');

        expect(declared(name, 'clip-path')).toBe('inset(50%)');
        expect(declared(name, 'position')).toBe('absolute');
        expect(declared(name, 'display')).toBeNull();
    });

    it('lay out as a phone\'s card\'s lines through one mixin, on a phone and in a narrower list', () => {
        const lines = rulesFor('.model-part-cells').find((each) => declared(each, 'grid-template-columns') === 'minmax(0, 1fr) auto auto');

        expect(source).toMatch(/@mixin model-part-lines \{/);
        expect(source.match(/@include model-part-lines;/g)).toHaveLength(2);
        expect(lines).toBeDefined();
        expect(declared(rulesFor('.model-part-cell-name')[1], 'position')).toBe('static');
    });

    it('make a list under 72rem one column of lines, on a screen too wide for a phone\'s card, its heading still centered over its rule', () => {
        //
        // at 1280px wide with the filters open, each part's name had broken
        // over three lines under its column
        //
        const narrower = within('@container (max-width: 72rem)');

        expect(source).toMatch(/@media \(min-width: 768px\) \{\s*@container \(max-width: 72rem\) \{/);
        expect(declared(grids[1], 'grid-template-columns')).toBe('4.5rem minmax(9rem, 1fr) 2.5rem 7rem 5rem 140px 19.5rem');
        expect(narrower).toMatch(/\.model-parts-head \{\s*display: block;\s*grid-column: auto;\s*> \.model-noted \{\s*display: block;\s*\}\s*> span:not\(\.model-noted\) \{\s*display: none;/);
        expect(narrower).toMatch(/@include model-part-lines;/);
    });

    it('drop the 60-day line from every list under 62rem, which ran past its column', () => {
        //
        // 90px past it from 992px to 1199px wide with the filters open, and the
        // page scrolled sideways
        //
        const narrowest = within('@container (max-width: 62rem)');

        expect(narrowest).toMatch(/\.model-head-trend,\s*\.model-cell-trend \{\s*display: none;/);
        expect(narrowest).toMatch(/\.model-list-head,\s*\.model-row \{\s*grid-template-columns: 4\.5rem minmax\(12rem, 2fr\) 2\.5rem 8rem 6rem minmax\(9rem, 1fr\);/);
        expect(declared(grids[2], 'grid-template-columns')).toBe('4.5rem minmax(9rem, 1fr) 2.5rem 7rem 5rem 19.5rem');
    });

    it('give way to a phone\'s card, whose areas place each cell', () => {
        expect(grids).toHaveLength(3);
        expect(declared(rule('.model-list-parts .model-row'), 'grid-template-columns')).toBe('auto auto minmax(0, 1fr) auto auto');
    });
});

describe('the docs\' page on the models, in place of the intro (#296)', () => {
    it('puts the icon at the right end of the Sort row and of the title\'s row, as /stream puts its own', () => {
        const both = RULES.find((each) => each.selectors.join() === '.model-heading .model-heading-docs,.model-controls .model-controls-docs');

        expect(declared(both, 'margin-left')).toBe('auto');
        expect(declared(RULES.find((each) => each.selectors.join() === '.model-heading .model-heading-docs' && declared(each, 'align-self')), 'align-self')).toBe('center');
    });

    it('shows the Sort row\'s on a computer alone, and the title row\'s on a phone alone', () => {
        expect(source).toMatch(/@media \(max-width: 767\.98px\) \{\s*\.model-controls \.model-controls-docs \{\s*display: none;\s*\}\s*\}/);
        expect(source).toMatch(/@media \(min-width: 768px\) \{\s*\.model-heading \.model-heading-docs \{\s*display: none;\s*\}\s*\}/);
    });

    it('folds no intro any more (#287)', () => {
        expect(source).not.toMatch(/model-lede-(fold|folded|open|toggle|more|less|dots)/);
    });
});

describe('the box over a trend line under the pointer (#296)', () => {
    it('is the panel\'s tip, smaller: 0.8rem words, closer padding, a line for each row, as wide as its words', () => {
        expect(source).toMatch(/\.model-trend-tip \{\s*box-shadow: 0 1px 3px rgba\(0, 0, 0, 0\.18\);\s*font-size: 0\.8rem;\s*gap: 0\.1rem;\s*line-height: 1\.3;\s*padding: 0\.3rem 0\.55rem;\s*white-space: nowrap;\s*width: max-content;/);
    });

    it('comes after the panel\'s tip, so its own padding and gap win', () => {
        expect(source.indexOf('.model-trend-tip {')).toBeGreaterThan(source.indexOf('.model-tip {'));
    });

    it('draws each mark 12px wide, in a column as wide', () => {
        const row = RULES.find((each) => each.selectors.join() === '.model-tip-row' && /12px/.test(each.body));
        const mark = RULES.find((each) => each.selectors.join() === '.model-mark' && /12px/.test(each.body));

        expect(declared(row, 'grid-template-columns')).toBe('12px minmax(0, 1fr) auto');
        expect([declared(mark, 'width'), declared(mark, 'height')]).toEqual(['12px', '9px']);
    });
});

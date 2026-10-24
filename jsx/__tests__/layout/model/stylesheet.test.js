/**
 * stylesheet.test.js: what '_model.scss' promises about /model's lists, their
 * rows, their pickers and a phone's cards as #300 lays them out, about
 * the pill of a model taken down (#263), about where loss's three parts go on a
 * model's page (#265), about the rows that page's three cards share (#267), about
 * a phone's controls and the room around them (#272), about the arrow before how
 * a score stands, and what both pages hold while the listing is on its way
 * (#274), about loss's three parts in /model's list (#283), and about a model's
 * own page as #300 lays it out -- its column, its cards, its charts' panel, when
 * its results come in, and a phone's boxes -- read out of the partial.
 *
 * jsdom lays nothing out and resolves no stylesheet, so no suite can see where a
 * cell lands. What can be held is what each rule says: a wide row's cells side
 * by side, each with the room #300 gives it, and a phone's card placing
 * each cell by name, whatever their order -- see model-row.test.jsx.
 *
 * Note: read the way layout/stream/stylesheet.test.js reads '_stream.scss': the
 *       comments taken out, and each rule found by its selectors. A rule that
 *       holds rules of its own, as a row's holds its last row's, is read whole --
 *       see whole.
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
// a rule's text, the rules it holds and all, from its selector to the brace that
// closes it: RULES has only the rules that hold none. The partial's first for
// `selector`, a wide screen's, as a phone's come after it
//
function whole(selector) {
    const start = source.indexOf(`${selector} {`);
    const open = source.indexOf('{', start);
    let depth = 0;

    for (let at = open; start >= 0 && at < source.length; at += 1) {
        if (source[at] === '{') {
            depth += 1;
        } else if (source[at] === '}') {
            depth -= 1;
        }

        if (!depth) {
            return { selectors: [selector], body: source.slice(open + 1, at) };
        }
    }

    return null;
}

//
// the first rule for `selector` that declares `property`, and every rule for it,
// a wide screen's first
//
const ruleOf = (selector, property) => RULES.find((each) => each.selectors.join() === selector && declared(each, property));
const rulesOf = (selector) => RULES.filter((each) => each.selectors.join() === selector);

describe('a list of /model, as #300 lays one out', () => {
    it('rules each list off from the one over it, its pickers, its line and its rows under its name, 14px apart', () => {
        const group = whole('.model-group');

        expect(declared(group, 'border-top')).toBe('1px solid $gray-2');
        expect(declared(group, 'display')).toBe('flex');
        expect(declared(group, 'flex-direction')).toBe('column');
        expect(declared(group, 'gap')).toBe('14px');
        expect(declared(group, 'margin-top')).toBe('8px');
        expect(declared(ruleOf('.model-main', 'gap'), 'gap')).toBe('1rem');
        expect(declared(group, 'padding-top')).toBe('18px');
        expect(group.body).toMatch(/> \.model-hold-line \{\s*margin: -4px 0 0;/);
    });

    it('names its task at 17px, a step under the page\'s title, how many models it has beside it, and what they predict under them in a 14px gray', () => {
        const detail = ruleOf('.model-group-detail', 'flex-basis');

        expect(declared(RULES.find((each) => each.selectors.join() === 'h5' && declared(each, 'font-size') === '17px'), 'font-weight')).toBe('600');
        expect(declared(ruleOf('.model-group-head h5', 'font-size'), 'font-size')).toBe('17px');
        expect(declared(ruleOf('.model-group-count', 'font-size'), 'font-size')).toBe('14px');
        expect(declared(detail, 'flex-basis')).toBe('100%');
        expect(declared(detail, 'font-size')).toBe('14px');
        expect(declared(detail, 'color')).toBe('$gray-6');
    });

    it('holds its rows in a box of their own, a light rule between them', () => {
        const [list] = rulesOf('.model-list');
        const row = whole('.model-row');

        expect(declared(list, 'border')).toBe('1px solid $gray-2');
        expect(declared(list, 'border-radius')).toBe('8px');
        expect(declared(list, 'overflow')).toBe('hidden');
        expect(declared(row, 'border-bottom')).toBe('1px solid $gray-1');
        expect(row.body).toMatch(/&:last-child \{\s*border-bottom: 0;/);
    });

    it('lays a row out on two lines, 24px between its parts and 12px between its lines', () => {
        const row = whole('.model-row');

        expect(declared(row, 'display')).toBe('grid');
        expect(declared(row, 'column-gap')).toBe('24px');
        expect(declared(row, 'row-gap')).toBe('12px');
        expect(declared(row, 'padding')).toBe('14px 16px');
        expect(declared(row, 'align-items')).toBe('center');
    });

    it('stands the trend line under the model and when it went live under the score, past the box that ticks it (#300)', () => {
        const row = whole('.model-row');

        expect(declared(row, 'grid-template-areas')).toBe('\'compare model score\' \'. trend since\'');
        expect(declared(row, 'grid-template-columns')).toBe('auto minmax(0, 2fr) minmax(0, 3fr)');
        expect(['compare', 'model', 'score', 'parts', 'trend', 'since'].map((cell) => [cell, declared(ruleOf(`.model-cell-${cell}`, 'grid-area'), 'grid-area')]))
            .toEqual([
                ['compare', 'compare'],
                ['model', 'model'],
                ['score', 'score'],
                ['parts', 'score'],
                ['trend', 'trend'],
                ['since', 'since'],
            ]);
        expect(source).not.toMatch(/flex: (2 1 240px|1 1 170px|3 1 440px|1 1 160px)/);
    });

    it('names a model at 22px on a phone\'s page, and 28px on a wider screen\'s, so its status and bell keep to its line (#300)', () => {
        const sizes = source.match(/\.model-page \.model-heading h4 \{\s*font-size: (\d+px);/g) || [];

        expect(sizes.map((rule) => rule.match(/(\d+px)/)[1])).toEqual(['22px']);
        expect(source).toMatch(/\.model-heading h4 \{\s*color: \$gray-9;\s*font-size: 28px;/);
        expect(source.indexOf('.model-page .model-heading h4 {')).toBeGreaterThan(source.indexOf('@media (max-width: 767.98px) {\n  .model-columns'));
    });

    it('stacks a row\'s parts under its model, each at the model\'s left edge, in a list too narrow for its score beside it (#300)', () => {
        const narrow = source.match(/@container \(max-width: 680px\) \{\s*\.model-row \{([^}]*)\}/);

        expect(declared(rulesOf('.model-list')[0], 'container-type')).toBe('inline-size');
        expect(narrow).not.toBeNull();
        expect(declared({ body: narrow[1] }, 'grid-template-areas')).toBe('\'compare model\' \'. score\' \'. trend\' \'. since\'');
        expect(declared({ body: narrow[1] }, 'grid-template-columns')).toBe('auto minmax(0, 1fr)');
    });

    it('lays a row on one line where its list has room, as #300 does, a list of loss\'s parts needing more of it (#300)', () => {
        const scores = source.match(/@container \(min-width: 880px\) \{\s*\.model-list:not\(\.model-list-parts\) \.model-row \{([^}]*)\}/);
        const parts = source.match(/@container \(min-width: 1150px\) \{\s*\.model-list-parts \.model-row \{([^}]*)\}/);

        expect(declared({ body: scores[1] }, 'grid-template-areas')).toBe('\'compare model score trend since\'');
        expect(declared({ body: scores[1] }, 'grid-template-columns')).toBe('auto minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)');
        expect(declared({ body: parts[1] }, 'grid-template-areas')).toBe('\'compare model score trend since\'');
        expect(declared({ body: parts[1] }, 'grid-template-columns')).toBe('auto minmax(0, 2fr) minmax(0, 3fr) minmax(0, 1fr) minmax(0, 1fr)');
    });

    it('says over each trend line what it spans, in a 13px gray (#300)', () => {
        const span = ruleOf('.model-trend-span', 'font-size');

        expect(declared(span, 'font-size')).toBe('13px');
        expect(declared(span, 'color')).toBe('$gray-6');
        expect(declared(ruleOf('.model-cell-trend', 'gap'), 'gap')).toBe('6px');
    });

    it('has no headings over its rows, nor a grid of columns for them', () => {
        expect(source).not.toMatch(/model-list-head|model-parts-head|model-head-trend|grid-template-columns: 4\.5rem/);
        expect(source).not.toMatch(/@container \(max-width: (72|62)rem\)/);
    });

    it('names a model at 15px, over its description in a 14px gray, and no address between them (#300)', () => {
        const description = ruleOf('.model-description', 'margin');

        expect(declared(ruleOf('.model-name', 'font-weight'), 'font-size')).toBe('15px');
        expect(rulesOf('.model-name').map((each) => declared(each, 'font-size'))).toEqual(['15px', '15px']);
        expect(source).not.toMatch(/model-address/);
        expect(declared(description, 'font-size')).toBe('14px');
        expect(declared(description, 'color')).toBe('$gray-6');
    });

    it('keeps the bell on the name\'s line, its round button no taller than the line', () => {
        expect(source).toMatch(/\.model-name-line \{\s*align-items: center;\s*display: flex;\s*flex-wrap: wrap;\s*gap: 4px 10px;\s*\.model-bell \{\s*margin: -0\.6rem 0;/);
        expect(source).not.toMatch(/model-cell-alarm/);
    });

    it('puts a score\'s 16px figure over how it stands, and the days it takes in last', () => {
        const days = ruleOf('.model-score-days', 'order');

        expect(declared(ruleOf('.model-score-value', 'font-weight'), 'font-size')).toBe('16px');
        expect(declared(ruleOf('.model-cell-score > .model-gap', 'order'), 'order')).toBe('1');
        expect(declared(days, 'order')).toBe('2');
        expect(declared(days, 'font-size')).toBe('13px');
    });

    it('says when the live version went live in the figures\' ink, and how many attempts did in gray', () => {
        expect(declared(rulesOf('.model-since')[0], 'color')).toBe('$gray-9');
        expect(declared(rulesOf('.model-since-went')[0], 'color')).toBe('$gray-6');
    });

    it('draws the trend line as wide as its room and 44px tall, as model-row.jsx draws it', () => {
        const row = fs.readFileSync(path.resolve(__dirname, '../../../import/layout/model/model-row.jsx'), 'utf8');
        const box = ruleOf('.model-trend,.model-trend-pending,.model-trend-none', 'height');

        expect(declared(box, 'height')).toBe(`${row.match(/const TREND_HEIGHT = (\d+);/)[1]}px`);
        expect(declared(box, 'height')).toBe('44px');
        expect(declared(box, 'width')).toBe('100%');
        expect(declared(ruleOf('.model-trend-none', 'line-height'), 'line-height')).toBe('44px');
        expect(source).not.toMatch(/\$model-trend-width/);
    });
});

describe('the pickers, as #300 lays them out', () => {
    it('name each picker over its buttons', () => {
        const scores = whole('.model-scores');

        expect(declared(scores, 'display')).toBe('flex');
        expect(declared(scores, 'flex-direction')).toBe('column');
        expect(declared(scores, 'gap')).toBe('6px');
        expect(declared(ruleOf('> .model-control-label', 'font-size'), 'font-size')).toBe('12px');
    });

    it('join a picker\'s buttons in one box with a rule between each, each 34px tall, a phone\'s menus 44px in their place (#300)', () => {
        const [box] = rulesOf('.model-score-buttons');
        const button = whole('.model-score');

        expect(declared(box, 'border')).toBe('1px solid $gray-3');
        expect(declared(box, 'border-radius')).toBe('8px');
        expect(declared(box, 'overflow')).toBe('hidden');
        expect(declared(button, 'border-radius')).toBe('0');
        expect(declared(button, 'border-right')).toBe('1px solid $gray-3');
        expect(declared(button, 'min-height')).toBe('34px');
        expect(declared(button, 'padding')).toBe('6px 14px');
        expect(button.body).toMatch(/&:last-child \{\s*border-right: 0;/);
        expect(declared(ruleOf('.model-holds .model-score', 'padding'), 'padding')).toBe('6px 16px');
    });

    it('fill the one picked in the page\'s dark gray, and fade one that can\'t be picked', () => {
        const button = whole('.model-score');

        expect(button.body).toMatch(/&\[aria-pressed='true'\] \{\s*background-color: \$gray-7;\s*color: \$white-1;/);
        expect(button.body).toMatch(/&:disabled \{\s*color: \$gray-5;\s*cursor: not-allowed;/);
    });

    it('stand side by side, wrapping where there is no room, a list\'s 28px apart', () => {
        const [controls] = rulesOf('.model-controls');
        const group = ruleOf('.model-group-controls', 'gap');

        expect(declared(controls, 'display')).toBe('flex');
        expect(declared(controls, 'flex-wrap')).toBe('wrap');
        expect(declared(controls, 'align-items')).toBe('flex-start');
        expect(declared(controls, 'gap')).toBe('16px 32px');
        expect(declared(group, 'gap')).toBe('12px 28px');
        expect(declared(group, 'margin')).toBe('0');
    });

    it('answer the pointer with no highlight over a picker\'s buttons while the listing is on its way', () => {
        expect(source).toMatch(/\.model-score\.model-score-pending \{[^}]*cursor: default;[^}]*&:hover \{\s*background-color: \$white-1;/);
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

describe('/model on a phone, as #300 lays it out (#274)', () => {
    //
    // a phone's card: the last rule for a row that places its parts by name,
    // after a wide row's and a narrow list's
    //
    const card = rulesOf('.model-row').filter((each) => declared(each, 'grid-template-areas')).pop();

    it('draws each model a card of its own, 12px apart, with no box around them all', () => {
        const list = rulesOf('.model-list')[1];
        const rows = ruleOf('.model-list > [role=\'list\']', 'gap');

        expect(declared(list, 'border')).toBe('0');
        expect(declared(list, 'border-radius')).toBe('0');
        expect(declared(list, 'overflow')).toBe('visible');
        expect(declared(rows, 'flex-direction')).toBe('column');
        expect(declared(rows, 'gap')).toBe('12px');
        expect(declared(ruleOf('.model-group', 'gap'), 'gap')).toBe('12px');
    });

    it('frames each card 12px inside its edge, its parts 8px apart', () => {
        expect(declared(card, 'border')).toBe('1px solid $gray-2');
        expect(declared(card, 'border-radius')).toBe('8px');
        expect(declared(card, 'padding')).toBe('12px');
        expect(declared(card, 'row-gap')).toBe('8px');
    });

    it('places each part by name: the model beside the box that ticks it, then its score, its line and when it went live', () => {
        expect(declared(card, 'grid-template-areas')).toBe('\'model compare\' \'score score\' \'trend trend\' \'since since\'');
        expect(declared(card, 'grid-template-columns')).toBe('minmax(0, 1fr) auto');
        expect([
            declared(ruleOf('.model-cell-model', 'grid-area'), 'grid-area'),
            declared(ruleOf('.model-cell-compare', 'grid-area'), 'grid-area'),
            declared(ruleOf('.model-cell-score,.model-cell-parts', 'grid-area'), 'grid-area'),
            declared(ruleOf('.model-cell-trend', 'grid-area'), 'grid-area'),
            declared(ruleOf('.model-cell-since', 'grid-area'), 'grid-area'),
        ]).toEqual(['model', 'compare', 'score', 'trend', 'since']);
    });

    it('keeps the model\'s cell a box of its own, its name, address and description together', () => {
        expect(rulesOf('.model-cell-model').some((each) => declared(each, 'display') === 'contents')).toBe(false);
    });

    it('puts the score\'s figure beside the days it takes in, and how it stands under them', () => {
        const score = ruleOf('.model-cell-score', 'grid-template-areas');

        expect(declared(score, 'display')).toBe('grid');
        expect(declared(score, 'grid-template-areas')).toBe('\'value days\' \'gap gap\'');
        expect(declared(score, 'justify-content')).toBe('space-between');
        expect(declared(ruleOf('.model-score-value', 'grid-area'), 'font-size')).toBe('16px');
    });

    it('says when it went live and how many attempts did as one line, a dot between them', () => {
        const since = ruleOf('.model-cell-since', 'display');

        expect(declared(since, 'display')).toBe('block');
        expect(declared(since, 'font-size')).toBe('13px');
        expect(declared(ruleOf('.model-since,.model-since-went', 'display'), 'display')).toBe('inline');
        expect(declared(ruleOf('.model-since-went::before', 'content'), 'content')).toBe('\' · \'');
    });

    it('draws the trend line across the card 56px tall, a little taller than a wide row\'s 44px (#300)', () => {
        expect(rulesOf('.model-trend,.model-trend-pending,.model-trend-none').map((each) => declared(each, 'height'))).toEqual(['44px', '56px']);
        expect(rulesOf('.model-trend-none').map((each) => declared(each, 'line-height')).filter(Boolean)).toEqual(['44px', '56px']);
    });

    it('sets the trend line 12px under its span, and the span 16px under the score, where they had crowded it (#300)', () => {
        const trend = rulesOf('.model-cell-trend').find((each) => declared(each, 'margin-top'));

        expect(declared(trend, 'gap')).toBe('12px');
        expect(declared(trend, 'margin-top')).toBe('8px');
    });

    it('rules a card of scores off over its score and over its trend line, as loss\'s parts are on a card of stocks (#300)', () => {
        const rule = RULES.find((each) => each.selectors.join() === '.model-list:not(.model-list-parts) .model-cell-score,.model-list:not(.model-list-parts) .model-cell-trend');

        expect(declared(rule, 'border-top')).toBe('1px solid $gray-1');
        expect(declared(rule, 'padding-top')).toBe('10px');
    });

    it('stands the box that ticks a model level with its name, status and bell, one row across the card\'s top (#300)', () => {
        expect(source).toMatch(/\.model-cell-compare \{ grid-area: compare; align-self: start; height: 2\.75rem; \}/);
    });

    it('lays a narrower phone\'s card out as a wider one\'s (#300)', () => {
        expect(source).not.toMatch(/@media \(max-width: 374\.98px\)/);
    });

    it('keeps the bell a finger wide', () => {
        const button = RULES.find((each) => each.selectors[0] === '#bootstrap-override .model-layout .control-tray .control-button'
            && declared(each, 'height') === '2.75rem');

        expect(declared(button, 'width')).toBe('2.75rem');
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

    it('colors the arrow alone, the words staying in the row\'s lighter gray (#300)', () => {
        expect(declared(rule('.model-gap'), 'color')).toBe('$gray-6');
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
        expect(source).toMatch(/@container \(max-width: 20em\) \{\s*\.model-part \{\s*display: grid;/);
        expect(source).not.toMatch(/@container \(max-width: 30em\)/);
    });

    it('stand a line each, as the cards\' rows do: a light rule under each, the figure in the figures\' ink, how it stands in gray (#300)', () => {
        const list = RULES.find((rule) => rule.selectors.join() === '.model-parts');
        const part = RULES.find((rule) => rule.selectors.join() === '.model-part' && declared(rule, 'border-bottom'));

        expect(declared(list, 'gap')).toBe('7px');
        expect(declared(list, 'font-size')).toBe('14px');
        expect(declared(list, 'color')).toBe('$gray-6');
        expect(declared(part, 'border-bottom')).toBe('1px solid $gray-1');
        expect(declared(part, 'padding-bottom')).toBe('7px');
        expect(declared(RULES.find((rule) => rule.selectors.join() === '.model-part-value'), 'font-weight')).toBeNull();
        expect(source).not.toMatch(/\.model-part-baseline/);
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
        expect(declared(rule('.model-stat-body'), 'border-top')).toBe('1px solid $gray-1');
        expect(declared(rule('.model-stat-head'), 'align-content')).toBe('start');
    });

    it('stand as many across as fit at 280px or more, 16px apart (#300)', () => {
        expect(declared(rule('.model-summary-cards'), 'grid-template-columns')).toBe('repeat(auto-fit, minmax(280px, 1fr))');
        expect(declared(rule('.model-summary-cards'), 'gap')).toBe('16px');
    });

    it('frame each card 14px by 16px inside, its rows 10px under its top part and 10px under the rule, its foot 14px under them (#300)', () => {
        const body = rule('.model-stat-body');

        expect(declared(rule('.model-stat'), 'padding')).toBe('14px 16px');
        expect(declared(rule('.model-stat-head'), 'gap')).toBe('4px');
        expect(declared(body, 'margin-top')).toBe('10px');
        expect(declared(body, 'padding-top')).toBe('10px');
        expect(declared(body, 'gap')).toBe('14px');
        expect(declared(body, 'justify-content')).toBe('space-between');
    });

    it('name each card in 14px gray over its 26px figure, and its line in the page\'s dark gray (#300)', () => {
        expect(declared(rule('.model-stat-label'), 'font-size')).toBe('14px');
        expect(declared(rule('.model-stat-label'), 'color')).toBe('$gray-6');
        expect(declared(rule('.model-stat-value'), 'font-size')).toBe('26px');
        expect(declared(rule('.model-stat-detail'), 'color')).toBe('$gray-7');
        expect(declared(rule('.model-stat-detail'), 'line-height')).toBe('1.45');
    });

    it('rule off each row 7px under it, its value in the figures\' ink and no heavier than its name (#300)', () => {
        const rows = rule('.model-stat-rows');
        const row = rule('.model-stat-row');

        expect(declared(rows, 'flex-direction')).toBe('column');
        expect(declared(rows, 'gap')).toBe('7px');
        expect(declared(rows, 'color')).toBe('$gray-6');
        expect(declared(row, 'padding-bottom')).toBe('7px');
        expect(declared(row, 'border-bottom')).toBe('1px solid $gray-1');
        expect(declared(rule('.model-stat-row-value'), 'color')).toBe('$gray-9');
        expect(declared(rule('.model-stat-row-value'), 'font-weight')).toBeNull();
        expect(source).not.toMatch(/model-stat-row-head/);
    });

    it('set the checks\' table in 13px type, a note under it in gray, and the Attempts card\'s note alike (#300)', () => {
        const notes = rule('.model-stat-note,.model-checks-note');

        expect(declared(rule('.model-checks-block'), 'gap')).toBe('6px');
        expect(declared(whole('.model-checks'), 'font-size')).toBe('13px');
        expect(declared(notes, 'font-size')).toBe('13px');
        expect(declared(notes, 'color')).toBe('$gray-6');
        expect(declared(rule('.model-stat-down'), 'color')).toBe('$gray-6');
    });
});

describe('a model\'s own page, as #300 lays it out', () => {
    const rule = (selector) => RULES.find((each) => each.selectors.join() === selector);

    it('stands its parts in one column, 22px apart, none with a margin of its own', () => {
        const page = whole('.model-page');

        expect(declared(page, 'display')).toBe('flex');
        expect(declared(page, 'flex-direction')).toBe('column');
        expect(declared(page, 'gap')).toBe('22px');
        expect(declared(rule('> .model-intro,> .model-controls,> .model-summary,> .model-card'), 'margin')).toBe('0');
    });

    it('sets the line saying what the hold is 14px under the pickers', () => {
        expect(whole('.model-page').body).toMatch(/> \.model-hold-line \{\s*margin: -8px 0 0;/);
    });

    it('leads with the way back at 14px, ununderlined, then the model\'s name at 28px over a 15px line', () => {
        const back = rule('> .model-back');
        const lede = RULES.find((each) => each.selectors.join() === '.model-lede' && declared(each, 'font-size'));

        expect(declared(back, 'font-size')).toBe('14px');
        expect(declared(back, 'text-decoration')).toBe('none');
        expect(declared(back, 'align-self')).toBe('flex-start');
        expect(declared(RULES.find((each) => each.selectors.join() === '.model-heading h4' && declared(each, 'font-size')), 'font-size')).toBe('28px');
        expect(declared(lede, 'font-size')).toBe('15px');
        expect(declared(lede, 'max-width')).toBe('860px');
    });

    it('frames each card 16px inside, its parts 12px apart, its title at 18px over a gray line, and 12px inside on a phone', () => {
        const cards = rulesOf('.model-page .model-card');

        expect(declared(cards[0], 'padding')).toBe('16px');
        expect(declared(cards[0], 'gap')).toBe('12px');
        expect(declared(cards[1], 'padding')).toBe('12px');
        expect(whole('.model-page .model-card-head').body).toMatch(/h5 \{\s*color: \$gray-9;\s*font-size: 18px;\s*font-weight: 600;/);
        expect(declared(rule('.model-page .model-card-sub'), 'color')).toBe('$gray-6');
        expect(declared(rule('.model-page .model-card-sub'), 'font-size')).toBe('14px');
    });

    it('sets each legend in 13px type, 20px between its marks, and which way its axis runs in gray', () => {
        expect(declared(rule('.model-page .model-legend'), 'font-size')).toBe('13px');
        expect(declared(rule('.model-page .model-legend'), 'gap')).toBe('8px 20px');
        expect(declared(rule('.model-legend-note'), 'color')).toBe('$gray-6');
    });

    it('titles the attempts\' second and third charts at 14px, with no rule over them, set in as far as the charts\' axis is wide', () => {
        const minor = rule('.model-page .model-card-minor');

        expect(declared(minor, 'border-top')).toBe('0');
        expect(declared(minor, 'font-size')).toBe('14px');
        expect(declared(minor, 'margin')).toBe('0 0 0 56px');
        expect(declared(rule('.model-page .model-attempts > .model-card-sub'), 'margin-left')).toBe('56px');
    });

    it('draws a day\'s numbers in a popup by the chart\'s pointer, a shadow under it, no wider than a phone\'s chart holds (#300)', () => {
        const popup = rule('.model-chart-tip');

        expect(declared(popup, 'box-shadow')).toBe('0 1px 3px rgba(0, 0, 0, 0.18)');
        expect(declared(popup, 'font-size')).toBe('13px');
        expect(declared(popup, 'line-height')).toBe('1.35');
        expect(declared(popup, 'max-width')).toBe('260px');
        expect(declared(popup, 'padding')).toBe('6px 10px');
        expect(declared(popup, 'width')).toBe('max-content');
    });

    it('holds no panel under the attempts\' charts, which the popups took the place of (#300)', () => {
        expect(source).not.toMatch(/model-attempt-panel/);
    });

    it('says in the middle of a light tint, where the track record\'s chart would be, when a hold\'s results come in', () => {
        const none = rule('.model-track-none');

        expect(declared(none, 'padding')).toBe('28px 16px');
        expect(declared(none, 'text-align')).toBe('center');
        expect(declared(none, 'font-size')).toBe('15px');
    });

    it('lists when each hold\'s results come in as boxes, as many across as fit at 230px or more', () => {
        const list = rule('.model-when-list');
        const item = rule('.model-when-item');

        expect(declared(list, 'display')).toBe('grid');
        expect(declared(list, 'grid-template-columns')).toBe('repeat(auto-fit, minmax(230px, 1fr))');
        expect(declared(list, 'gap')).toBe('12px');
        expect(declared(item, 'padding')).toBe('10px 12px');
        expect(declared(item, 'border-radius')).toBe('6px');
        expect(declared(rule('.model-when-name'), 'font-weight')).toBe('600');
        expect(declared(rule('.model-when-first'), 'color')).toBe('$gray-6');
    });

    it('shades the hold picked in a lighter wash of the charts\' blue, and gives the table\'s columns their room', () => {
        const table = whole('.model-holds-table');

        expect(declared(rule('.model-holds-picked > th,.model-holds-picked > td,.model-holds-list > .model-holds-picked'), 'background-color'))
            .toBe('color-mix(in srgb, var(--stream-shade-0) 6%, transparent)');
        expect(table.body).toMatch(/tbody th \{\s*min-width: 170px;/);
        expect(table.body).toMatch(/td \{\s*min-width: 112px;/);
    });

    describe('on a phone', () => {
        it('starts the attempts\' headings and lines at the card\'s edge, as its title does, the charts\' values inside them (#300)', () => {
            expect(declared(rule('.model-page .model-card-minor,.model-page .model-attempts > .model-card-sub'), 'margin-left')).toBe('0');
        });

        it('keeps of a legend only which way the axis runs: the popup a tap opens names every line and mark (#300)', () => {
            expect(declared(rule('.model-page .model-legend > li:not(.model-legend-note)'), 'display')).toBe('none');
            expect(rulesOf('.model-page .model-legend').some((each) => declared(each, 'display') === 'grid')).toBe(false);
            expect(rule('.model-page .model-legend-note')).toBeUndefined();
        });

        it('draws the three figures as boxes 8px apart, a name over its value in the middle, on a light tint inside a light rule (#300)', () => {
            const box = rule('.model-summary-boxes .stream-focus-figure');

            expect(declared(rule('.model-summary-boxes .stream-focus-figures'), 'gap')).toBe('8px');
            expect(declared(box, 'align-items')).toBe('center');
            expect(declared(box, 'text-align')).toBe('center');
            expect(declared(box, 'background-color')).toBe('color-mix(in srgb, $gray-1 60%, $white-1)');
            expect(declared(box, 'border')).toBe('1px solid $gray-2');
            expect(declared(box, 'border-radius')).toBe('8px');
            expect(declared(box, 'padding')).toBe('10px');
        });

        it('washes the score\'s box in the charts\' blue where it is better, and in their red where it is worse', () => {
            expect(declared(rule('.model-summary-boxes .stream-focus-figure:has(.stream-focus-figure-good)'), 'background-color'))
                .toBe('color-mix(in srgb, var(--stream-shade-0) 9%, $white-1)');
            expect(declared(rule('.model-summary-boxes .stream-focus-figure:has(.stream-focus-figure-bad)'), 'background-color'))
                .toBe('color-mix(in srgb, var(--stream-missed) 9%, $white-1)');
        });

        it('names each box in 12px gray, over its 17px value in the figures\' ink, whatever its tone', () => {
            const value = rule('.model-summary-boxes .stream-focus-figure-value');

            expect(declared(rule('.model-summary-boxes .stream-focus-figure-label'), 'font-size')).toBe('12px');
            expect(declared(value, 'font-size')).toBe('17px');
            expect(declared(value, 'font-weight')).toBe('600');
            expect(declared(value, 'color')).toBe('$gray-9');
        });

        it('sets \'<score> by hold\' in a closer card, its title a size smaller', () => {
            expect(declared(rule('.model-page .model-by-hold'), 'gap')).toBe('6px');
            expect(declared(rule('.model-page .model-by-hold .model-card-head h5'), 'font-size')).toBe('17px');
        });
    });
});

describe('the controls on a phone (#272)', () => {
    //
    // the rule for `selector` that declares `property`, where a wide screen's
    // rule for it declares others
    //
    const rule = (selector, property) => RULES.find((each) => each.selectors.join() === selector && declared(each, property));

    it('put each picker\'s name over its menu, a Score menu and a Hold menu side by side, one alone across the line (#300)', () => {
        const controls = rule('.model-controls', 'grid-template-columns');

        expect(declared(controls, 'display')).toBe('grid');
        expect(declared(controls, 'grid-template-columns')).toBe('repeat(2, minmax(0, 1fr))');
        expect(declared(controls, 'column-gap')).toBe('10px');
        expect(declared(rule('.model-scores', 'grid-column'), 'grid-column')).toBe('1 / -1');
        expect(declared(rule('.model-controls:has(> .model-holds) > .model-scores', 'grid-column'), 'grid-column')).toBe('auto');
        expect(declared(rule('.model-score-menu', 'min-width'), 'display')).toBe('flex');
    });

    it('draw each picker\'s menu 44px tall in an 8px box, running to its column\'s end', () => {
        const menu = rule('.model-score-menu select', 'width');

        expect(declared(menu, 'width')).toBe('100%');
        expect(declared(menu, 'min-height')).toBe('44px');
        expect(declared(menu, 'border-radius')).toBe('8px');
    });

    it('style no sort menu, which /model no longer has (#300)', () => {
        expect(source).not.toMatch(/model-sort\b/);
    });

    it('stand 0.75rem apart, with no margin under them on a model\'s page, whose column sets its parts apart (#300)', () => {
        expect(declared(rule('.model-controls', 'grid-template-columns'), 'row-gap')).toBe('0.75rem');
        expect(RULES.find((each) => each.selectors.join() === '.model-page .model-controls')).toBeUndefined();
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
        it('sits under the description, in the model\'s own cell, on a wide row and a phone\'s card alike (#300)', () => {
            expect(rulesFor('.model-picks-link').some((each) => declared(each, 'grid-area'))).toBe(false);
            expect(declared(rule('.model-cell-model', 'grid-area'), 'grid-area')).toBe('model');
        });
    });
});

describe('loss\'s three parts in /model\'s list (#283), as #300 lays them out', () => {
    it('stand under a line saying what they add up to, three columns across a wide row', () => {
        const [cells] = rulesOf('.model-part-cells');

        expect(declared(rulesOf('.model-parts-note')[0], 'text-align')).toBe('center');
        expect(declared(rulesOf('.model-parts-note')[0], 'border-bottom')).toBe('1px solid $gray-3');
        expect(declared(rulesOf('.model-parts-note')[0], 'padding-bottom')).toBe('4px');
        expect(declared(cells, 'display')).toBe('grid');
        expect(declared(cells, 'grid-template-columns')).toBe('repeat(3, minmax(0, 1fr))');
        expect(declared(cells, 'gap')).toBe('12px');
    });

    it('name each part over its figure and how it stands, in the open, as no heading names them now', () => {
        const [name] = rulesOf('.model-part-cell-name');

        expect(declared(rulesOf('.model-part-cell')[0], 'flex-direction')).toBe('column');
        expect(declared(name, 'color')).toBe('$gray-6');
        expect(declared(name, 'clip-path')).toBeNull();
        expect(declared(name, 'position')).toBeNull();
        expect(declared(rulesOf('.model-part-cell-value')[0], 'font-size')).toBe('16px');
        expect(source).not.toMatch(/@mixin model-part-lines|@include model-part-lines/);
    });

    it('lay out a line each on a phone\'s card, a light rule under each: the name at the left, the figure and how it stands at the right', () => {
        const [, lines] = rulesOf('.model-part-cells');
        const part = ruleOf('.model-part-cell', 'grid-template-columns');

        expect(declared(lines, 'display')).toBe('flex');
        expect(declared(lines, 'flex-direction')).toBe('column');
        expect(declared(part, 'grid-template-columns')).toBe('minmax(0, 1fr) auto auto');
        expect(declared(part, 'border-bottom')).toBe('1px solid $gray-1');
        expect(declared(rulesOf('.model-parts-note')[1], 'text-align')).toBe('left');
    });
});

describe('the docs\' page on the models, in place of the intro (#296)', () => {
    it('puts the icon at the right end of the title\'s row, as /stream puts its own', () => {
        const icon = RULES.find((each) => each.selectors.join() === '.model-heading .model-heading-docs');

        expect(declared(icon, 'margin-left')).toBe('auto');
        expect(declared(icon, 'align-self')).toBe('center');
    });

    it('shows it on every screen, a computer\'s as a phone\'s, with no Sort row to stand in (#300)', () => {
        expect(source).not.toMatch(/model-controls-docs/);
        expect(source).not.toMatch(/\.model-heading-docs \{\s*display: none;/);
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

/**
 * stylesheet.test.js: what '_model.scss' promises about a row of /model's list --
 * its columns, the bell's among them (#255, #259) -- about the pill of a model
 * taken down (#263), about where loss's three parts go on a model's page (#265),
 * and about the rows that page's three cards share (#267), read out of the
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
        ['compare', 'model', 'score', 'trend', 'live', 'went', 'alarm'].forEach((cell) => {
            expect({ cell, area: placed(cell) }).toEqual({ cell, area: cell });
        });
    });

    it('keeps its bell at the top right, after the box that ticks it', () => {
        const [top] = declared(card, 'grid-template-areas').match(/'[^']*'/g);

        expect(top).toBe('\'model model compare alarm\'');
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

/**
 * cube-chart.test.jsx: a month's distribution as stacked bars built from cubes.
 *
 * What a reader can do with it, as they would: point at a cube or at a row of a
 * bar's list, open a bar's list with a click or from the keyboard, or from a
 * day's '+N more' (#188), and clear it again with a second click, the ×, or
 * Escape, and show the names under the chart and fold them again (#167). Where
 * each cube sits is held by cube-layout.test.js; the tree it draws, by
 * distribution-tree.test.js.
 *
 * Note: the tooltip stays a moment once the pointer leaves its bar (#188). The
 *       cases about that moment run on jest's clock.
 */

import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import CubeChart, { axisRoom } from '../../import/general/cube-chart.jsx';
import distributionTree from '../../import/general/distribution-tree.js';
import { colors_categorical, color_other } from '../../import/general/colors.js';

const SECTORS = { group: ['sector', 'sectors'], member: ['industry', 'industries'], unit: ['record', 'records'] };
const DAYS = { group: ['day', 'days'], member: ['ticker', 'tickers'], unit: ['split', 'splits'] };
const FORMS = { group: ['form', 'forms'], member: ['category', 'categories'], unit: ['filing', 'filings'] };

const ROWS = [
    { sector: 'Information Technology', Semiconductors: 3125430, 'Application Software': 2437128, Hardware: 1977616 },
    { sector: 'Energy', 'Integrated Oil & Gas': 900000, Refining: 741196 },
    { sector: 'Utilities', 'Electric Utilities': 1276399 },
    { sector: 'Financials', Banks: 4000000, Insurance: 2296980, Brokers: 4000 },
];

const SPLITS = [
    { split_date: 'Day 5', splits: 1, tickers: 'cris 1:20' },
    { split_date: 'Day 19', splits: 8, tickers: 'banl 1:13, ccg 1:35, prpl 1:25, tomz 1:3, abcd 2:1, efgh 3:1, ijkl 4:1, mnop 5:1' },
];

//
// a month of stock splits once the api names each split's company: Day 8 of
// three sectors, and Day 9 of one (#190)
//
const SECTORED = [
    { split_date: 'Day 8', sectors: {
        other: { splits: 3, tickers: 'ucar 1:10, aurwf 1:10, ucar 1:20' },
        'Office of Trade & Services': { splits: 2, tickers: 'phge 1:10, jmpld 3:4' },
        'Office of Life Sciences': { splits: 1, tickers: 'cycn 1:7' },
    } },
    { split_date: 'Day 9', sectors: { 'Office of Manufacturing': { splits: 2, tickers: 'qbtz 1:5, stsm 1:2' } } },
];

function forms(count) {
    return Array.from({ length: count }, (ignored, index) => ({ form: `Form ${index + 1}`, Filings: (count - index) * 100 }));
}

//
// a day of `count` splits, each a ticker of its own
//
function longDay(count) {
    const tickers = Array.from({ length: count }, (ignored, index) => `x${String(index).padStart(2, '0')} 1:2`);

    return [{ split_date: 'Day 2', splits: count, tickers: tickers.join(', ') }];
}

function draw({ rows = ROWS, key = 'sector', names = SECTORS, theme = 'light', ...props } = {}) {
    const tree = distributionTree(rows, key, theme);

    return { ...render(<CubeChart tree={tree} names={names} caption='September 2026' height={392} {...props} />), tree };
}

const cubes = (container) => [...container.querySelectorAll('rect.cube-chart-cube')];
const bandOf = (container, key) => cubes(container).filter((cube) => cube.getAttribute('data-band') === key);
const barOf = (container, name) => container.querySelector(`rect.cube-chart-bar[data-name="${name}"]`);
const lit = (container) => cubes(container).filter((cube) => cube.style.opacity === '1');
const tip = (container) => container.querySelector('.cube-chart-tip');
const list = (container) => container.querySelector('.cube-list');
const rowTexts = (container) => [...container.querySelectorAll('.cube-list-row')].map((row) => row.textContent);
const texts = (container, selector) => [...container.querySelectorAll(selector)].map((text) => text.textContent);

const TECH = 'Information Technology\u0000Application Software';

afterEach(() => {
    delete window.ResizeObserver;
    jest.restoreAllMocks();
    jest.useRealTimers();
});

//
// jest's clock moved on by `ms`, and whatever it sets off
//
function wait(ms) {
    act(() => {
        jest.advanceTimersByTime(ms);
    });
}

describe('the chart', () => {
    it('draws a bar per group, in label order, each a stack of cubes', () => {
        const { container } = draw();

        expect([...container.querySelectorAll('rect.cube-chart-bar')].map((bar) => bar.getAttribute('data-name')))
            .toEqual(['Energy', 'Financials', 'Information Technology', 'Utilities']);
        expect(cubes(container).length).toBeGreaterThan(100);
        cubes(container).forEach((cube) => expect(cube.style.opacity).toBe('1'));
    });

    it('colors each cube by its member\'s rank within its bar', () => {
        const { container } = draw();

        expect(bandOf(container, 'Information Technology\u0000Semiconductors')[0]).toHaveAttribute('fill', colors_categorical[0]);
        expect(bandOf(container, TECH)[0]).toHaveAttribute('fill', colors_categorical[1]);
    });

    it('says what a cube is worth, and writes the value axis in short figures (#167)', () => {
        const { container } = draw();

        expect(container.querySelector('.cube-chart-caption').textContent).toBe('Each cube ≈ 10,000 records');
        expect(texts(container, 'text.cube-chart-tick')).toEqual(['0', '2M', '4M', '6M', '8M']);
    });

    it('writes a step of a half as one, where recharts wrote 3.5M as 4e+6 and 10.5M and 14M both as 1e+7', () => {
        const { container } = draw({ rows: [{ sector: 'Information Technology', Semiconductors: 12800000 }] });

        expect(texts(container, 'text.cube-chart-tick')).toEqual(['0', '3.5M', '7M', '10.5M', '14M']);
    });

    it('titles neither axis: the caption and the names say what each is (#167)', () => {
        const { container } = draw({ namesShown: true });

        expect(container.querySelector('text.cube-chart-title')).toBeNull();
        container.querySelectorAll('text.cube-chart-name').forEach((name) => {
            expect(name.getAttribute('transform')).toMatch(/rotate\(-35\)$/);
        });
    });

    it('starts the plot just clear of the value axis\'s figures, and runs it to its right edge (#167)', () => {
        const { container, tree } = draw();
        const [axis, base] = container.querySelectorAll('line.cube-chart-axis');

        expect(axis.getAttribute('x1')).toBe(String(axisRoom(tree)));
        expect(base.getAttribute('x2')).toBe('1100');
    });

    it('says a cube is a single record where it is', () => {
        const { container } = draw({ rows: SPLITS, key: 'split_date', names: DAYS });

        expect(container.querySelector('.cube-chart-caption').textContent).toBe('Each cube is 1 split');
    });

    it('describes itself to a screen reader', () => {
        const { container } = draw();

        expect(container.querySelector('svg')).toHaveAttribute('role', 'group');
        expect(container.querySelector('svg'))
            .toHaveAttribute('aria-label', 'Records by sector, September 2026. Each cube ≈ 10,000 records.');
    });

    it('carries the api icons and the loader it is handed', () => {
        const { container } = draw({ actions: <a href='#docs'>API docs</a>, overlay: <div className='loading' /> });

        expect(within(container.querySelector('.cube-chart-actions')).getByText('API docs')).toBeInTheDocument();
        expect(container.querySelector('.cube-chart-plot .loading')).not.toBeNull();
    });

    it('draws no icons where it is handed none', () => {
        const { container } = draw();

        expect(container.querySelector('.cube-chart-actions')).toBeNull();
    });

    it('sets the caption and the icons inside the plot, in from its top corners (#169)', () => {
        const { container, tree } = draw({ actions: <a href='#docs'>API docs</a> });
        const caption = container.querySelector('.cube-chart-caption');
        const actions = container.querySelector('.cube-chart-actions');

        expect(container.querySelector('text.cube-chart-caption')).toBeNull();
        expect(caption.tagName).toBe('DIV');
        expect(caption.style.left).toBe(`${axisRoom(tree) + 10}px`);
        expect(caption.style.top).toBe('16px');
        expect(actions.style.right).toBe('8px');
        expect(actions.style.top).toBe('12px');
    });

    it('leaves the caption to the chart\'s own label for a screen reader, so it is heard once', () => {
        const { container } = draw();

        expect(container.querySelector('.cube-chart-caption')).toHaveAttribute('aria-hidden', 'true');
    });

    it('starts the plot 8px under its top, with no line over it for the caption (#169)', () => {
        const { container } = draw();
        const [axis] = container.querySelectorAll('line.cube-chart-axis');

        expect(axis.getAttribute('y1')).toBe('8');
    });
});

describe('the width it draws at', () => {
    it('draws at a default width until the page has one to give', () => {
        const { container } = draw();

        expect(container.querySelector('svg')).toHaveAttribute('width', '1100');
    });

    it('measures the page, and again whenever it is resized', () => {
        const width = jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(800);
        const removed = jest.spyOn(window, 'removeEventListener');
        const { container, unmount } = draw();

        expect(container.querySelector('svg')).toHaveAttribute('width', '800');

        width.mockReturnValue(1200);
        act(() => {
            window.dispatchEvent(new Event('resize'));
        });

        expect(container.querySelector('svg')).toHaveAttribute('width', '1200');

        unmount();
        expect(removed).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('watches its own box where the browser can', () => {
        let changed = null;
        const disconnect = jest.fn();
        window.ResizeObserver = class {
            constructor(callback) {
                changed = callback;
            }

            observe() {}

            disconnect() {
                disconnect();
            }
        };
        const width = jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(900);
        const { container, unmount } = draw();

        width.mockReturnValue(1000);
        act(() => {
            changed();
        });

        expect(container.querySelector('svg')).toHaveAttribute('width', '1000');

        unmount();
        expect(disconnect).toHaveBeenCalled();
    });
});

describe('pointing at a cube', () => {
    it('lights up its band and fades every other cube', () => {
        const { container } = draw();
        const band = bandOf(container, TECH);

        fireEvent.mouseEnter(band[0]);

        expect(lit(container)).toEqual(band);
        expect(cubes(container).find((cube) => cube.getAttribute('data-band') !== TECH).style.opacity).toBe('0.2');
    });

    it('names the band, its count and its share of the bar, and nothing about a click (#179)', () => {
        const { container } = draw();

        fireEvent.mouseEnter(bandOf(container, TECH)[0]);

        expect(tip(container).textContent)
            .toBe('Information TechnologyApplication Software2,437,12832% of Information Technology');
        expect(tip(container).querySelector('.cube-chart-tip-swatch').style.background).toBe('rgb(235, 104, 52)');
    });

    it('sets the tooltip beside a bar on the left, and before one on the right', () => {
        const { container } = draw();

        fireEvent.mouseEnter(bandOf(container, 'Energy\u0000Refining')[0]);
        expect(tip(container).style.left).not.toBe('');

        fireEvent.mouseEnter(bandOf(container, TECH)[0]);
        expect(tip(container).style.right).not.toBe('');
    });

    it('lets go a moment after the pointer leaves the cubes for the chart, so it can reach the tooltip (#188)', () => {
        jest.useFakeTimers();
        const { container } = draw();

        fireEvent.mouseEnter(bandOf(container, TECH)[0]);
        fireEvent.mouseEnter(container.querySelector('.cube-chart-backdrop'));
        expect(tip(container)).not.toBeNull();

        wait(249);
        expect(tip(container)).not.toBeNull();

        wait(1);
        expect(tip(container)).toBeNull();
        expect(lit(container)).toHaveLength(cubes(container).length);
    });

    it('lets go at once when the pointer leaves the chart', () => {
        const { container } = draw();

        fireEvent.mouseEnter(bandOf(container, TECH)[0]);
        fireEvent.mouseLeave(container.querySelector('.cube-chart-plot'));
        expect(tip(container)).toBeNull();
    });

    it('moves straight to another cube pointed at within the moment, and stays there', () => {
        jest.useFakeTimers();
        const { container } = draw();

        fireEvent.mouseEnter(bandOf(container, TECH)[0]);
        fireEvent.mouseEnter(container.querySelector('.cube-chart-backdrop'));
        fireEvent.mouseEnter(bandOf(container, 'Energy\u0000Refining')[0]);
        expect(tip(container).querySelector('.cube-chart-tip-title').textContent).toBe('Energy');

        wait(1000);
        expect(tip(container).querySelector('.cube-chart-tip-title').textContent).toBe('Energy');
    });

    it('stops the moment\'s clock when the chart goes away', () => {
        jest.useFakeTimers();
        const cleared = jest.spyOn(window, 'clearTimeout');
        const { container, unmount } = draw();

        fireEvent.mouseEnter(bandOf(container, TECH)[0]);
        fireEvent.mouseEnter(container.querySelector('.cube-chart-backdrop'));
        unmount();

        expect(cleared).toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
    });

    it('names a single series by what it counts, and its share of the month', () => {
        const { container } = draw({ rows: forms(3), key: 'form', names: FORMS });

        fireEvent.mouseEnter(cubes(container)[0]);

        expect(tip(container).textContent).toBe('Form 1Filings30050% of all');
    });

    it('lists a day\'s tickers, six of them, and counts the rest', () => {
        const { container } = draw({ rows: SPLITS, key: 'split_date', names: DAYS });

        fireEvent.mouseEnter(bandOf(container, 'Day 19')[0]);

        const tickers = [...tip(container).querySelectorAll('.cube-chart-tip-ticker')].map((row) => row.textContent);
        expect(tickers).toEqual(['abcd2:1', 'banl1:13', 'ccg1:35', 'efgh3:1', 'ijkl4:1', 'mnop5:1']);
        expect(tip(container).querySelector('.cube-chart-tip-more').textContent).toBe('+2 more');
    });

    it('names six tickers whatever the day holds, so a long day is no taller (#188)', () => {
        const { container } = draw({ rows: longDay(45), key: 'split_date', names: DAYS });

        fireEvent.mouseEnter(bandOf(container, 'Day 2')[0]);

        expect(tip(container).querySelectorAll('.cube-chart-tip-ticker')).toHaveLength(6);
        expect(tip(container).querySelector('.cube-chart-tip-more').textContent).toBe('+39 more');
    });

    it('makes +N more a button, kept from the keyboard, which reaches the bar itself (#188)', () => {
        const { container } = draw({ rows: SPLITS, key: 'split_date', names: DAYS });

        fireEvent.mouseEnter(bandOf(container, 'Day 19')[0]);

        const more = tip(container).querySelector('.cube-chart-tip-more');
        expect(more.tagName).toBe('BUTTON');
        expect(more).toHaveAttribute('type', 'button');
        expect(more).toHaveAttribute('tabindex', '-1');
    });

    it('opens the day\'s whole list from +N more, and lets the tooltip go (#188)', () => {
        const { container } = draw({ rows: SPLITS, key: 'split_date', names: DAYS });

        fireEvent.mouseEnter(bandOf(container, 'Day 19')[0]);
        fireEvent.click(tip(container).querySelector('.cube-chart-tip-more'));

        expect(tip(container)).toBeNull();
        expect(list(container).querySelector('.cube-list-title').textContent).toBe('Day 19');
        expect(rowTexts(container)).toHaveLength(8);
    });

    it('stays while the pointer is on +N more, and lets go a moment after it leaves (#188)', () => {
        jest.useFakeTimers();
        const { container } = draw({ rows: SPLITS, key: 'split_date', names: DAYS });

        fireEvent.mouseEnter(bandOf(container, 'Day 19')[0]);
        fireEvent.mouseEnter(container.querySelector('.cube-chart-backdrop'));
        wait(200);
        fireEvent.mouseEnter(tip(container).querySelector('.cube-chart-tip-more'));

        wait(1000);
        expect(tip(container)).not.toBeNull();

        fireEvent.mouseLeave(tip(container).querySelector('.cube-chart-tip-more'));
        wait(250);
        expect(tip(container)).toBeNull();
    });

    it('lists a day of one ticker without counting more', () => {
        const { container } = draw({ rows: SPLITS, key: 'split_date', names: DAYS });

        fireEvent.mouseEnter(bandOf(container, 'Day 5')[0]);

        expect(tip(container).querySelectorAll('.cube-chart-tip-ticker')).toHaveLength(1);
        expect(tip(container).querySelector('.cube-chart-tip-more')).toBeNull();
    });

    it('says what Other rolled up', () => {
        const { container } = draw({ rows: forms(25), key: 'form', names: FORMS });

        fireEvent.mouseEnter(bandOf(container, '\u0000other')[0]);

        expect(tip(container).querySelector('.cube-chart-tip-detail').textContent).toBe('the 6 smallest forms');
    });

    it.each([
        ['a bar that lists industries', {}, TECH],
        ['a day of tickers', { rows: SPLITS, key: 'split_date', names: DAYS }, 'Day 19'],
        ['Other\'s rolled-up forms', { rows: forms(25), key: 'form', names: FORMS }, '\u0000other'],
        ['a bar with nothing under it', {}, 'Utilities\u0000Electric Utilities'],
    ])('says nothing about a click, on %s (#179)', (name, options, band) => {
        const { container } = draw(options);

        fireEvent.mouseEnter(bandOf(container, band)[0]);

        expect(tip(container).textContent).not.toMatch(/click/i);
    });
});

describe('a bar\'s list', () => {
    it('opens under the chart when a cube of the bar is clicked', () => {
        const { container } = draw();

        fireEvent.click(bandOf(container, TECH)[0]);

        expect(within(list(container)).getByText('Information Technology')).toBeInTheDocument();
        expect(list(container).querySelector('.cube-list-meta').textContent)
            .toBe('7,540,174 records · 3 industries · 45% of all');
        expect(rowTexts(container)).toEqual([
            'Semiconductors3,125,43041%',
            'Application Software2,437,12832%',
            'Hardware1,977,61626%',
        ]);
    });

    it('keeps the clicked bar lit and fades the others', () => {
        const { container } = draw();

        fireEvent.click(barOf(container, 'Information Technology'));

        const mine = cubes(container).filter((cube) => cube.getAttribute('data-band').startsWith('Information Technology\u0000'));
        expect(lit(container)).toEqual(mine);
    });

    it('sets its caret over the bar it belongs to', () => {
        const { container } = draw({ namesShown: true });

        fireEvent.click(barOf(container, 'Energy'));

        const name = [...container.querySelectorAll('text.cube-chart-name')].find((text) => text.textContent === 'Energy');
        const center = Number(/translate\(([\d.]+),/.exec(name.getAttribute('transform'))[1]);
        expect(parseFloat(list(container).querySelector('.cube-list-caret').style.left)).toBeCloseTo(center - 6, 6);
    });

    it('clears when the same bar is clicked again', () => {
        const { container } = draw();

        fireEvent.click(barOf(container, 'Energy'));
        fireEvent.click(bandOf(container, 'Energy\u0000Refining')[0]);

        expect(list(container)).toBeNull();
        expect(lit(container)).toHaveLength(cubes(container).length);
    });

    it('says nothing about a click while the bar\'s list is open, which has its own way out (#179)', () => {
        const { container } = draw();

        fireEvent.click(barOf(container, 'Information Technology'));
        fireEvent.mouseEnter(bandOf(container, TECH)[0]);

        expect(tip(container).textContent).not.toMatch(/click/i);
        expect(screen.getByRole('button', { name: 'Clear the list' })).toBeInTheDocument();
    });

    it('switches to another bar clicked', () => {
        const { container } = draw();

        fireEvent.click(barOf(container, 'Energy'));
        fireEvent.click(barOf(container, 'Financials'));

        expect(list(container).querySelector('.cube-list-title').textContent).toBe('Financials');
        expect(rowTexts(container)[2]).toBe('Brokers4,000<1%');
    });

    it('clears from its ×', () => {
        const { container } = draw();

        fireEvent.click(barOf(container, 'Energy'));
        fireEvent.click(screen.getByRole('button', { name: 'Clear the list' }));

        expect(list(container)).toBeNull();
    });

    it('opens nowhere for a bar with nothing under it', () => {
        const { container } = draw();

        fireEvent.click(barOf(container, 'Utilities'));
        fireEvent.click(bandOf(container, 'Utilities\u0000Electric Utilities')[0]);

        expect(list(container)).toBeNull();
        expect(barOf(container, 'Utilities')).not.toHaveAttribute('tabindex');
    });

    it('lights a row\'s band when the row is pointed at, without a tooltip', () => {
        const { container } = draw();

        fireEvent.click(barOf(container, 'Information Technology'));
        const row = container.querySelectorAll('.cube-list-row')[1];
        fireEvent.mouseEnter(row);

        expect(lit(container)).toEqual(bandOf(container, TECH));
        expect(row).toHaveClass('is-lit');
        expect(tip(container)).toBeNull();

        fireEvent.mouseLeave(list(container));
        expect(row).not.toHaveClass('is-lit');
    });

    it('marks the row of the band a cube is pointed at', () => {
        const { container } = draw();

        fireEvent.click(barOf(container, 'Information Technology'));
        fireEvent.mouseEnter(bandOf(container, TECH)[0]);

        expect(container.querySelectorAll('.cube-list-row')[1]).toHaveClass('is-lit');
    });

    it('lists a day\'s tickers and their ratios', () => {
        const { container } = draw({ rows: SPLITS, key: 'split_date', names: DAYS });

        fireEvent.click(barOf(container, 'Day 19'));

        expect(list(container).querySelector('.cube-list-meta').textContent).toBe('8 splits · 89% of all');
        expect(rowTexts(container).slice(0, 2)).toEqual(['abcd2:1', 'banl1:13']);
        expect(list(container).querySelector('.cube-list-share')).toBeNull();

        //
        // a ticker is not a band of its own, so its row lights nothing past the day
        //
        fireEvent.mouseEnter(container.querySelector('.cube-list-row'));
        expect(lit(container)).toEqual(bandOf(container, 'Day 19'));
    });

    it('lists the groups Other rolled up, largest first', () => {
        const { container } = draw({ rows: forms(25), key: 'form', names: FORMS });

        fireEvent.click(barOf(container, 'Other'));

        expect(list(container).querySelector('.cube-list-meta').textContent).toBe('2,100 filings · 6 forms');
        expect(rowTexts(container)).toEqual([
            'Form 2060029%', 'Form 2150024%', 'Form 2240019%', 'Form 2330014%', 'Form 242009.5%', 'Form 251004.8%',
        ]);
    });

    it('runs down three columns where it is short', () => {
        const { container } = draw({ rows: forms(25), key: 'form', names: FORMS });

        fireEvent.click(barOf(container, 'Other'));

        expect(list(container).querySelector('.cube-list-rows').style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
        expect(list(container).querySelector('.cube-list-rows').style.gridTemplateRows).toBe('repeat(2, auto)');
    });

    it.each([
        [24, 3, 8],
        [45, 5, 9],
        [70, 6, 12],
    ])('stands a day of %s tickers in %s columns of %s, a column to every 9 and 6 at most (#188)', (count, columns, rows) => {
        const { container } = draw({ rows: longDay(count), key: 'split_date', names: DAYS });

        fireEvent.click(barOf(container, 'Day 2'));

        expect(list(container).querySelector('.cube-list-rows').style.gridTemplateColumns).toBe(`repeat(${columns}, minmax(0, 1fr))`);
        expect(list(container).querySelector('.cube-list-rows').style.gridTemplateRows).toBe(`repeat(${rows}, auto)`);
        expect(list(container).querySelector('.cube-list-meta').textContent).toBe(`${count} splits · 100% of all`);
    });
});

describe('a day banded by sector (#190)', () => {
    const TRADE = 'Day 8\u0000Trade & Services';
    const NONE = 'Day 8\u0000No sector';

    it('draws no legend over the chart: its popup names the sectors (#192)', () => {
        const { container } = draw({ rows: SECTORED, key: 'split_date', names: DAYS });

        expect(container.querySelector('.cube-chart-legend')).toBeNull();
        expect(container.querySelector('.cube-chart').firstElementChild).toHaveClass('cube-chart-plot');
    });

    it('colors each band of a day by its sector, and a day of the api\'s old answer in one blue', () => {
        const { container } = draw({ rows: SECTORED, key: 'split_date', names: DAYS });

        expect(bandOf(container, TRADE)).toHaveLength(2);
        expect(bandOf(container, TRADE)[0]).toHaveAttribute('fill', colors_categorical[3]);
        expect(bandOf(container, NONE)[0]).toHaveAttribute('fill', color_other);

        const old = draw({ rows: SPLITS, key: 'split_date', names: DAYS });
        expect(bandOf(old.container, 'Day 19')[0]).toHaveAttribute('fill', colors_categorical[0]);
    });

    it('lists the bar\'s sectors in the popup, in their colors and the bar\'s order, the one pointed at marked (#192)', () => {
        const { container } = draw({ rows: SECTORED, key: 'split_date', names: DAYS });

        fireEvent.mouseEnter(bandOf(container, NONE)[0]);

        const rows = [...tip(container).querySelectorAll('.cube-chart-tip-row')];
        expect(rows.map((row) => row.textContent)).toEqual(['Trade & Services2', 'Life Sciences1', 'No sector3']);
        expect(rows.map((row) => row.querySelector('.cube-chart-tip-swatch').style.background))
            .toEqual(['rgb(237, 161, 0)', 'rgb(42, 120, 214)', 'rgb(211, 211, 206)']);
        expect(rows.map((row) => row.classList.contains('is-lit'))).toEqual([false, false, true]);
    });

    it('names, under the sectors, the share of the day and the tickers of the one pointed at', () => {
        const { container } = draw({ rows: SECTORED, key: 'split_date', names: DAYS });

        fireEvent.mouseEnter(bandOf(container, TRADE)[0]);

        expect(tip(container).querySelector('.cube-chart-tip-detail').textContent).toBe('33% of Day 8');
        expect([...tip(container).querySelectorAll('.cube-chart-tip-ticker')].map((row) => row.textContent))
            .toEqual(['jmpld3:4', 'phge1:10']);
        expect(tip(container).querySelector('.cube-chart-tip-row.is-lit').textContent).toBe('Trade & Services2');
        expect(tip(container).querySelector('.cube-chart-tip-more')).toBeNull();
    });

    it('keeps a single row in the popup for a bar of any other kind', () => {
        const { container } = draw();

        fireEvent.mouseEnter(bandOf(container, TECH)[0]);

        expect(tip(container).querySelectorAll('.cube-chart-tip-row')).toHaveLength(1);
        expect(tip(container).querySelector('.cube-chart-tip-row.is-lit')).toBeNull();
    });

    it('names six of a band\'s tickers, then +N more, which opens the day\'s whole list', () => {
        const tickers = Array.from({ length: 8 }, (ignored, at) => `t${at} 1:2`).join(', ');
        const { container } = draw({
            rows: [{ split_date: 'Day 2', sectors: { 'Office of Technology': { splits: 8, tickers: tickers }, other: { splits: 1, tickers: 'zz 1:3' } } }],
            key: 'split_date',
            names: DAYS,
        });

        fireEvent.mouseEnter(bandOf(container, 'Day 2\u0000Technology')[0]);

        expect(tip(container).querySelectorAll('.cube-chart-tip-ticker')).toHaveLength(6);
        fireEvent.click(tip(container).querySelector('.cube-chart-tip-more'));
        expect(tip(container)).toBeNull();
        expect(list(container).querySelector('.cube-list-title').textContent).toBe('Day 2');
        expect(rowTexts(container)).toHaveLength(9);
    });

    it('reads a day out with the tickers it lists, however many sectors hold them', () => {
        const { container } = draw({ rows: SECTORED, key: 'split_date', names: DAYS });

        expect(barOf(container, 'Day 8')).toHaveAttribute('aria-label', 'Day 8, 6 splits, 75% of all. Lists its 6 tickers');
        expect(barOf(container, 'Day 9')).toHaveAttribute('aria-label', 'Day 9, 2 splits, 25% of all. Lists its 2 tickers');
    });

    it('heads a day\'s tickers with their sectors, in the bar\'s order, each ticker in its sector\'s color', () => {
        const { container } = draw({ rows: SECTORED, key: 'split_date', names: DAYS });

        fireEvent.click(barOf(container, 'Day 8'));

        expect(list(container).querySelector('.cube-list-meta').textContent).toBe('6 splits · 75% of all');
        expect(texts(container, '.cube-list-sector-head')).toEqual(['Trade & Services2', 'Life Sciences1', 'No sector3']);
        expect([...list(container).querySelectorAll('.cube-list-rows')].map((rows) => rows.getAttribute('aria-label')))
            .toEqual(['Trade & Services', 'Life Sciences', 'No sector']);
        expect(rowTexts(container)).toEqual(['jmpld3:4', 'phge1:10', 'cycn1:7', 'aurwf1:10', 'ucar1:10', 'ucar1:20']);

        const swatches = [...list(container).querySelectorAll('.cube-list-row .cube-list-swatch')];
        expect(swatches[0].style.background).toBe('rgb(237, 161, 0)');
        expect(swatches[5].style.background).toBe('rgb(211, 211, 206)');
    });

    it('runs a day\'s sectors down the list\'s columns, counting their heads, each heading a column of its tickers', () => {
        const { container } = draw({ rows: SECTORED, key: 'split_date', names: DAYS });

        fireEvent.click(barOf(container, 'Day 8'));

        const lists = [...list(container).querySelectorAll('.cube-list-rows')];
        expect(list(container).querySelector('.cube-list-sectors').getAttribute('style')).toMatch(/column-count: 3;/);
        expect(lists.map((rows) => rows.style.gridTemplateColumns)).toEqual(Array(3).fill('repeat(1, minmax(0, 1fr))'));
        expect(lists.map((rows) => rows.style.gridTemplateRows)).toEqual(['repeat(2, auto)', 'repeat(1, auto)', 'repeat(3, auto)']);
        expect(list(container).querySelectorAll('.cube-list-sector.is-long')).toHaveLength(0);
    });

    it('lets a sector longer than a column run on into the next', () => {
        const tickers = Array.from({ length: 12 }, (ignored, at) => `t${String(at).padStart(2, '0')} 1:2`).join(', ');
        const { container } = draw({
            rows: [{ split_date: 'Day 2', sectors: { 'Office of Technology': { splits: 12, tickers: tickers }, other: { splits: 1, tickers: 'zz 1:3' } } }],
            key: 'split_date',
            names: DAYS,
        });

        fireEvent.click(barOf(container, 'Day 2'));

        expect([...list(container).querySelectorAll('.cube-list-sector')].map((sector) => sector.className))
            .toEqual(['cube-list-sector is-long', 'cube-list-sector']);
        expect(list(container).querySelector('.cube-list-sectors').getAttribute('style')).toMatch(/column-count: 3;/);
    });

    it('lights a sector\'s band from its heading or one of its tickers, and marks the heading', () => {
        const { container } = draw({ rows: SECTORED, key: 'split_date', names: DAYS });

        fireEvent.click(barOf(container, 'Day 8'));
        fireEvent.mouseEnter(container.querySelector('.cube-list-sector-head'));

        expect(lit(container)).toEqual(bandOf(container, TRADE));
        expect(container.querySelector('.cube-list-sector-head')).toHaveClass('is-lit');
        expect(tip(container)).toBeNull();

        fireEvent.mouseEnter(list(container).querySelectorAll('.cube-list-row')[5]);

        expect(lit(container)).toEqual(bandOf(container, NONE));
        expect(container.querySelectorAll('.cube-list-sector-head')[2]).toHaveClass('is-lit');
        expect(list(container).querySelectorAll('.cube-list-row.is-lit')).toHaveLength(0);
    });

    it('opens a day of one sector to its tickers', () => {
        const { container } = draw({ rows: SECTORED, key: 'split_date', names: DAYS });

        fireEvent.click(barOf(container, 'Day 9'));

        expect(texts(container, '.cube-list-sector-head')).toEqual(['Manufacturing2']);
        expect(rowTexts(container)).toEqual(['qbtz1:5', 'stsm1:2']);
    });
});

describe('the names under the chart (#167)', () => {
    const shown = (container) => texts(container, 'text.cube-chart-name');
    const bar = () => screen.queryByRole('button', { name: 'Show the sector names' });

    it('start folded into a green bar, named for the groups it holds', () => {
        const { container } = draw();

        expect(shown(container)).toEqual([]);
        expect(bar()).toHaveClass('cube-chart-rail');
        expect(bar()).toHaveTextContent('Sectors');
    });

    it('name the bar for each stream\'s own groups', () => {
        draw({ rows: forms(3), key: 'form', names: FORMS });

        expect(screen.getByRole('button', { name: 'Show the form names' })).toHaveTextContent('Forms');
    });

    it('show at a click on the bar, in its place, and fold at a click anywhere on them', () => {
        const { container } = draw();

        fireEvent.click(bar());

        expect(shown(container)).toEqual(['Energy', 'Financials', 'Information Technology', 'Utilities']);
        expect(bar()).toBeNull();

        fireEvent.click(container.querySelector('.cube-chart-names-hit'));

        expect(shown(container)).toEqual([]);
        expect(bar()).not.toBeNull();
    });

    it('are a button themselves, which a keyboard reaches, with no arrow on them (#204)', () => {
        const { container } = draw({ namesShown: true });
        const band = screen.getByRole('button', { name: 'Hide the sector names' });

        expect(band).toHaveClass('cube-chart-names-hit');
        expect(band).toHaveAttribute('tabindex', '0');
        expect(band).toHaveAttribute('title', 'Hide the sector names');
        expect(band).toBeEmptyDOMElement();
        expect(container.querySelector('.cube-chart-fold')).toBeNull();
    });

    it.each([
        ['Enter', 'Enter'],
        ['Space', ' '],
    ])('fold at %s, as at a click, and the page does not take the key as well', (_, key) => {
        const onNames = jest.fn();
        const { container } = draw({ namesShown: true, onNames: onNames });

        const taken = !fireEvent.keyDown(screen.getByRole('button', { name: 'Hide the sector names' }), { key: key });

        expect(shown(container)).toEqual([]);
        expect(bar()).not.toBeNull();
        expect(onNames.mock.calls).toEqual([[false]]);
        expect(taken).toBe(true);
    });

    it('stay shown at any other key, which goes on to the page', () => {
        const { container } = draw({ namesShown: true });

        const taken = !fireEvent.keyDown(screen.getByRole('button', { name: 'Hide the sector names' }), { key: 'Tab' });

        expect(shown(container)).toHaveLength(4);
        expect(taken).toBe(false);
    });

    it('start shown when the page kept them shown', () => {
        const { container } = draw({ namesShown: true });

        expect(shown(container)).toHaveLength(4);
        expect(bar()).toBeNull();
    });

    it('tell the page each time they are shown or folded, so it can keep which', () => {
        const onNames = jest.fn();
        const { container } = draw({ onNames: onNames });

        fireEvent.click(bar());
        fireEvent.click(container.querySelector('.cube-chart-names-hit'));

        expect(onNames.mock.calls).toEqual([[true], [false]]);
    });

    it('take their room from under the chart, which keeps its plot and grows by the difference', () => {
        const { container } = draw();
        const base = () => container.querySelectorAll('line.cube-chart-axis')[1].getAttribute('y1');
        const folded = { height: container.querySelector('svg').getAttribute('height'), base: base() };

        fireEvent.click(bar());

        expect(folded.height).toBe('316');
        expect(container.querySelector('svg')).toHaveAttribute('height', '366');
        expect(base()).toBe(folded.base);
    });

    it('stand 26px short of the height the chart is given, the caption\'s old line, either way (#169)', () => {
        const { container } = draw({ namesShown: true });

        expect(container.querySelector('svg')).toHaveAttribute('height', String(392 - 26));
    });

    it('leave the value axis alone: it never folds', () => {
        const { container } = draw();

        expect(texts(container, 'text.cube-chart-tick')).toHaveLength(5);
        expect(screen.queryByRole('button', { name: /axis/ })).toBeNull();
    });
});

describe('a month of stock splits, two cubes across (#192)', () => {
    //
    // twenty days, as September 2026 has, the busiest of them 15 splits
    //
    function month(busiest) {
        return Array.from({ length: 20 }, (ignored, at) => {
            const count = at === 9 ? busiest : (at % 3) + 1;
            const tickers = Array.from({ length: count }, (none, index) => `d${at}t${index} 1:2`).join(', ');

            return { split_date: `Day ${at + 1}`, splits: count, tickers: tickers };
        });
    }

    it('stands a quiet month\'s days two cubes across, a split a cube, on an axis twice as high', () => {
        const { container } = draw({ rows: month(15), key: 'split_date', names: DAYS });
        const day = bandOf(container, 'Day 10');

        expect(container.querySelector('.cube-chart-caption').textContent).toBe('Each cube is 1 split');
        expect(texts(container, 'text.cube-chart-tick')).toEqual(['0', '8', '16', '24', '32']);
        expect(day).toHaveLength(15);
        expect(new Set(day.map((cube) => cube.getAttribute('x'))).size).toBe(2);
    });

    it('leaves the room the axis it draws needs, though its figures run past the busiest day\'s', () => {
        const { container, tree } = draw({ rows: month(5), key: 'split_date', names: DAYS });
        const ticks = texts(container, 'text.cube-chart-tick').map(Number);
        const axis = container.querySelector('line.cube-chart-axis');

        expect(ticks[ticks.length - 1]).toBeGreaterThan(9);
        expect(axisRoom(tree)).toBeLessThan(axisRoom(tree, ticks));
        expect(Number(axis.getAttribute('x1'))).toBe(axisRoom(tree, ticks));
    });

    it('leaves a month of anything else on the axis its busiest bar needs', () => {
        const { container } = draw();

        expect(texts(container, 'text.cube-chart-tick')).toEqual(['0', '2M', '4M', '6M', '8M']);
    });
});

describe('the room the value axis takes (#167)', () => {
    it('is the widest figure, the gap and the tick', () => {
        const tree = distributionTree([{ sector: 'Information Technology', Semiconductors: 12800000 }], 'sector');

        expect(axisRoom(tree)).toBe(44);
    });

    it('is narrower for a month of a few splits than for one of millions of records', () => {
        const splits = distributionTree(SPLITS, 'split_date');
        const records = distributionTree(ROWS, 'sector');

        expect(axisRoom(splits)).toBeLessThan(axisRoom(records));
    });
});

describe('new rows under the chart', () => {
    //
    // the page keys the chart by stream and month, so the rows can still change
    // under it -- arriving after the first draw, or redrawn for the theme
    //
    function redraw(view, rows) {
        view.rerender(<CubeChart tree={distributionTree(rows, 'sector')} names={SECTORS} caption='September 2026' height={392} />);
    }

    it('lets go of a list whose bar the new rows do not hold', () => {
        const view = draw();

        fireEvent.click(barOf(view.container, 'Energy'));
        redraw(view, ROWS.filter((row) => row.sector !== 'Energy'));

        expect(list(view.container)).toBeNull();
        expect(lit(view.container)).toHaveLength(cubes(view.container).length);
    });

    it('lets go of a band the new rows do not hold', () => {
        const view = draw();

        fireEvent.mouseEnter(bandOf(view.container, TECH)[0]);
        redraw(view, ROWS.filter((row) => row.sector !== 'Information Technology'));

        expect(tip(view.container)).toBeNull();
    });
});

describe('the keyboard', () => {
    it('reaches each bar with something under it, and names it', () => {
        const { container } = draw();
        const reached = [...container.querySelectorAll('rect[role="button"]')];

        expect(reached.map((bar) => bar.getAttribute('data-name'))).toEqual(['Energy', 'Financials', 'Information Technology']);
        reached.forEach((bar) => expect(bar).toHaveAttribute('tabindex', '0'));
        expect(barOf(container, 'Energy'))
            .toHaveAttribute('aria-label', 'Energy, 1,641,196 records, 9.8% of all. Lists its 2 industries');
        expect(barOf(container, 'Energy')).toHaveAttribute('aria-expanded', 'false');
    });

    it('opens and clears a bar\'s list with Enter and Space', () => {
        const { container } = draw();
        const bar = barOf(container, 'Energy');

        fireEvent.keyDown(bar, { key: 'Enter' });
        expect(list(container)).not.toBeNull();
        expect(bar).toHaveAttribute('aria-expanded', 'true');

        fireEvent.keyDown(bar, { key: ' ' });
        expect(list(container)).toBeNull();
    });

    it('clears the list with Escape', () => {
        const { container } = draw();

        fireEvent.keyDown(barOf(container, 'Energy'), { key: 'Enter' });
        fireEvent.keyDown(screen.getByRole('button', { name: 'Clear the list' }), { key: 'Escape' });

        expect(list(container)).toBeNull();
    });

    it('ignores any other key', () => {
        const { container } = draw();

        fireEvent.keyDown(barOf(container, 'Energy'), { key: 'a' });

        expect(list(container)).toBeNull();
    });
});

describe('the company facts\' statuses, named as the page names them (#230)', () => {
    const FACTS = { group: ['form', 'forms'], member: ['status', 'statuses'], unit: ['fact', 'facts'] };
    const MONTH = [
        { form: 'Form 10-Q', new: 3691, repeated: 3300, changed: 98 },
        { form: 'Form 424B2', new: 3046 },
    ];

    function facts() {
        const tree = distributionTree(
            MONTH,
            'form',
            'light',
            ['new', 'repeated', 'changed'],
            { new: 'New', repeated: 'Repeated', changed: 'Changed' }
        );

        return render(<CubeChart tree={tree} names={FACTS} caption='September 2026' height={392} />);
    }

    it('names a status with a capital where the pointer is', () => {
        const { container } = facts();

        fireEvent.mouseEnter(bandOf(container, 'Form 10-Q\u0000New')[0]);

        expect(tip(container).textContent).toMatch(/^Form 10-QNew3,691/);
    });

    it('names them with a capital in a form\'s list, in their order', () => {
        const { container } = facts();

        fireEvent.keyDown(barOf(container, 'Form 10-Q'), { key: 'Enter' });

        expect(texts(container, '.cube-list-name')).toEqual(['New', 'Repeated', 'Changed']);
    });
});

//
// #235: the page can hold which bar's list is open -- /data keeps it in its
// address, so a link opens the list -- and is told each time one is opened or
// cleared. It knows Other's bar as 'Other'
//
describe('a list the page holds open (#235)', () => {
    const title = (container) => list(container).querySelector('.cube-list-title').textContent;

    it('opens the bar the page names, and leaves the next one to the page', () => {
        const onOpen = jest.fn();
        const { container } = draw({ open: 'Energy', onOpen: onOpen });

        expect(title(container)).toBe('Energy');
        expect(barOf(container, 'Energy')).toHaveAttribute('aria-expanded', 'true');

        fireEvent.click(barOf(container, 'Financials'));

        expect(onOpen).toHaveBeenCalledWith('Financials');
        expect(title(container)).toBe('Energy');
    });

    it.each([
        ['a second click on its bar', (container) => fireEvent.click(barOf(container, 'Energy'))],
        ['its ×', () => fireEvent.click(screen.getByRole('button', { name: 'Clear the list' }))],
        ['Escape', (container) => fireEvent.keyDown(barOf(container, 'Energy'), { key: 'Escape' })],
    ])('tells the page the list is cleared, from %s', (way, clear) => {
        const onOpen = jest.fn();
        const { container } = draw({ open: 'Energy', onOpen: onOpen });

        clear(container);

        expect(onOpen).toHaveBeenCalledWith(null);
    });

    it('tells the page nothing at Escape with no list open', () => {
        const onOpen = jest.fn();
        const { container } = draw({ open: null, onOpen: onOpen });

        fireEvent.keyDown(barOf(container, 'Energy'), { key: 'Escape' });

        expect(onOpen).not.toHaveBeenCalled();
    });

    it('tells the page of a day opened from +N more', () => {
        const onOpen = jest.fn();
        const { container } = draw({ rows: SPLITS, key: 'split_date', names: DAYS, open: null, onOpen: onOpen });

        fireEvent.mouseEnter(bandOf(container, 'Day 19')[0]);
        fireEvent.click(tip(container).querySelector('.cube-chart-tip-more'));

        expect(onOpen).toHaveBeenCalledWith('Day 19');
    });

    it('names Other\'s bar Other to the page, and opens Other\'s list by that name', () => {
        const onOpen = jest.fn();
        const view = draw({ rows: forms(25), key: 'form', names: FORMS, open: null, onOpen: onOpen });

        fireEvent.click(barOf(view.container, 'Other'));
        expect(onOpen).toHaveBeenCalledWith('Other');

        view.rerender(
            <CubeChart tree={view.tree} names={FORMS} caption='September 2026' height={392} open='Other' onOpen={onOpen} />
        );
        expect(list(view.container).querySelector('.cube-list-meta').textContent).toBe('2,100 filings · 6 forms');
    });

    it('opens Other\'s list for a group it rolled up, and clears it from Other\'s bar', () => {
        const onOpen = jest.fn();
        const { container } = draw({ rows: forms(25), key: 'form', names: FORMS, open: 'Form 25', onOpen: onOpen });

        expect(title(container)).toBe('Other');
        expect(barOf(container, 'Other')).toHaveAttribute('aria-expanded', 'true');

        fireEvent.click(barOf(container, 'Other'));

        expect(onOpen).toHaveBeenCalledWith(null);
    });

    it('keeps Other\'s own key where a group of the month is named Other, and the name opens that group', () => {
        const onOpen = jest.fn();
        const rows = [{ form: 'Other', Filings: 5000 }].concat(forms(25));
        const view = draw({ rows: rows, key: 'form', names: FORMS, open: null, onOpen: onOpen });
        const redraw = (open) => view.rerender(
            <CubeChart tree={view.tree} names={FORMS} caption='September 2026' height={392} open={open} onOpen={onOpen} />
        );
        const others = view.container.querySelectorAll('rect.cube-chart-bar[data-name="Other"]');

        expect(others).toHaveLength(2);

        fireEvent.click(others[1]);
        expect(onOpen).toHaveBeenCalledWith('\u0000other');

        redraw('\u0000other');
        expect(list(view.container).querySelector('.cube-list-meta').textContent).toBe('2,800 filings · 7 forms');

        redraw('Other');
        expect(list(view.container)).toBeNull();
    });

    it.each([
        ['a group the month does not hold', {}, 'Nope'],
        ['a bar with nothing under it', {}, 'Utilities'],
        ['a form neither drawn nor rolled into Other', { rows: forms(25), key: 'form', names: FORMS }, 'Form 99'],
    ])('opens nothing for %s', (name, options, open) => {
        const { container } = draw({ ...options, open: open });

        expect(list(container)).toBeNull();
        expect(lit(container)).toHaveLength(cubes(container).length);
    });

    it('keeps its own list where the page names none', () => {
        const onOpen = jest.fn();
        const { container } = draw({ onOpen: onOpen });

        fireEvent.click(barOf(container, 'Energy'));

        expect(title(container)).toBe('Energy');
        expect(onOpen).toHaveBeenCalledWith('Energy');
    });
});

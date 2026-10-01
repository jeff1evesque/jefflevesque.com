/**
 * cube-chart.test.jsx: a month's distribution as stacked bars built from cubes.
 *
 * What a reader can do with it, as they would: point at a cube or at a row of a
 * bar's list, open a bar's list with a click or from the keyboard, and clear it
 * again with a second click, the ×, or Escape. Where each cube sits is held by
 * cube-layout.test.js; the tree it draws, by distribution-tree.test.js.
 */

import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import CubeChart from '../../import/general/cube-chart.jsx';
import distributionTree from '../../import/general/distribution-tree.js';
import { colors_categorical } from '../../import/general/colors.js';

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

function forms(count) {
    return Array.from({ length: count }, (ignored, index) => ({ form: `Form ${index + 1}`, Filings: (count - index) * 100 }));
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
});

describe('the chart', () => {
    it('draws a bar per group, in label order, each a stack of cubes', () => {
        const { container } = draw();

        expect(texts(container, 'text.cube-chart-name')).toEqual(['Energy', 'Financials', 'Information Technology', 'Utilities']);
        expect(cubes(container).length).toBeGreaterThan(100);
        cubes(container).forEach((cube) => expect(cube.style.opacity).toBe('1'));
    });

    it('colors each cube by its member\'s rank within its bar', () => {
        const { container } = draw();

        expect(bandOf(container, 'Information Technology\u0000Semiconductors')[0]).toHaveAttribute('fill', colors_categorical[0]);
        expect(bandOf(container, TECH)[0]).toHaveAttribute('fill', colors_categorical[1]);
    });

    it('says what a cube is worth, and labels the axes as the old bars did', () => {
        const { container } = draw();

        expect(container.querySelector('.cube-chart-caption').textContent).toBe('Each cube ≈ 10,000 records');
        expect(texts(container, 'text.cube-chart-tick')).toEqual(['0e+0', '2e+6', '4e+6', '6e+6', '8e+6']);
        expect(texts(container, 'text.cube-chart-title')).toEqual(['Records', 'Sector']);
        container.querySelectorAll('text.cube-chart-name').forEach((name) => {
            expect(name.getAttribute('transform')).toMatch(/rotate\(-35\)$/);
        });
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

    it('names the band, its count and its share of the bar, and what a click does', () => {
        const { container } = draw();

        fireEvent.mouseEnter(bandOf(container, TECH)[0]);

        expect(tip(container).textContent)
            .toBe('Information TechnologyApplication Software2,437,12832% of Information TechnologyClick to list its industries');
        expect(tip(container).querySelector('.cube-chart-tip-swatch').style.background).toBe('rgb(235, 104, 52)');
    });

    it('sets the tooltip beside a bar on the left, and before one on the right', () => {
        const { container } = draw();

        fireEvent.mouseEnter(bandOf(container, 'Energy\u0000Refining')[0]);
        expect(tip(container).style.left).not.toBe('');

        fireEvent.mouseEnter(bandOf(container, TECH)[0]);
        expect(tip(container).style.right).not.toBe('');
    });

    it('lets go when the pointer leaves the cubes for the chart, or leaves the chart', () => {
        const { container } = draw();

        fireEvent.mouseEnter(bandOf(container, TECH)[0]);
        fireEvent.mouseEnter(container.querySelector('.cube-chart-backdrop'));
        expect(tip(container)).toBeNull();
        expect(lit(container)).toHaveLength(cubes(container).length);

        fireEvent.mouseEnter(bandOf(container, TECH)[0]);
        fireEvent.mouseLeave(container.querySelector('.cube-chart-plot'));
        expect(tip(container)).toBeNull();
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
        expect(tip(container).querySelector('.cube-chart-tip-hint').textContent).toBe('Click to list its tickers');
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
        expect(tip(container).querySelector('.cube-chart-tip-hint').textContent).toBe('Click to list its forms');
    });

    it('offers no click on a bar with nothing under it', () => {
        const { container } = draw();

        fireEvent.mouseEnter(bandOf(container, 'Utilities\u0000Electric Utilities')[0]);

        expect(tip(container).querySelector('.cube-chart-tip-hint')).toBeNull();
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
        const { container } = draw();

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

    it('says a second click clears it', () => {
        const { container } = draw();

        fireEvent.click(barOf(container, 'Information Technology'));
        fireEvent.mouseEnter(bandOf(container, TECH)[0]);

        expect(tip(container).querySelector('.cube-chart-tip-hint').textContent).toBe('Click again to clear the list');
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

        expect(list(container).querySelector('.cube-list-meta').textContent).toBe('8 splits · 8 tickers · 89% of all');
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

    it('runs down three columns at most', () => {
        const { container } = draw({ rows: forms(25), key: 'form', names: FORMS });

        fireEvent.click(barOf(container, 'Other'));

        expect(list(container).querySelector('.cube-list-rows').style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
        expect(list(container).querySelector('.cube-list-rows').style.gridTemplateRows).toBe('repeat(2, auto)');
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

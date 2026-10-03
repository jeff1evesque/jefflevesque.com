/**
 * cube-rows.test.jsx: a month's distribution on a phone, as rows of cubes
 * (#188).
 *
 * What a reader can do with it, as they would: read each group's row, tap one
 * open and go back from its ×, and show the rest of a long list and fewer
 * again. How a bar's cubes are cut is held by the pure helpers' cases; the tree
 * it draws, by distribution-tree.test.js.
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import CubeRows, { rowUnit, rowCut, shownOf, cubesOf } from '../../import/general/cube-rows.jsx';
import distributionTree from '../../import/general/distribution-tree.js';
import { colors_categorical, color_other } from '../../import/general/colors.js';

const SECTORS = { group: ['sector', 'sectors'], member: ['industry', 'industries'], unit: ['record', 'records'] };
const DAYS = { group: ['day', 'days'], member: ['ticker', 'tickers'], unit: ['split', 'splits'] };
const FORMS = { group: ['form', 'forms'], member: ['category', 'categories'], unit: ['filing', 'filings'] };
const SEVERITIES = { group: ['severity', 'severities'], member: ['event type', 'event types'], unit: ['event', 'events'] };

//
// twelve sectors, largest first: eleven of two industries each, and Consumer
// Discretionary, the second largest, of nineteen -- 950,000 records down to
// 50,000 in steps of 50,000. 50,900,000 records in all
//
const SECTOR_SIZES = [
    ['Information Technology', 12000000],
    ['Industrials', 7000000],
    ['Financials', 6000000],
    ['Health Care', 5000000],
    ['Communication Services', 3000000],
    ['Consumer Staples', 2500000],
    ['Materials', 1600000],
    ['Energy', 1500000],
    ['Utilities', 1200000],
    ['Real Estate', 1000000],
    ['Other', 600000],
];

const INDUSTRIES = 'ABCDEFGHIJKLMNOPQRS'.split('').map((letter, at) => [`Industry ${letter}`, (19 - at) * 50000]);

const sizeOf = (sector) => (sector === 'Consumer Discretionary'
    ? INDUSTRIES.reduce((sum, [ignored, size]) => sum + size, 0)
    : SECTOR_SIZES.find(([name]) => name === sector)[1]);

const ROWS = [
    ...SECTOR_SIZES.map(([sector, size]) => ({
        sector: sector,
        [`${sector} Main`]: size * 0.75,
        [`${sector} Rest`]: size * 0.25,
    })),
    { sector: 'Consumer Discretionary', ...Object.fromEntries(INDUSTRIES) },
];

//
// twelve days, in day order, one of 24 splits among days of one to four
//
const TICKERS = Array.from({ length: 24 }, (ignored, at) => `t${String(at + 1).padStart(2, '0')} 1:${at + 2}`).join(', ');

const SPLITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((day) => {
    if (day === 7) {
        return { split_date: 'Day 7', splits: 24, tickers: TICKERS };
    }
    const count = (day % 4) + 1;
    return {
        split_date: `Day ${day}`,
        splits: count,
        tickers: Array.from({ length: count }, (ignored, at) => `d${day}x${at} 2:1`).join(', '),
    };
});

//
// a month of stock splits once the api names each split's company (#190): Day 8
// of three sectors, Day 9 of one, and Day 10 of twelve tickers in three
//
const SECTORED = [
    { split_date: 'Day 8', sectors: {
        other: { splits: 3, tickers: 'ucar 1:10, aurwf 1:10, ucar 1:20' },
        'Office of Trade & Services': { splits: 2, tickers: 'phge 1:10, jmpld 3:4' },
        'Office of Life Sciences': { splits: 1, tickers: 'cycn 1:7' },
    } },
    { split_date: 'Day 9', sectors: { 'Office of Manufacturing': { splits: 2, tickers: 'qbtz 1:5, stsm 1:2' } } },
    { split_date: 'Day 10', sectors: {
        'Office of Technology': { splits: 7, tickers: 'a1 1:2, a2 1:2, a3 1:2, a4 1:2, a5 1:2, a6 1:2, a7 1:2' },
        'Office of Finance': { splits: 3, tickers: 'b1 1:3, b2 1:3, b3 1:3' },
        'Office of Manufacturing': { splits: 2, tickers: 'c1 1:4, c2 1:4' },
    } },
];

function forms(count) {
    return Array.from({ length: count }, (ignored, index) => ({ form: `Form ${index + 1}`, Filings: (count - index) * 100 }));
}

function draw({ rows = ROWS, key = 'sector', names = SECTORS, ...props } = {}) {
    const tree = distributionTree(rows, key);

    return { ...render(<CubeRows tree={tree} names={names} caption='September 2026' {...props} />), tree };
}

const names = (container) => [...container.querySelectorAll('.cube-rows-name')].map((name) => name.textContent);
const key = (container) => container.querySelector('.cube-rows-key');
const more = () => screen.queryByRole('button', { name: /^Show \d+ more/ });
const fewer = () => screen.queryByRole('button', { name: 'Show fewer' });
const row = (name) => screen.getByRole('button', { name: new RegExp(`^${name},`) });
const close = () => screen.queryByRole('button', { name: /^Back to all/ });
const bars = (container) => [...container.querySelectorAll('svg.cube-rows-bar')];
const cubesIn = (bar) => [...bar.querySelectorAll('rect')];

afterEach(() => {
    jest.restoreAllMocks();
    delete Element.prototype.scrollIntoView;
});

describe('rowUnit', () => {
    it('is the fewest round records a cube can stand for, with the largest row fitting its columns two deep', () => {
        expect(rowUnit(12000000, 36)).toBe(200000);
        expect(rowUnit(12000000, 19)).toBe(400000);
    });

    it('steps through the near-round numbers too, so the largest row fills most of the width', () => {
        expect(rowUnit(950000, 40)).toBe(15000);
        expect(rowUnit(5000, 40)).toBe(80);
    });

    it('answers for a count a column of cubes cannot hold', () => {
        expect(rowUnit(2e18, 1)).toBe(2e18);
    });
});

describe('rowCut', () => {
    it('counts a cube to a thing, one deep, where the largest row fits a line', () => {
        expect(rowCut(24, 36)).toEqual({ unit: 1, depth: 1 });
        expect(rowCut(36, 36)).toEqual({ unit: 1, depth: 1 });
    });

    it('cuts the cubes two deep, each worth round records, where it does not', () => {
        expect(rowCut(37, 36)).toEqual({ unit: 1, depth: 2 });
        expect(rowCut(12000000, 36)).toEqual({ unit: 200000, depth: 2 });
    });
});

describe('shownOf', () => {
    it('shows 8 of a long list', () => {
        expect(shownOf(12)).toBe(8);
        expect(shownOf(143)).toBe(8);
    });

    it('shows every row where no more than a couple would be left over', () => {
        expect(shownOf(10)).toBe(10);
        expect(shownOf(3)).toBe(3);
    });

    it('takes a limit of its own', () => {
        expect(shownOf(24, 9)).toBe(9);
        expect(shownOf(11, 9)).toBe(11);
    });
});

describe('cubesOf', () => {
    it('shares the cubes among the parts, and fills a column at a time from the left', () => {
        const cubes = cubesOf([{ value: 3, color: 'a' }, { value: 1, color: 'b' }], 4);

        expect(cubes.map((cube) => cube.color)).toEqual(['a', 'a', 'a', 'b']);
        expect(cubes.map((cube) => [cube.x, cube.y])).toEqual([[0, 0], [0, 9], [9, 0], [9, 9]]);
    });

    it('lays them along one line, one deep', () => {
        const cubes = cubesOf([{ value: 3, color: 'a' }], 3, 1);

        expect(cubes.map((cube) => [cube.x, cube.y])).toEqual([[0, 0], [9, 0], [18, 0]]);
    });
});

describe('the groups', () => {
    it('draws a row each, largest first, with its name, count and share', () => {
        const { container } = draw();
        const first = container.querySelector('.cube-rows-row');

        expect(names(container).slice(0, 3)).toEqual(['Information Technology', 'Consumer Discretionary', 'Industrials']);
        expect(first.querySelector('.cube-rows-count').textContent).toBe('12,000,000');
        expect(first.querySelector('.cube-rows-share').textContent).toBe('24%');
    });

    it('says what a cube is worth, as the wide screen\'s caption does', () => {
        const { container } = draw();

        expect(key(container).textContent).toBe('Each cube ≈ 200,000 records');
    });

    it('draws a bar of cubes under each, as long as its count, two deep', () => {
        const { container } = draw();
        const [first] = bars(container);

        expect(cubesIn(first)).toHaveLength(60);
        expect(first).toHaveAttribute('width', String((30 * 9) - 2));
        expect(first).toHaveAttribute('height', '16');
        expect(first).toHaveAttribute('aria-hidden', 'true');
    });

    it('colors a bar by its members\' rank, as its stack is on a wide screen', () => {
        const { container } = draw();
        const fills = cubesIn(bars(container)[0]).map((cube) => cube.getAttribute('fill'));

        expect(fills.slice(0, 45).every((fill) => fill === colors_categorical[0])).toBe(true);
        expect(fills.slice(45).every((fill) => fill === colors_categorical[1])).toBe(true);
    });

    it('makes a row that opens a button, read out with what it opens, and ends it in an arrow', () => {
        const { container } = draw();

        expect(row('Consumer Discretionary'))
            .toHaveAttribute('aria-label', 'Consumer Discretionary, 9,500,000 records, 19% of all. Opens its 19 industries');
        expect(row('Consumer Discretionary').querySelector('.cube-rows-arrow')).not.toBeNull();
        expect(container.querySelectorAll('button.cube-rows-row')).toHaveLength(8);
    });

    it('keeps the arrow\'s column for a row that opens nothing, among rows that open, so its figures line up', () => {
        const { container } = draw({ rows: [...ROWS.slice(0, 3), { sector: 'other', 'Only One': 100 }] });

        expect(container.querySelector('.cube-rows-list')).toHaveClass('has-arrows');
        expect(names(container)).toContain('other');
        expect(container.querySelector('div.cube-rows-row .cube-rows-name').textContent).toBe('other');
        expect(container.querySelector('div.cube-rows-row .cube-rows-arrow')).toBeNull();
    });

    it('draws no arrow\'s column where no row opens', () => {
        const { container } = draw({ rows: forms(3), key: 'form', names: FORMS });

        expect(container.querySelector('.cube-rows-list')).not.toHaveClass('has-arrows');
    });

    it('names the chart to a screen reader, with the month', () => {
        draw();

        expect(screen.getByRole('group', { name: 'Records by sector, September 2026' })).toHaveClass('cube-rows');
    });

    it('lays the bars out to the width it is given', () => {
        jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(200);
        const { container } = draw();

        expect(key(container).textContent).toBe('Each cube ≈ 400,000 records');
    });

    it('carries the api icons and the loader it is handed', () => {
        const { container } = draw({ actions: <a href='#docs'>API docs</a>, overlay: <div className='loading' /> });

        expect(within(container.querySelector('.cube-rows-actions')).getByText('API docs')).toBeInTheDocument();
        expect(container.querySelector('.cube-rows-overlay .loading')).not.toBeNull();
    });

    it('draws neither where it is handed neither', () => {
        const { container } = draw();

        expect(container.querySelector('.cube-rows-actions')).toBeNull();
        expect(container.querySelector('.cube-rows-overlay')).toBeNull();
    });

    it('draws nothing for an empty month', () => {
        const { container } = draw({ rows: [] });

        expect(names(container)).toEqual([]);
        expect(key(container)).toBeNull();
        expect(more()).toBeNull();
    });
});

describe('a long list', () => {
    it('shows its top 8, then a button for the rest', () => {
        const { container } = draw();

        expect(names(container)).toHaveLength(8);
        expect(more()).toHaveTextContent('Show 4 more sectors');
        expect(fewer()).toBeNull();
    });

    it('shows the rest from the button, and fewer again', () => {
        const { container } = draw();

        fireEvent.click(more());
        expect(names(container)).toHaveLength(12);
        expect(names(container)[11]).toBe('Other');
        expect(more()).toBeNull();

        fireEvent.click(fewer());
        expect(names(container)).toHaveLength(8);
    });

    it('shows every row of a list of 10', () => {
        const { container } = draw({ rows: ROWS.slice(0, 10) });

        expect(names(container)).toHaveLength(10);
        expect(more()).toBeNull();
    });

    it('cuts a list of 11 to 8, leaving 3 behind the button', () => {
        const { container } = draw({ rows: forms(11), key: 'form', names: FORMS });

        expect(names(container)).toHaveLength(8);
        expect(more()).toHaveTextContent('Show 3 more forms');
    });
});

describe('opening a group', () => {
    it('opens it on one tap, in place of the groups, under a head that names it', () => {
        const { container } = draw();

        fireEvent.click(row('Consumer Discretionary'));

        expect(container.querySelector('.cube-rows-title').textContent).toBe('Consumer Discretionary');
        expect(container.querySelector('.cube-rows-meta').textContent).toBe('9,500,000 records · 19 industries · 19% of all');
        expect(names(container).slice(0, 2)).toEqual(['Industry A', 'Industry B']);
    });

    it('lists its members with their share of it, each a bar in its own color', () => {
        const { container } = draw();

        fireEvent.click(row('Consumer Discretionary'));

        const first = container.querySelector('.cube-rows-row');
        expect(first.querySelector('.cube-rows-share').textContent).toBe('10%');
        expect(cubesIn(bars(container)[0]).every((cube) => cube.getAttribute('fill') === colors_categorical[0])).toBe(true);
        expect(cubesIn(bars(container)[1]).every((cube) => cube.getAttribute('fill') === colors_categorical[1])).toBe(true);
    });

    it('works out what a cube is worth again, for the members', () => {
        const { container } = draw();

        fireEvent.click(row('Consumer Discretionary'));

        expect(key(container).textContent).toBe('Each cube ≈ 15,000 records');
    });

    it('cuts the members short as well, and opens nothing further', () => {
        const { container } = draw();

        fireEvent.click(row('Consumer Discretionary'));

        expect(names(container)).toHaveLength(8);
        expect(more()).toHaveTextContent('Show 11 more industries');
        expect(container.querySelectorAll('button.cube-rows-row')).toHaveLength(0);
        expect(container.querySelector('.cube-rows-arrow')).toBeNull();
    });

    it('writes a sliver\'s share short, where under 1% does not fit', () => {
        const { container } = draw();

        fireEvent.click(row('Consumer Discretionary'));
        fireEvent.click(more());

        expect(names(container)).toHaveLength(19);
        expect([...container.querySelectorAll('.cube-rows-share')].pop().textContent).toBe('<1%');
    });

    it('goes back to every group from its ×, cut short as they were left', () => {
        const { container } = draw();

        fireEvent.click(row('Consumer Discretionary'));
        fireEvent.click(close());

        expect(container.querySelector('.cube-rows-head')).toBeNull();
        expect(names(container)).toHaveLength(8);
        expect(close()).toBeNull();
    });

    it('goes back to every group shown whole, as they were left, so a group opened past the first 8 is still there', () => {
        const { container } = draw();

        fireEvent.click(more());
        fireEvent.click(row('Other'));
        expect(names(container)).toEqual(['Other Main', 'Other Rest']);

        fireEvent.click(close());
        expect(names(container)).toHaveLength(12);
        expect(document.activeElement).toBe(row('Other'));
    });

    it('starts the members cut short, whatever the groups were', () => {
        const { container } = draw();

        fireEvent.click(more());
        fireEvent.click(row('Consumer Discretionary'));

        expect(names(container)).toHaveLength(8);
    });

    it('moves the keyboard nowhere when new rows have cut the closed group\'s row out', () => {
        const view = draw();
        const smaller = ROWS.map((given) => (given.sector === 'Consumer Discretionary' ? { sector: given.sector, Tiny: 1, Tinier: 1 } : given));

        fireEvent.click(row('Consumer Discretionary'));
        view.rerender(<CubeRows tree={distributionTree(smaller, 'sector')} names={SECTORS} caption='September 2026' />);
        fireEvent.click(close());

        expect(names(view.container)).not.toContain('Consumer Discretionary');
        expect(document.activeElement).toBe(document.body);
    });

    it('moves the keyboard to its ×, and back to the group\'s row once it closes', () => {
        draw();

        fireEvent.click(row('Consumer Discretionary'));
        expect(document.activeElement).toBe(close());

        fireEvent.click(close());
        expect(document.activeElement).toBe(row('Consumer Discretionary'));
    });

    it('lets go of a group the new rows do not hold', () => {
        const view = draw();

        fireEvent.click(row('Consumer Discretionary'));
        view.rerender(
            <CubeRows
                tree={distributionTree(ROWS.filter((given) => given.sector !== 'Consumer Discretionary'), 'sector')}
                names={SECTORS}
                caption='September 2026'
            />
        );

        expect(view.container.querySelector('.cube-rows-head')).toBeNull();
        expect(names(view.container)[0]).toBe('Information Technology');
    });
});

describe('where the rows sit on the screen', () => {
    it('brings their top into view when a group opens from far down the list', () => {
        const scrolled = jest.fn();
        Element.prototype.scrollIntoView = scrolled;
        jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: -400 });
        draw();

        fireEvent.click(row('Consumer Discretionary'));

        expect(scrolled).toHaveBeenCalledWith({ block: 'start' });
    });

    it('leaves them where they are when their top is in sight', () => {
        const scrolled = jest.fn();
        Element.prototype.scrollIntoView = scrolled;
        jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 120 });
        draw();

        fireEvent.click(row('Consumer Discretionary'));
        fireEvent.click(close());

        expect(scrolled).not.toHaveBeenCalled();
    });

    it('scrolls nothing where the browser cannot', () => {
        jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: -400 });
        const { container } = draw();

        fireEvent.click(row('Consumer Discretionary'));

        expect(container.querySelector('.cube-rows-title').textContent).toBe('Consumer Discretionary');
    });
});

describe('a day\'s splits', () => {
    const splits = () => draw({ rows: SPLITS, key: 'split_date', names: DAYS });

    it('lists every day, in date order, with no button: cut short, it would hide the latest', () => {
        const { container } = splits();

        expect(names(container)).toEqual(SPLITS.map((given) => given.split_date));
        expect(more()).toBeNull();
    });

    it('counts a cube a split, one deep, in one blue', () => {
        const { container } = splits();
        const busiest = bars(container)[6];

        expect(key(container).textContent).toBe('Each cube is 1 split');
        expect(cubesIn(busiest)).toHaveLength(24);
        expect(busiest).toHaveAttribute('height', '7');
        expect(cubesIn(busiest).every((cube) => cube.getAttribute('fill') === colors_categorical[0])).toBe(true);
    });

    it('opens a day to its tickers and their ratios, three to a line, nine of them, then the rest', () => {
        const { container } = splits();

        fireEvent.click(row('Day 7'));

        const tickers = [...container.querySelectorAll('.cube-rows-ticker')].map((ticker) => ticker.textContent);
        expect(tickers.slice(0, 2)).toEqual(['t011:2', 't021:3']);
        expect(tickers).toHaveLength(9);
        expect(more()).toHaveTextContent('Show 15 more tickers');
        expect(key(container)).toBeNull();

        fireEvent.click(more());
        expect(container.querySelectorAll('.cube-rows-ticker')).toHaveLength(24);
        expect(fewer()).not.toBeNull();
    });

    it('counts a day\'s splits once in its head, since they are its tickers', () => {
        const { container } = splits();

        fireEvent.click(row('Day 7'));

        expect(container.querySelector('.cube-rows-meta').textContent).toBe('24 splits · 48% of all');
    });

    it('reads a day out with the tickers it opens', () => {
        splits();

        expect(row('Day 7')).toHaveAttribute('aria-label', 'Day 7, 24 splits, 48% of all. Opens its 24 tickers');
    });
});

describe('a day banded by sector (#190)', () => {
    const heads = (container) => [...container.querySelectorAll('.cube-rows-sector-head')].map((head) => head.textContent);
    const tickers = (container) => [...container.querySelectorAll('.cube-rows-ticker')].map((ticker) => ticker.textContent);
    const legend = (container) => container.querySelector('.cube-rows-legend');

    it('bands each day\'s bar by its sectors, each in its color, and No sector last', () => {
        const { container } = draw({ rows: SECTORED, key: 'split_date', names: DAYS });

        expect(names(container)).toEqual(['Day 8', 'Day 9', 'Day 10']);
        expect(cubesIn(bars(container)[0]).map((cube) => cube.getAttribute('fill'))).toEqual([
            colors_categorical[3], colors_categorical[3], colors_categorical[0], color_other, color_other, color_other,
        ]);
    });

    it('names the month\'s sectors in a legend over the rows, under what a cube is worth', () => {
        const { container } = draw({ rows: SECTORED, key: 'split_date', names: DAYS });

        expect(legend(container)).toHaveAttribute('aria-label', 'Sectors');
        expect(key(container).parentElement.nextElementSibling).toBe(legend(container));
        expect([...legend(container).querySelectorAll('li')].map((item) => item.textContent))
            .toEqual(['Life Sciences', 'Technology', 'Manufacturing', 'Trade & Services', 'Finance', 'No sector']);
        expect(legend(container).querySelector('.cube-rows-swatch').style.background).toBe('rgb(42, 120, 214)');
    });

    it('draws no legend for a month the api sent without sectors', () => {
        const { container } = draw({ rows: SPLITS, key: 'split_date', names: DAYS });

        expect(legend(container)).toBeNull();
    });

    it('opens every day, a day of one sector as well, read out with the tickers it opens', () => {
        draw({ rows: SECTORED, key: 'split_date', names: DAYS });

        expect(row('Day 8')).toHaveAttribute('aria-label', 'Day 8, 6 splits, 30% of all. Opens its 6 tickers');
        expect(row('Day 9')).toHaveAttribute('aria-label', 'Day 9, 2 splits, 10% of all. Opens its 2 tickers');
    });

    it('opens a day to its tickers under their sectors\' heads, in the bar\'s order, and no legend', () => {
        const { container } = draw({ rows: SECTORED, key: 'split_date', names: DAYS });

        fireEvent.click(row('Day 8'));

        expect(container.querySelector('.cube-rows-meta').textContent).toBe('6 splits · 30% of all');
        expect(container.querySelector('.cube-rows-sectors')).toHaveAttribute('aria-label', 'Day 8: its tickers');
        expect(heads(container)).toEqual(['Trade & Services2', 'Life Sciences1', 'No sector3']);
        expect([...container.querySelectorAll('.cube-rows-sector .cube-rows-tickers')].map((list) => list.getAttribute('aria-label')))
            .toEqual(['Trade & Services', 'Life Sciences', 'No sector']);
        expect(tickers(container)).toEqual(['jmpld3:4', 'phge1:10', 'cycn1:7', 'aurwf1:10', 'ucar1:10', 'ucar1:20']);
        expect(container.querySelector('.cube-rows-sector-head .cube-rows-swatch').style.background).toBe('rgb(237, 161, 0)');
        expect(legend(container)).toBeNull();
        expect(more()).toBeNull();
    });

    it('opens a day of one sector to its tickers', () => {
        const { container } = draw({ rows: SECTORED, key: 'split_date', names: DAYS });

        fireEvent.click(row('Day 9'));

        expect(heads(container)).toEqual(['Manufacturing2']);
        expect(tickers(container)).toEqual(['qbtz1:5', 'stsm1:2']);
    });

    it('shows a day\'s first 9 tickers, with the heads they fall under, then the rest', () => {
        const { container } = draw({ rows: SECTORED, key: 'split_date', names: DAYS });

        fireEvent.click(row('Day 10'));

        expect(heads(container)).toEqual(['Technology7', 'Finance3']);
        expect(tickers(container)).toHaveLength(9);
        expect(tickers(container).slice(6)).toEqual(['a71:2', 'b11:3', 'b21:3']);
        expect(more()).toHaveTextContent('Show 3 more tickers');

        fireEvent.click(more());

        expect(heads(container)).toEqual(['Technology7', 'Finance3', 'Manufacturing2']);
        expect(tickers(container)).toHaveLength(12);
        expect(fewer()).not.toBeNull();
    });

    it('goes back from a day to every day, with the legend', () => {
        const { container } = draw({ rows: SECTORED, key: 'split_date', names: DAYS });

        fireEvent.click(row('Day 8'));
        fireEvent.click(close());

        expect(names(container)).toEqual(['Day 8', 'Day 9', 'Day 10']);
        expect(legend(container)).not.toBeNull();
    });
});

describe('the rows\' titles (#192)', () => {
    const titles = (container) => [...container.querySelectorAll('.cube-rows-titles .cube-rows-sort')];
    const titleTexts = (container) => titles(container).map((title) => title.textContent);
    const title = (name) => screen.getByRole('button', { name: new RegExp(`^(Sort by ${name}|${name}, sorted)`) });
    const arrow = (button) => ['UnfoldMoreIcon', 'ArrowUpwardIcon', 'ArrowDownwardIcon']
        .find((icon) => button.querySelector(`[data-testid="${icon}"]`));

    it('name each column for the stream: what a row is, what it counts, and its percent', () => {
        const { container } = draw();

        expect(titleTexts(container)).toEqual(['Sector', 'Records', 'Percent']);
        expect(container.querySelector('.cube-rows-titles').nextElementSibling).toHaveClass('cube-rows-list');
    });

    it('name a day\'s rows Day and Splits, and a form\'s Form and Filings', () => {
        const view = draw({ rows: SPLITS, key: 'split_date', names: DAYS });
        expect(titleTexts(view.container)).toEqual(['Day', 'Splits', 'Percent']);
        view.unmount();

        const { container } = draw({ rows: forms(3), key: 'form', names: FORMS });
        expect(titleTexts(container)).toEqual(['Form', 'Filings', 'Percent']);
    });

    it('name an open group\'s rows for what it holds', () => {
        const { container } = draw();

        fireEvent.click(row('Consumer Discretionary'));

        expect(titleTexts(container)).toEqual(['Industry', 'Records', 'Percent']);
    });

    it('take the arrow\'s column where a row opens, and none where none does', () => {
        const view = draw();
        expect(view.container.querySelector('.cube-rows-titles')).toHaveClass('has-arrows');
        view.unmount();

        const { container } = draw({ rows: forms(3), key: 'form', names: FORMS });
        expect(container.querySelector('.cube-rows-titles')).not.toHaveClass('has-arrows');
    });

    it('sort ascending at a tap, descending at a second, and back to the rows\' own order at a third', () => {
        const { container } = draw();
        const own = names(container);

        fireEvent.click(title('Records'));
        expect(names(container)).toEqual([...SECTOR_SIZES.map(([sector]) => sector), 'Consumer Discretionary']
            .sort((a, b) => sizeOf(a) - sizeOf(b))
            .slice(0, 8 + 4));
        expect(title('Records')).toHaveAttribute('aria-label', 'Records, sorted ascending');
        expect(arrow(title('Records'))).toBe('ArrowUpwardIcon');

        fireEvent.click(title('Records'));
        expect(names(container)).toEqual(own);
        expect(title('Records')).toHaveAttribute('aria-label', 'Records, sorted descending');
        expect(arrow(title('Records'))).toBe('ArrowDownwardIcon');

        fireEvent.click(title('Records'));
        expect(names(container)).toEqual(own);
        expect(title('Records')).toHaveAttribute('aria-label', 'Sort by Records');
        expect(arrow(title('Records'))).toBe('UnfoldMoreIcon');
    });

    it('mark only the title the rows are sorted by', () => {
        const { container } = draw();

        fireEvent.click(title('Sector'));

        expect(titles(container).map((button) => button.classList.contains('is-sorted'))).toEqual([true, false, false]);
        expect(arrow(title('Percent'))).toBe('UnfoldMoreIcon');
    });

    it('sort by percent as by the count, since it is the count\'s share', () => {
        const view = draw();
        fireEvent.click(title('Percent'));
        const by_percent = names(view.container);
        view.unmount();

        const { container } = draw();
        fireEvent.click(title('Records'));

        expect(by_percent).toEqual(names(container));
    });

    it('sort names with the numbers in them by value: Day 2 before Day 12', () => {
        const { container } = draw({ rows: SPLITS, key: 'split_date', names: DAYS });

        fireEvent.click(title('Day'));
        fireEvent.click(title('Day'));

        expect(names(container).slice(0, 4)).toEqual(['Day 12', 'Day 11', 'Day 10', 'Day 9']);
        fireEvent.click(title('Day'));
        fireEvent.click(title('Day'));
        expect(names(container).slice(0, 3)).toEqual(['Day 1', 'Day 2', 'Day 3']);
    });

    it('cut a list sorted largest first at 8, and show every row of one sorted another way', () => {
        const { container } = draw({ rows: forms(20), key: 'form', names: FORMS });

        expect(names(container)).toHaveLength(8);

        //
        // Form 20, the smallest, first: Z to A runs smallest first here
        //
        fireEvent.click(title('Form'));
        fireEvent.click(title('Form'));
        expect(names(container)).toHaveLength(20);
        expect(names(container)[0]).toBe('Form 20');
        expect(more()).toBeNull();

        fireEvent.click(title('Filings'));
        expect(names(container)).toHaveLength(20);

        fireEvent.click(title('Filings'));
        expect(names(container)).toHaveLength(8);
        expect(more()).toHaveTextContent('Show 12 more forms');
    });

    it('sort an open group\'s members by the title the groups are sorted by', () => {
        const { container } = draw();

        fireEvent.click(title('Sector'));
        fireEvent.click(row('Consumer Discretionary'));
        fireEvent.click(screen.getByRole('button', { name: 'Show 11 more industries' }));

        expect(title('Industry')).toHaveAttribute('aria-label', 'Industry, sorted ascending');
        expect(names(container).slice(0, 3)).toEqual(['Industry A', 'Industry B', 'Industry C']);

        fireEvent.click(title('Records'));
        expect(names(container).slice(0, 3)).toEqual(['Industry S', 'Industry R', 'Industry Q']);
    });

    it('put no titles over an open day\'s tickers', () => {
        const { container } = draw({ rows: SPLITS, key: 'split_date', names: DAYS });

        fireEvent.click(row('Day 7'));

        expect(container.querySelector('.cube-rows-titles')).toBeNull();
    });

    it('start in the order the page hands in, and tell it each new one', () => {
        const onSort = jest.fn();
        const { container } = draw({ sort: { key: 'name', direction: 'descending' }, onSort: onSort });

        expect(names(container)[0]).toBe('Utilities');

        fireEvent.click(title('Sector'));
        expect(onSort).toHaveBeenLastCalledWith(null);

        fireEvent.click(title('Records'));
        expect(onSort).toHaveBeenLastCalledWith({ key: 'count', direction: 'ascending' });
    });
});

describe('the sectors\' legend fold on a phone (#192)', () => {
    const fold = () => screen.getByRole('button', { name: 'Sectors' });
    const legend = (container) => container.querySelector('.cube-rows-legend');

    it('sits beside what a cube is worth, open at first', () => {
        const { container } = draw({ rows: SECTORED, key: 'split_date', names: DAYS });

        expect(fold().parentElement).toHaveClass('cube-rows-key-row');
        expect(fold()).toHaveAttribute('aria-expanded', 'true');
        expect(legend(container)).not.toBeNull();
    });

    it('folds the legend away at a tap, and shows it again at another, telling the page each time', () => {
        const onSectors = jest.fn();
        const { container } = draw({ rows: SECTORED, key: 'split_date', names: DAYS, onSectors: onSectors });

        fireEvent.click(fold());
        expect(legend(container)).toBeNull();
        expect(fold()).toHaveAttribute('aria-expanded', 'false');
        expect(onSectors).toHaveBeenLastCalledWith(false);

        fireEvent.click(fold());
        expect(legend(container)).not.toBeNull();
        expect(onSectors).toHaveBeenLastCalledWith(true);
    });

    it('starts folded where the page kept it folded', () => {
        const { container } = draw({ rows: SECTORED, key: 'split_date', names: DAYS, sectorsShown: false });

        expect(legend(container)).toBeNull();
        expect(fold()).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(fold());
        expect(legend(container)).not.toBeNull();
    });

    it('is not there for a month without sectors', () => {
        draw({ rows: SPLITS, key: 'split_date', names: DAYS });

        expect(screen.queryByRole('button', { name: 'Sectors' })).toBeNull();
    });
});

describe('a single series', () => {
    it('draws its groups in one blue, cut short, and opens none of them', () => {
        const { container } = draw({ rows: forms(30), key: 'form', names: FORMS });

        expect(names(container)).toHaveLength(8);
        expect(more()).toHaveTextContent('Show 22 more forms');
        expect(container.querySelectorAll('button.cube-rows-row')).toHaveLength(0);
        expect(container.querySelector('.cube-rows-arrow')).toBeNull();
        bars(container).forEach((bar) => cubesIn(bar).forEach((cube) => expect(cube).toHaveAttribute('fill', colors_categorical[0])));
    });
});

describe('a severity scale', () => {
    it('keeps every severity, worst first, whatever the counts', () => {
        const { container } = draw({
            rows: [
                { severity: 'Minor', 'Flood Advisory': 90, 'Wind Advisory': 10 },
                { severity: 'Extreme', 'Tornado Warning': 1, 'Fire Warning': 1 },
                { severity: 'Severe', 'Flood Warning': 30, 'Storm Warning': 5 },
            ],
            key: 'severity',
            names: SEVERITIES,
        });

        expect(names(container)).toEqual(['Extreme', 'Severe', 'Minor']);
        expect(row('Extreme')).toHaveAttribute('aria-label', 'Extreme, 2 events, 1.5% of all. Opens its 2 event types');
    });
});

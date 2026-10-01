/**
 * sunburst.test.jsx: a month's distribution as a ring, with a list beside it.
 *
 * What a reader can do with it, as they would: point at a segment or a row, open
 * a group from either, close it from the middle or the breadcrumb, sort the
 * list, and on a phone tap once to describe and again to open. The tree it draws
 * is built by distribution-tree.js, whose own suite holds its rules.
 *
 * Note: opening a group glides on animation frames. Most tests ask for less
 *       motion, so the ring settles at once; the ones about the glide run it on
 *       jest's clock.
 */

import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import Sunburst, { share, labelWidth, labelPlace } from '../../import/general/sunburst.jsx';
import distributionTree from '../../import/general/distribution-tree.js';
import { ThemeModeContext } from '../../import/general/theme-mode.jsx';
import { colors, colors_dark, colors_categorical, mix } from '../../import/general/colors.js';

const SECTORS = { group: ['sector', 'sectors'], member: ['industry', 'industries'], unit: ['record', 'records'] };

const ROWS = [
    { sector: 'Information Technology', 'Semiconductor Materials and Equipment': 600, Software: 300, Hardware: 100 },
    { sector: 'Energy', 'Integrated Oil & Gas': 500, Refining: 300 },
    { sector: 'Utilities', 'Electric Utilities': 700 },
    { sector: 'Financials', Banks: 400, Insurance: 200 },
];

function still() {
    window.matchMedia = jest.fn(() => ({ matches: true }));
}

afterEach(() => {
    delete window.matchMedia;
    jest.useRealTimers();
});

function draw({ rows = ROWS, key = 'sector', names = SECTORS, theme = 'light', ...props } = {}) {
    const tree = distributionTree(rows, key, theme);
    const element = (given) => (
        <ThemeModeContext.Provider value={{ theme: theme, toggle: () => {} }}>
            <Sunburst tree={given} names={names} caption='September 2026' {...props} />
        </ThemeModeContext.Provider>
    );
    const view = render(element(tree));

    return { ...view, tree, redraw: (next) => view.rerender(element(next)) };
}

const arcs = (container) => [...container.querySelectorAll('path.sunburst-arc')];
const arcOf = (container, name) => arcs(container).find((path) => path.getAttribute('data-name') === name);
const labels = (container) => [...container.querySelectorAll('text.sunburst-label')].map((text) => text.textContent);
const middle = (container) => container.querySelector('.sunburst-center').textContent;
const meta = (container) => container.querySelector('.sunburst-meta').textContent;
const rowNames = (container) => [...container.querySelectorAll('.sunburst-row .sunburst-name')].map((name) => name.textContent);
const row = (name) => screen.getByRole('button', { name: new RegExp(`^${name.replace(/[&]/g, '\\$&')},`) });

describe('the whole month', () => {
    beforeEach(still);

    it('draws a segment for every group and every member', () => {
        const { container } = draw();

        expect(arcs(container)).toHaveLength(12);
        arcs(container).forEach((path) => expect(path.getAttribute('d')).toMatch(/^M/));
    });

    it('names the month in the middle', () => {
        const { container } = draw();

        expect(middle(container)).toBe('All sectors3,100records');
    });

    it('says what the ring holds, and how to open it, above it', () => {
        const { container } = draw();

        expect(meta(container)).toBe('September 2026 · 3,100 records · 4 sectors · click a sector to zoom in');
        expect(within(container.querySelector('.sunburst-crumb')).getByText('All sectors'))
            .toHaveAttribute('aria-current', 'page');
    });

    it('describes the ring to a screen reader', () => {
        draw();

        expect(screen.getByRole('img', { name: 'Records by sector and industry, September 2026' })).toBeInTheDocument();
    });

    it('lists every group with its count and share, in the ring\'s order', () => {
        const { container } = draw();

        expect(rowNames(container)).toEqual(['Information Technology', 'Energy', 'Utilities', 'Financials']);
        expect(row('Information Technology')).toHaveAccessibleName(
            'Information Technology, 1,000 records, 32% of all. Zooms into Information Technology'
        );
        expect(within(row('Energy')).getByText('26%')).toBeInTheDocument();
    });

    it('colors the groups, and the outer ring a shade toward the page', () => {
        const { container } = draw();

        expect(arcOf(container, 'Information Technology')).toHaveAttribute('fill', colors_categorical[0]);
        expect(arcOf(container, 'Refining')).toHaveAttribute('fill', mix(colors_categorical[1], colors['white-1'], 0.4));
    });

    it('names a segment on it where the name fits, and leaves the rest to the list', () => {
        const { container } = draw();
        const shown = labels(container);

        expect(shown).toEqual(expect.arrayContaining(['Information Technology', 'Energy', 'Software']));
        expect(shown).not.toContain('Semiconductor Materials and Equipment');
        expect(shown).not.toContain('Hardware');
    });

    it('sizes the ring and the list to the size it is given', () => {
        const { container } = draw({ size: 300 });

        expect(container.querySelector('.sunburst-ring')).toHaveStyle({ width: '300px', height: '300px' });
        expect(container.querySelector('.sunburst-list')).toHaveStyle({ maxHeight: '300px' });
    });

    it('leaves the sizing to the stylesheet when given none', () => {
        const { container } = draw();

        expect(container.querySelector('.sunburst-ring').getAttribute('style')).toBeNull();
        expect(container.querySelector('.sunburst-list').getAttribute('style')).toBeNull();
    });

    it('puts the page\'s actions above the ring and its overlay over it', () => {
        const { container } = draw({
            actions: <a href='/docs'>API docs</a>,
            overlay: <div className='loading'>loading</div>,
        });

        expect(within(container.querySelector('.sunburst-actions')).getByRole('link', { name: 'API docs' }))
            .toBeInTheDocument();
        expect(container.querySelector('.sunburst-ring .loading')).not.toBeNull();
    });
});

describe('pointing', () => {
    beforeEach(still);

    it('darkens a row\'s segment, fades the rest, and names it in the middle', () => {
        const { container } = draw();

        fireEvent.mouseEnter(row('Information Technology'));

        expect(arcOf(container, 'Information Technology')).toHaveAttribute('fill', mix(colors_categorical[0], '#000', 0.25));
        expect(arcOf(container, 'Energy')).toHaveStyle({ opacity: '0.2' });
        expect(arcOf(container, 'Software')).toHaveStyle({ opacity: '1' });
        expect(middle(container)).toBe('Information Technology1,000records · 32% of allClick to zoom in');
        expect(row('Information Technology')).toHaveClass('is-lit');
    });

    it('lets go when the pointer leaves', () => {
        const { container } = draw();

        fireEvent.mouseEnter(row('Energy'));
        fireEvent.mouseLeave(row('Energy'));

        expect(arcOf(container, 'Energy')).toHaveAttribute('fill', colors_categorical[1]);
        expect(arcOf(container, 'Utilities')).toHaveStyle({ opacity: '1' });
        expect(middle(container)).toBe('All sectors3,100records');
    });

    it('does the same for a row reached from the keyboard', () => {
        const { container } = draw();

        fireEvent.focus(row('Utilities'));
        expect(middle(container)).toContain('Utilities700');

        fireEvent.blur(row('Utilities'));
        expect(middle(container)).toBe('All sectors3,100records');
    });

    it('names a segment pointed at on the ring, with its share of its group', () => {
        const { container } = draw();

        fireEvent.mouseEnter(arcOf(container, 'Software'));
        expect(middle(container)).toBe('Software300records · 30% of Information TechnologyClick to zoom in');

        fireEvent.mouseLeave(arcOf(container, 'Software'));
        expect(middle(container)).toBe('All sectors3,100records');
    });

    it('brightens the segment instead on a dark page', () => {
        const { container } = draw({ theme: 'dark' });

        fireEvent.mouseEnter(row('Information Technology'));

        expect(arcOf(container, 'Information Technology')).toHaveAttribute('fill', mix(colors_categorical[0], '#fff', 0.25));
        expect(arcOf(container, 'Refining')).toHaveAttribute('fill', mix(colors_categorical[1], colors_dark['white-1'], 0.4));
    });
});

describe('opening a group', () => {
    beforeEach(still);

    it('opens it from its row, all the way round', () => {
        const { container } = draw();

        fireEvent.click(row('Information Technology'));

        expect(arcs(container).map((path) => path.getAttribute('data-name'))).toEqual([
            'Information Technology',
            'Semiconductor Materials and Equipment',
            'Software',
            'Hardware',
        ]);
        expect(rowNames(container)).toEqual(['Semiconductor Materials and Equipment', 'Software', 'Hardware']);
        expect(meta(container)).toBe('September 2026 · 1,000 records · 3 industries');
        expect(middle(container)).toBe('Information Technology1,000recordsBack to all sectors');
    });

    it('gives its members colors of their own, on the ring and in the list', () => {
        const { container } = draw();

        fireEvent.click(row('Information Technology'));

        expect(arcOf(container, 'Software')).toHaveAttribute('fill', colors_categorical[1]);
        expect([...container.querySelectorAll('.sunburst-row .sunburst-swatch')].map((swatch) => swatch.style.background))
            .toEqual(colors_categorical.slice(0, 3).map((hex) => {
                const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
                return `rgb(${r}, ${g}, ${b})`;
            }));
    });

    it('names the members on the ring where they fit, the long one included', () => {
        const { container } = draw();

        fireEvent.click(row('Information Technology'));

        expect(labels(container)).toEqual(expect.arrayContaining(['Semiconductor Materials and Equipment', 'Hardware']));
        expect(labels(container)).not.toContain('Information Technology');
    });

    it('lists its members with their share of it', () => {
        draw();

        fireEvent.click(row('Information Technology'));

        expect(row('Software')).toHaveAccessibleName('Software, 300 records, 30% of Information Technology');
    });

    it('does nothing from a member\'s row', () => {
        const { container } = draw();

        fireEvent.click(row('Information Technology'));
        fireEvent.click(row('Software'));

        expect(meta(container)).toBe('September 2026 · 1,000 records · 3 industries');
    });

    it('says how to close it while a member is pointed at', () => {
        const { container } = draw();

        fireEvent.click(row('Information Technology'));
        fireEvent.mouseEnter(row('Hardware'));

        expect(middle(container)).toBe('Hardware100records · 10% of Information TechnologyClick to zoom out');
    });

    it('closes from the middle', () => {
        const { container } = draw();

        fireEvent.click(row('Energy'));
        fireEvent.click(screen.getByRole('button', { name: 'Back to all sectors' }));

        expect(rowNames(container)).toHaveLength(4);
        expect(arcs(container)).toHaveLength(12);
    });

    it('closes from the root of the breadcrumb', () => {
        const { container } = draw();

        fireEvent.click(row('Energy'));
        expect(within(container.querySelector('.sunburst-crumb')).getByText('Energy'))
            .toHaveAttribute('aria-current', 'page');

        fireEvent.click(within(container.querySelector('.sunburst-crumb')).getByRole('button', { name: 'All sectors' }));

        expect(meta(container)).toContain('4 sectors');
    });

    it('opens a member\'s group from the ring, and closes from any segment', () => {
        const { container } = draw();

        fireEvent.click(arcOf(container, 'Refining'));
        expect(meta(container)).toBe('September 2026 · 800 records · 2 industries');

        fireEvent.click(arcOf(container, 'Refining'));
        expect(meta(container)).toContain('4 sectors');

        fireEvent.click(arcOf(container, 'Utilities'));
        expect(meta(container)).toBe('September 2026 · 700 records · 1 industry');
    });

    it('draws the whole month when the open group is no longer there', () => {
        const { container, redraw } = draw();

        fireEvent.click(row('Information Technology'));
        redraw(distributionTree(ROWS.slice(1), 'sector'));

        expect(meta(container)).toBe('September 2026 · 2,100 records · 3 sectors · click a sector to zoom in');
    });
});

describe('the glide', () => {
    it('moves over about half a second, naming nothing on the way', () => {
        jest.useFakeTimers();
        const { container } = draw();

        fireEvent.click(row('Information Technology'));
        expect(labels(container)).toEqual([]);

        act(() => {
            jest.advanceTimersByTime(300);
        });
        expect(labels(container)).toEqual([]);

        act(() => {
            jest.advanceTimersByTime(700);
        });
        expect(labels(container)).toContain('Software');
    });

    it('turns back mid-glide from where it is', () => {
        jest.useFakeTimers();
        const { container } = draw();

        fireEvent.click(row('Information Technology'));
        act(() => {
            jest.advanceTimersByTime(200);
        });
        fireEvent.click(screen.getByRole('button', { name: 'Back to all sectors' }));
        act(() => {
            jest.advanceTimersByTime(1000);
        });

        expect(arcs(container)).toHaveLength(12);
        expect(labels(container)).toContain('Energy');
    });

    it('stops its frames when the ring goes away mid-glide', () => {
        jest.useFakeTimers();
        const cancel = jest.spyOn(window, 'cancelAnimationFrame');
        const { unmount } = draw();

        fireEvent.click(row('Energy'));
        unmount();

        expect(cancel).toHaveBeenCalled();
        cancel.mockRestore();
    });

    it('settles at once where a browser cannot animate', () => {
        const held = window.requestAnimationFrame;
        delete window.requestAnimationFrame;
        const { container } = draw();

        fireEvent.click(row('Information Technology'));

        expect(labels(container)).toContain('Software');
        window.requestAnimationFrame = held;
    });

    it('settles at once for a reader who asked for less motion', () => {
        still();
        const { container } = draw();

        fireEvent.click(row('Information Technology'));

        expect(labels(container)).toContain('Software');
    });
});

describe('sorting the list', () => {
    beforeEach(still);

    const sorter = (name) => screen.getByRole('button', { name: new RegExp(`^(Sort by )?${name}`) });

    it('sorts by a column, then the other way, then back to the ring\'s order', () => {
        const { container } = draw();

        fireEvent.click(sorter('Sector'));
        expect(rowNames(container)).toEqual(['Energy', 'Financials', 'Information Technology', 'Utilities']);
        expect(sorter('Sector')).toHaveAccessibleName('Sector, sorted ascending');

        fireEvent.click(sorter('Sector'));
        expect(rowNames(container)).toEqual(['Utilities', 'Information Technology', 'Financials', 'Energy']);
        expect(sorter('Sector')).toHaveAccessibleName('Sector, sorted descending');

        fireEvent.click(sorter('Sector'));
        expect(rowNames(container)).toEqual(['Information Technology', 'Energy', 'Utilities', 'Financials']);
        expect(sorter('Sector')).toHaveAccessibleName('Sort by Sector');
    });

    it('sorts by the count, and by the share the same way', () => {
        const { container } = draw();

        fireEvent.click(sorter('Records'));
        expect(rowNames(container)).toEqual(['Financials', 'Utilities', 'Energy', 'Information Technology']);

        fireEvent.click(sorter('Share'));
        expect(rowNames(container)).toEqual(['Financials', 'Utilities', 'Energy', 'Information Technology']);
        expect(sorter('Records')).toHaveAccessibleName('Sort by Records');
    });

    it('keeps the sort when a group is opened', () => {
        const { container } = draw();

        fireEvent.click(sorter('Records'));
        fireEvent.click(row('Information Technology'));

        expect(rowNames(container)).toEqual(['Hardware', 'Software', 'Semiconductor Materials and Equipment']);
        expect(sorter('Industry')).toBeInTheDocument();
    });
});

describe('on a phone', () => {
    beforeEach(still);

    it('describes a segment on the first tap, and opens its group on the second', () => {
        const { container } = draw({ phone: true });

        fireEvent.click(arcOf(container, 'Software'));
        expect(middle(container)).toContain('Tap again to zoom in');
        expect(meta(container)).toContain('4 sectors · tap a sector twice to zoom in');

        fireEvent.click(arcOf(container, 'Software'));
        expect(meta(container)).toBe('September 2026 · 1,000 records · 3 industries');
    });

    it('takes no pointer on the ring, since a tap stands in for it', () => {
        const { container } = draw({ phone: true });

        fireEvent.mouseEnter(arcOf(container, 'Energy'));

        expect(middle(container)).toBe('All sectors3,100records');
    });

    it('opens a group from its row on the first tap', () => {
        const { container } = draw({ phone: true });

        fireEvent.click(row('Energy'));

        expect(meta(container)).toBe('September 2026 · 800 records · 2 industries');
    });

    it('lays out as a phone', () => {
        const { container } = draw({ phone: true });

        expect(container.querySelector('.sunburst')).toHaveClass('sunburst-phone');
    });
});

describe('a single series', () => {
    beforeEach(still);

    const FORMS = { group: ['form', 'forms'], member: ['category', 'categories'], unit: ['filing', 'filings'] };
    const flat = () => draw({
        rows: [{ form: 'Form 4', Filings: 30 }, { form: 'Form 8-K', Filings: 10 }],
        key: 'form',
        names: FORMS,
    });

    it('draws a single ring, in the chart colors (#167)', () => {
        const { container } = flat();

        expect(arcs(container).map((path) => path.getAttribute('fill'))).toEqual([colors_categorical[0], colors_categorical[1]]);
        expect(screen.getByRole('img', { name: 'Filings by form, September 2026' })).toBeInTheDocument();
    });

    it('opens nothing, and offers nothing to open', () => {
        const { container } = flat();

        fireEvent.click(row('Form 4'));
        fireEvent.click(arcOf(container, 'Form 8-K'));

        expect(meta(container)).toBe('September 2026 · 40 filings · 2 forms');
        expect(row('Form 4')).not.toHaveClass('is-zoomable');
    });

    it('names a form in the middle without a hint', () => {
        const { container } = flat();

        fireEvent.mouseEnter(row('Form 4'));

        expect(middle(container)).toBe('Form 430filings · 75% of all');
    });
});

describe('a day\'s tickers', () => {
    beforeEach(still);

    const DAYS = { group: ['day', 'days'], member: ['ticker', 'tickers'], unit: ['split', 'splits'] };

    it('lists each ticker against its ratio, and names its day in the middle', () => {
        const { container } = draw({
            rows: [
                { sector: 'Day 1', splits: 2, tickers: 'crwd 4:1, svc 1:5' },
                { sector: 'Day 5', splits: 1, tickers: 'cris 1:20' },
            ],
            names: DAYS,
        });

        fireEvent.click(row('Day 1'));

        expect(within(row('crwd')).getByText('4:1')).toBeInTheDocument();
        expect(row('crwd')).toHaveAccessibleName('crwd, 4:1, 50% of Day 1');

        fireEvent.mouseEnter(row('crwd'));
        expect(middle(container)).toBe('crwd4:1Day 1 · 2 splitsClick to zoom out');
    });
});

describe('an empty month', () => {
    beforeEach(still);

    it('draws no ring, counts nothing, and offers nothing to open', () => {
        const { container } = draw({ rows: [] });

        expect(arcs(container)).toEqual([]);
        expect(middle(container)).toBe('All sectors0records');
        expect(meta(container)).toBe('September 2026 · 0 records · 0 sectors');
    });
});

describe('share', () => {
    it.each([
        [32, 100, '32%'],
        [1.5, 100, '1.5%'],
        [2, 100, '2%'],
        [0.5, 100, 'under 1%'],
        [5, 0, 'under 1%'],
    ])('writes %s of %s as %s', (part, whole, written) => {
        expect(share(part, whole)).toBe(written);
    });
});

describe('labelWidth', () => {
    it('reads a wide letter wider than a narrow one, and a capital wider than a small one', () => {
        expect(labelWidth('W')).toBeGreaterThan(labelWidth('a'));
        expect(labelWidth('a')).toBeGreaterThan(labelWidth('i'));
        expect(labelWidth('A')).toBeGreaterThan(labelWidth('a'));
        expect(labelWidth('i')).toBeGreaterThan(labelWidth(' '));
    });

    it('scales with the size', () => {
        expect(labelWidth('Energy', 24)).toBeCloseTo(labelWidth('Energy', 12) * 2);
    });
});

describe('labelPlace', () => {
    it('places a name that fits along its segment', () => {
        const place = labelPlace(40, 95, 155, 0, 1);

        expect(place.rotate).toBeCloseTo((0.5 * 180) / Math.PI);
        expect(place.y).toBeLessThan(0);
    });

    it('turns a name on the lower half over, so it reads upright', () => {
        expect(labelPlace(40, 95, 155, 2.9, 3.4).rotate).toBeCloseTo(((3.15 * 180) / Math.PI) + 180);
    });

    it('declines a ring too thin for it', () => {
        expect(labelPlace(40, 95, 103, 0, 3)).toBeNull();
    });

    it('declines a segment too narrow for it', () => {
        expect(labelPlace(120, 95, 155, 0, 0.4)).toBeNull();
    });
});

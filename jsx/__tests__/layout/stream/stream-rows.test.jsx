/**
 * stream-rows.test.jsx: every stream as a row of bars, with its figures beside it.
 *
 * stream-bars.test.js decides what each bar is. This covers how a row draws the
 * bars it is handed -- their heights on the row's own scale, their shades, what a
 * bar says when it is pointed at -- and how the figures sort the rows.
 *
 * Note: jsdom has no PointerEvent, so a pointer event is a MouseEvent with its
 *       'pointerType' laid on -- which is what React reads -- and an enter or a
 *       leave is the 'pointerover' or 'pointerout' React makes them from.
 */

import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';

import StreamRows, {
    FIGURES_FOLD,
    FIGURES_MIN,
    SHADES,
    SORT_KEYS,
    SortMenu,
    heightShade,
    nextSort,
} from '../../../import/layout/stream/stream-rows.jsx';

const at = (d) => new Date(2026, 8, d);

//
// a row, with only what a case needs said
//
function stream(name, overrides = {}) {
    return {
        stream: name.toLowerCase().replace(/\s+/g, '-'),
        name: name,
        schedule: 'weekdays, once a day',
        status: 'done',
        retry: () => {},
        bars: [],
        figures: { health: 'n/a', coverage: 'n/a', total: 'n/a' },
        controls: <button type='button'>{`Alarms for ${name}`}</button>,
        ...overrides,
    };
}

const BARS = [
    { start: at(26), kind: 'off' },
    { start: at(28), kind: 'reported', records: 200, failed: 0, health: 1 },
    { start: at(29), kind: 'reported', records: 50, failed: 50, health: 0.5 },
    { start: at(30), kind: 'missed' },
];

function setup(rows, props = {}) {
    return render(<StreamRows rows={rows} rate='day' first='Sep 11' last='Now' {...props} />);
}

function rowOf(name) {
    return [...document.querySelectorAll('.stream-row')]
        .find((row) => row.querySelector('.stream-row-title').firstChild.textContent === name);
}

function names() {
    return [...document.querySelectorAll('.stream-row .stream-row-title')]
        .map((title) => title.firstChild.textContent);
}

function readout() {
    return document.querySelector('.stream-rows-readout').textContent;
}

describe('a row', () => {
    it('names its stream and its schedule, and carries its controls', () => {
        setup([stream('SEC Filings')]);

        const row = rowOf('SEC Filings');

        expect(row.querySelector('.stream-row-schedule')).toHaveTextContent('weekdays, once a day');
        expect(within(row).getByRole('button', { name: 'Alarms for SEC Filings' })).toBeInTheDocument();
    });

    it('ends with its three figures', () => {
        setup([stream('SEC Filings', { figures: { health: '99%', coverage: '95%', total: '1,234' } })]);

        const row = rowOf('SEC Filings');

        expect([...row.querySelectorAll('.stream-row-figure')].map((cell) => cell.textContent))
            .toEqual(['99%', '95%', '1,234']);
    });

    it('names its stream as plain text when it has nowhere to link', () => {
        setup([stream('SEC Filings')]);

        expect(rowOf('SEC Filings').querySelector('.stream-row-link')).toBeNull();
    });
});

describe('a stream\'s name (#161)', () => {
    function link(name = 'SEC Filings') {
        return within(rowOf(name)).getByRole('link', { name: name });
    }

    //
    // a click on the name, and whether the page kept it for itself rather than
    // leaving it to the browser. Kept from the browser here either way, since
    // jsdom cannot follow a link and says so as an error
    //
    function handled(element, init = {}) {
        let prevented = null;
        const look = (event) => {
            prevented = event.defaultPrevented;
            event.preventDefault();
        };

        window.addEventListener('click', look);
        fireEvent.click(element, init);
        window.removeEventListener('click', look);

        return prevented;
    }

    it('links to the address that shows it on its own', () => {
        setup([stream('SEC Filings', { href: '/stream?item=sec&rate=day' })]);

        expect(link()).toHaveAttribute('href', '/stream?item=sec&rate=day');
    });

    it('ends in an arrow that says it opens, which a screen reader skips, so the link keeps its name (#169)', () => {
        setup([stream('SEC Filings', { href: '/stream?item=sec&rate=day' })]);

        expect(link().querySelector('.stream-row-open')).toHaveAttribute('aria-hidden', 'true');
    });

    it('draws no arrow after a name with nowhere to link', () => {
        setup([stream('SEC Filings')]);

        expect(rowOf('SEC Filings').querySelector('.stream-row-open')).toBeNull();
    });

    it('shows the stream on its own on a plain click, without loading the page again', () => {
        const onFocus = jest.fn();

        setup([stream('SEC Filings', { href: '/stream?item=sec&rate=day' })], { onFocus: onFocus });

        expect(handled(link())).toBe(true);
        expect(onFocus).toHaveBeenCalledWith('sec-filings');
    });

    it.each([
        ['metaKey'],
        ['ctrlKey'],
        ['shiftKey'],
        ['altKey'],
    ])('leaves a click with %s to the browser, for a new tab or window', (key) => {
        const onFocus = jest.fn();

        setup([stream('SEC Filings', { href: '/stream?item=sec&rate=day' })], { onFocus: onFocus });

        expect(handled(link(), { [key]: true })).toBe(false);
        expect(onFocus).not.toHaveBeenCalled();
    });

    it('leaves a middle click to the browser', () => {
        const onFocus = jest.fn();

        setup([stream('SEC Filings', { href: '/stream?item=sec&rate=day' })], { onFocus: onFocus });

        expect(handled(link(), { button: 1 })).toBe(false);
        expect(onFocus).not.toHaveBeenCalled();
    });

    it('is a link the browser follows when the page has no way to show a stream on its own', () => {
        setup([stream('SEC Filings', { href: '/stream?item=sec&rate=day' })]);

        expect(handled(link())).toBe(false);
    });
});

describe('a row whose report is not in', () => {
    function status(name) {
        const line = rowOf(name).querySelector('.stream-row-status');

        return line ? line.textContent : null;
    }

    function spinner(name) {
        return rowOf(name).querySelector('.stream-row-spinner');
    }

    it('says it is loading, with a spinner beside its name', () => {
        setup([stream('SEC Filings', { status: 'loading' })]);

        expect(status('SEC Filings')).toBe('Loading');
        expect(spinner('SEC Filings')).toHaveAttribute('aria-label', 'Loading SEC Filings');
        expect(within(rowOf('SEC Filings')).getByRole('status')).toBeInTheDocument();
    });

    it('says it is still loading once it has taken a while, and keeps its spinner', () => {
        setup([stream('S&P 500', { status: 'slow' })]);

        expect(status('S&P 500')).toBe('Still loading. This stream can take a while.');
        expect(spinner('S&P 500')).not.toBeNull();
    });

    it('says it could not load, with no spinner, and a button that asks again', () => {
        const retry = jest.fn();

        setup([stream('SEC Filings', { status: 'failed', retry: retry })]);

        expect(status('SEC Filings')).toBe('Could not load this stream.Retry');
        expect(spinner('SEC Filings')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Retry SEC Filings' }));

        expect(retry).toHaveBeenCalledTimes(1);
    });

    it('draws its bars under the line, since its schedule is known before its report', () => {
        setup([stream('SEC Filings', { status: 'loading', bars: BARS })]);

        expect(rowOf('SEC Filings').querySelectorAll('.stream-bar-slot')).toHaveLength(4);
        expect(rowOf('SEC Filings').querySelector('.stream-row-bars-wrap')).toHaveClass('stream-row-bars-waiting');
    });

    it('says nothing, and shows no spinner, once its report is in', () => {
        setup([stream('SEC Filings')]);

        expect(status('SEC Filings')).toBeNull();
        expect(spinner('SEC Filings')).toBeNull();
        expect(rowOf('SEC Filings').querySelector('.stream-row-bars-wrap')).not.toHaveClass('stream-row-bars-waiting');
    });

    it('does not hold up a row whose report is in', () => {
        setup([stream('S&P 500', { status: 'slow' }), stream('SEC Filings', { bars: BARS })]);

        expect(status('SEC Filings')).toBeNull();
        expect(rowOf('SEC Filings').querySelectorAll('.stream-bar-reported')).toHaveLength(2);
    });
});

describe('the bars', () => {
    function bars() {
        return [...rowOf('SEC Filings').querySelectorAll('.stream-bar')];
    }

    it('are one per interval, each naming itself to a screen reader', () => {
        setup([stream('SEC Filings', { bars: BARS })]);

        const slots = rowOf('SEC Filings').querySelectorAll('[role="img"]');

        expect(slots).toHaveLength(4);
        expect(slots[1]).toHaveAttribute('aria-label', 'SEC Filings, Mon, Sep 28: 200 records');
    });

    it('stand as tall as their records, on the row\'s own scale', () => {
        setup([stream('SEC Filings', { bars: BARS })]);

        expect(bars()[1].style.height).toBe('100%');
        expect(bars()[2].style.height).toBe('25%');
    });

    it('never stand shorter than a sliver, so a bar with one record is still seen', () => {
        setup([stream('SEC Filings', {
            bars: [
                { start: at(28), kind: 'reported', records: 1000, failed: 0, health: 1 },
                { start: at(29), kind: 'reported', records: 1, failed: 0, health: 1 },
            ],
        })]);

        expect(bars()[1].style.height).toBe('8%');
    });

    it('stand at a sliver when nothing in the row brought a record', () => {
        setup([stream('SEC Filings', { bars: [{ start: at(28), kind: 'reported', records: 0, failed: 5, health: 0 }] })]);

        expect(bars()[0].style.height).toBe('8%');
    });

    it('are shaded by their height, and dotted where some failed (#167)', () => {
        setup([stream('SEC Filings', { bars: BARS })]);

        expect(bars()[1]).toHaveClass('stream-bar-reported', 'stream-shade-0');
        expect(bars()[1]).not.toHaveClass('stream-bar-failed');
        expect(bars()[2]).toHaveClass('stream-shade-3', 'stream-bar-failed');
    });

    it('are shaded the same, whatever their health, when they stand the same (#167)', () => {
        setup([stream('SEC Filings', {
            bars: [
                { start: at(28), kind: 'reported', records: 100, failed: 0, health: 1 },
                { start: at(29), kind: 'reported', records: 100, failed: 100, health: 0.5 },
            ],
        })]);

        expect(bars()[0]).toHaveClass('stream-shade-0');
        expect(bars()[1]).toHaveClass('stream-shade-0', 'stream-bar-failed');
    });

    it('draw a miss and an unscheduled interval by their kind, with no height of their own', () => {
        setup([stream('SEC Filings', { bars: BARS })]);

        expect(bars()[0]).toHaveClass('stream-bar-off');
        expect(bars()[3]).toHaveClass('stream-bar-missed');
        expect(bars()[3].style.height).toBe('');
    });

    it('sit closer together past thirty', () => {
        const many = Array.from({ length: 31 }, (_, i) => ({ start: new Date(2026, 8, 30, 0, i), kind: 'off' }));

        setup([stream('SEC Filings', { bars: many }), stream('BLS', { bars: BARS })]);

        expect(rowOf('SEC Filings').querySelector('.stream-row-bars')).toHaveClass('stream-row-bars-dense');
        expect(rowOf('BLS').querySelector('.stream-row-bars')).not.toHaveClass('stream-row-bars-dense');
    });
});

describe('a bar\'s shade by its height (#167)', () => {
    it.each([
        [100, 100, 0],
        [81, 100, 0],
        [80, 100, 1],
        [60, 100, 2],
        [50, 100, 2],
        [21, 100, 3],
        [20, 100, 4],
        [1, 100, 4],
        [0, 100, 4],
    ])('draws %s of a row peaking at %s in step %s', (records, peak, step) => {
        expect(heightShade(records, peak)).toBe(step);
    });

    it('draws the lightest step for a row with nothing reported, which has no scale', () => {
        expect(heightShade(0, 0)).toBe(SHADES - 1);
        expect(heightShade(5, undefined)).toBe(SHADES - 1);
    });

    it('never steps past the darkest, even for more than the peak', () => {
        expect(heightShade(120, 100)).toBe(0);
    });
});

describe('pointing at a bar', () => {
    it('says nothing until a bar is pointed at', () => {
        setup([stream('SEC Filings', { bars: BARS })]);

        expect(readout()).toBe('Point at a bar, or tap it, to see what it holds.');
    });

    it('says which stream and interval the bar is, and what it holds', () => {
        setup([stream('SEC Filings', { bars: BARS })]);

        fireEvent.mouseEnter(rowOf('SEC Filings').querySelectorAll('.stream-bar-slot')[2]);

        expect(readout()).toBe('SEC Filings, Tue, Sep 2950 records, 50 failed (health 50%)');
    });

    it('says the same for a bar tapped on a phone', () => {
        setup([stream('SEC Filings', { bars: BARS })]);

        fireEvent.click(rowOf('SEC Filings').querySelectorAll('.stream-bar-slot')[3]);

        expect(readout()).toBe('SEC Filings, Wed, Sep 30Missed: a run was due, and nothing reported');
    });
});

describe('the popup by a bar a mouse points at (#167)', () => {
    function slots(name = 'SEC Filings') {
        return rowOf(name).querySelectorAll('.stream-bar-slot');
    }

    function tip() {
        return document.querySelector('.stream-bar-tip');
    }

    //
    // a pointer coming onto a bar from outside the rows, and leaving it for
    // outside them again
    //
    function point(slot, pointerType = 'mouse') {
        fireEvent(slot, Object.assign(
            new MouseEvent('pointerover', { bubbles: true, relatedTarget: document.body }),
            { pointerType: pointerType }
        ));
    }

    function leave(slot) {
        fireEvent(slot, Object.assign(
            new MouseEvent('pointerout', { bubbles: true, relatedTarget: document.body }),
            { pointerType: 'mouse' }
        ));
    }

    //
    // what a browser would measure: a row of bars 600px across, and the bar
    // pointed at 20px wide at `left`, standing 32px tall in its 72px slot
    //
    function measured(left) {
        const rect = (x, y, width, height) => ({
            left: x, top: y, width: width, height: height, right: x + width, bottom: y + height, x: x, y: y,
        });

        return jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function measure() {
            if (this.classList.contains('stream-row-bars-wrap')) {
                return rect(0, 0, 600, 72);
            }

            if (this.classList.contains('stream-bar-slot')) {
                return rect(left, 0, 20, 72);
            }

            return this.classList.contains('stream-bar') ? rect(left, 40, 20, 32) : rect(0, 0, 0, 0);
        });
    }

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('says when the bar was, what it holds, and what a click opens', () => {
        setup([stream('SEC Filings', { bars: BARS })], { onOpen: () => {} });

        point(slots()[2]);

        expect(tip().querySelector('.stream-bar-tip-when')).toHaveTextContent('Tue, Sep 29');
        expect(tip().querySelector('.stream-bar-tip-what')).toHaveTextContent('50 records, 50 failed (health 50%)');
        expect(tip().querySelector('.stream-bar-tip-hint')).toHaveTextContent('Click to see its hours');
    });

    it('says what a miss is, as the line under the rows does', () => {
        setup([stream('SEC Filings', { bars: BARS })]);

        point(slots()[3]);

        expect(tip().querySelector('.stream-bar-tip-what')).toHaveTextContent('Missed: a run was due, and nothing reported');
    });

    it.each([
        ['month', 'Click to see its days'],
        ['day', 'Click to see its hours'],
        ['hour', 'Click to see its minutes'],
    ])('names what a bar by the %s opens', (rate, hint) => {
        setup([stream('SEC Filings', { bars: BARS })], { rate: rate, onOpen: () => {} });

        point(slots()[1]);

        expect(tip().querySelector('.stream-bar-tip-hint')).toHaveTextContent(hint);
    });

    it('says nothing of a click where a bar opens nothing', () => {
        setup([stream('SEC Filings', { bars: BARS })], { rate: 'minute', onOpen: () => {} });
        point(slots()[1]);
        expect(tip().querySelector('.stream-bar-tip-hint')).toBeNull();

        leave(slots()[1]);
        setup([stream('BLS', { bars: BARS })]);
        point(slots('BLS')[1]);
        expect(rowOf('BLS').querySelector('.stream-bar-tip-hint')).toBeNull();
    });

    it('comes up for a mouse only: a finger has the line under the rows', () => {
        setup([stream('SEC Filings', { bars: BARS })]);

        point(slots()[1], 'touch');

        expect(tip()).toBeNull();
    });

    it('is hidden from a screen reader, which each bar names itself to', () => {
        setup([stream('SEC Filings', { bars: BARS })]);

        point(slots()[1]);

        expect(tip()).toHaveAttribute('aria-hidden', 'true');
    });

    it('keeps the bar it is by lit, and goes when the pointer leaves the bars', () => {
        setup([stream('SEC Filings', { bars: BARS })]);

        point(slots()[1]);
        expect(slots()[1]).toHaveClass('is-pointed');

        leave(slots()[1]);
        expect(tip()).toBeNull();
        expect(slots()[1]).not.toHaveClass('is-pointed');
    });

    it('goes when a click opens the bar', () => {
        setup([stream('SEC Filings', { bars: BARS })], { onOpen: () => {} });

        point(slots()[1]);
        fireEvent.click(slots()[1]);

        expect(tip()).toBeNull();
    });

    it('stands over the bar\'s top, centered on it', () => {
        measured(290);
        setup([stream('SEC Filings', { bars: BARS })]);

        point(slots()[1]);

        expect(tip()).toHaveClass('stream-bar-tip-middle');
        expect(tip().style.left).toBe('300px');
        expect(tip().style.top).toBe('40px');
    });

    it('lines up with the row\'s start or end near it, so it stays inside the row', () => {
        measured(0);
        setup([stream('SEC Filings', { bars: BARS }), stream('BLS', { bars: BARS })]);

        point(slots()[1]);
        expect(tip()).toHaveClass('stream-bar-tip-start');

        jest.restoreAllMocks();
        measured(570);
        point(slots('BLS')[1]);
        expect(rowOf('BLS').querySelector('.stream-bar-tip')).toHaveClass('stream-bar-tip-end');
    });

    it('stands just over the baseline for a bar with no height', () => {
        jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function measure() {
            const height = this.classList.contains('stream-row-bars-wrap') || this.classList.contains('stream-bar-slot') ? 72 : 0;
            const top = this.classList.contains('stream-bar') ? 72 : 0;

            return { left: 0, top: top, width: 20, height: height, right: 20, bottom: top + height, x: 0, y: top };
        });
        setup([stream('SEC Filings', { bars: [{ start: at(30), kind: 'pending' }] })]);

        point(slots()[0]);

        expect(tip().style.top).toBe('70px');
    });
});

describe('opening a bar (#159)', () => {
    //
    // a bar opens through 'onOpen' when the page offers one: a click where a
    // pointer described it first, and on a phone a second tap on the same bar
    //
    function slots(name = 'SEC Filings') {
        return rowOf(name).querySelectorAll('.stream-bar-slot');
    }

    //
    // a touch, as a phone sends one: the pointer goes down, the mouse is said to
    // enter, and the click follows
    //
    function tap(slot) {
        fireEvent(slot, Object.assign(new MouseEvent('pointerdown', { bubbles: true }), { pointerType: 'touch' }));
        fireEvent.mouseEnter(slot);
        fireEvent.click(slot);
    }

    it('opens the bar clicked, and hands the page the bar', () => {
        const onOpen = jest.fn();

        setup([stream('SEC Filings', { bars: BARS })], { onOpen: onOpen });
        fireEvent.mouseEnter(slots()[1]);
        fireEvent.click(slots()[1]);

        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(onOpen.mock.calls[0][0]).toBe(BARS[1]);
    });

    it('opens on a phone only on the second tap of the same bar', () => {
        const onOpen = jest.fn();

        setup([stream('SEC Filings', { bars: BARS })], { onOpen: onOpen });

        tap(slots()[2]);
        expect(onOpen).not.toHaveBeenCalled();
        expect(readout()).toBe('SEC Filings, Tue, Sep 2950 records, 50 failed (health 50%)');

        tap(slots()[2]);
        expect(onOpen).toHaveBeenCalledWith(BARS[2]);
    });

    it('describes a different bar on a phone rather than opening it', () => {
        const onOpen = jest.fn();

        setup([stream('SEC Filings', { bars: BARS })], { onOpen: onOpen });

        tap(slots()[2]);
        tap(slots()[3]);

        expect(onOpen).not.toHaveBeenCalled();
        expect(readout()).toBe('SEC Filings, Wed, Sep 30Missed: a run was due, and nothing reported');
    });

    it('only describes, when the page offers nothing to open', () => {
        setup([stream('SEC Filings', { bars: BARS })]);

        fireEvent.click(slots()[1]);

        expect(readout()).toBe('SEC Filings, Mon, Sep 28200 records');
        expect(rowOf('SEC Filings').querySelector('.stream-row-bars')).not.toHaveClass('stream-row-bars-open');
    });

    it('marks the bars as ones that open', () => {
        setup([stream('SEC Filings', { bars: BARS })], { onOpen: () => {} });

        expect(rowOf('SEC Filings').querySelector('.stream-row-bars')).toHaveClass('stream-row-bars-open');
    });
});

describe('sorting by a figure', () => {
    const ROWS = [
        stream('A', { figures: { health: '90.00%', coverage: '50%', total: '1,000' } }),
        stream('B', { figures: { health: 'n/a', coverage: '75%', total: '20' } }),
        stream('C', { figures: { health: '99.50%', coverage: '100%', total: 'n/a' } }),
    ];

    //
    // the rows, holding their sort the way the page does: what they are handed,
    // and what they hand back through 'onSort'. With the phone's menu beside
    // them, as the page puts it on its line of controls
    //
    function Sortable({ initial = null, told = () => {}, ...props }) {
        const [sort, setSort] = React.useState(initial);
        const onSort = (next) => {
            told(next);
            setSort(next);
        };

        return (
            <>
                <SortMenu sort={sort} onSort={onSort} />
                <StreamRows {...props} sort={sort} onSort={onSort} />
            </>
        );
    }

    function sortable(props = {}) {
        return render(<Sortable rows={ROWS} rate='day' first='Sep 11' last='Now' {...props} />);
    }

    function heading(label) {
        return screen.getByRole('button', { name: `Sort by ${label}` });
    }

    function mark(label) {
        return heading(label).querySelector('[data-mark]').dataset.mark;
    }

    it('keeps the rows in the order they came until a figure is chosen', () => {
        sortable();

        expect(names()).toEqual(['A', 'B', 'C']);
    });

    it('puts the largest first, and n/a last', () => {
        sortable();

        fireEvent.click(heading('Health'));

        expect(names()).toEqual(['C', 'A', 'B']);
        expect(heading('Health')).toHaveAttribute('aria-pressed', 'true');
    });

    it('reverses on a second click, and keeps n/a last', () => {
        sortable();

        fireEvent.click(heading('Health'));
        fireEvent.click(heading('Health'));

        expect(names()).toEqual(['A', 'C', 'B']);
    });

    it('puts the page\'s own order back on a third click', () => {
        sortable();

        fireEvent.click(heading('Health'));
        fireEvent.click(heading('Health'));
        fireEvent.click(heading('Health'));

        expect(names()).toEqual(['A', 'B', 'C']);
        expect(heading('Health')).toHaveAttribute('aria-pressed', 'false');
    });

    it('reads a total with thousands separators as the number it is', () => {
        sortable();

        fireEvent.click(heading('Total Records'));

        expect(names()).toEqual(['A', 'B', 'C']);
    });

    it('starts a new figure largest first', () => {
        sortable();

        fireEvent.click(heading('Health'));
        fireEvent.click(heading('Coverage'));

        expect(names()).toEqual(['C', 'B', 'A']);
        expect(heading('Health')).toHaveAttribute('aria-pressed', 'false');
    });

    it('marks every heading as one that sorts, and the one in use with its direction', () => {
        sortable();

        expect(['Health', 'Coverage', 'Total Records'].map(mark)).toEqual(['none', 'none', 'none']);

        fireEvent.click(heading('Coverage'));
        expect(['Health', 'Coverage', 'Total Records'].map(mark)).toEqual(['none', 'desc', 'none']);
        expect(heading('Coverage')).toHaveClass('stream-rows-sort-active');

        fireEvent.click(heading('Coverage'));
        expect(mark('Coverage')).toBe('asc');
    });

    it('starts from the sort it is handed', () => {
        sortable({ initial: { key: 'total', dir: 'asc' } });

        expect(names()).toEqual(['B', 'A', 'C']);
        expect(mark('Total Records')).toBe('asc');
    });

    it('hands every change back, so the page can keep it', () => {
        const told = jest.fn();

        sortable({ told: told });

        fireEvent.click(heading('Health'));
        fireEvent.click(heading('Health'));
        fireEvent.click(heading('Health'));

        expect(told.mock.calls.map(([sort]) => sort)).toEqual([
            { key: 'health', dir: 'desc' },
            { key: 'health', dir: 'asc' },
            null,
        ]);
    });

    describe('from the phone\'s button (#173)', () => {
        function button() {
            return screen.getByRole('button', { name: /^Sort: / });
        }

        function choose(label) {
            fireEvent.click(button());
            fireEvent.click(screen.getByRole('menuitem', { name: label }));
        }

        it('offers the page\'s order, and each figure both ways', () => {
            sortable();

            fireEvent.click(button());

            expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
                'Default order',
                'Health, highest first',
                'Health, lowest first',
                'Coverage, highest first',
                'Coverage, lowest first',
                'Total Records, most first',
                'Total Records, fewest first',
            ]);
        });

        it('sorts as the headings do', () => {
            sortable();

            choose('Coverage, lowest first');

            expect(names()).toEqual(['A', 'B', 'C']);

            choose('Health, highest first');

            expect(names()).toEqual(['C', 'A', 'B']);
            expect(mark('Health')).toBe('desc');
        });

        it('puts the page\'s order back from Default order', () => {
            const told = jest.fn();

            sortable({ initial: { key: 'health', dir: 'desc' }, told: told });

            choose('Default order');

            expect(names()).toEqual(['A', 'B', 'C']);
            expect(told).toHaveBeenLastCalledWith(null);
        });

        it('names itself for the sort the headings chose, and checks it in its menu', () => {
            sortable();

            fireEvent.click(heading('Total Records'));

            expect(button()).toHaveAccessibleName('Sort: Total Records, most first');

            fireEvent.click(button());

            const checked = screen.getAllByRole('menuitem')
                .filter((item) => item.querySelector('.stream-sort-check svg'))
                .map((item) => item.textContent);

            expect(checked).toEqual(['Total Records, most first']);
        });

        it('is green only while the list is sorted', () => {
            sortable();

            expect(button()).not.toHaveClass('stream-sort-on');

            fireEvent.click(heading('Health'));

            expect(button()).toHaveClass('stream-sort-on');

            fireEvent.click(heading('Health'));
            fireEvent.click(heading('Health'));

            expect(button()).not.toHaveClass('stream-sort-on');
        });
    });
});

describe('the next sort', () => {
    it('starts a figure largest first, reverses it, then lets it go', () => {
        expect(nextSort(null, 'health')).toEqual({ key: 'health', dir: 'desc' });
        expect(nextSort({ key: 'health', dir: 'desc' }, 'health')).toEqual({ key: 'health', dir: 'asc' });
        expect(nextSort({ key: 'health', dir: 'asc' }, 'health')).toBeNull();
    });

    it('starts another figure largest first, whatever the last one was doing', () => {
        expect(nextSort({ key: 'health', dir: 'asc' }, 'total')).toEqual({ key: 'total', dir: 'desc' });
    });

    it('names the figures a kept sort may name', () => {
        expect(SORT_KEYS).toEqual(['health', 'coverage', 'total']);
    });
});

describe('around the rows', () => {
    it('names the first interval of the window and the last', () => {
        setup([stream('A')]);

        expect(document.querySelector('.stream-rows-axis').textContent).toBe('Sep 11Now');
    });

    it('has a legend for the shades and every kind of bar', () => {
        setup([stream('A')]);

        const legend = document.querySelector('.stream-rows-legend').textContent;

        ['Height and shade', 'Fewer', 'More', 'Missed', 'Some failed', 'Not scheduled']
            .forEach((key) => expect(legend).toContain(key));
    });

    it('draws the shades as one ramp, from the fewest records to the most (#167)', () => {
        setup([stream('A')]);

        const steps = [...document.querySelectorAll('.stream-rows-ramp-steps .stream-rows-swatch')];

        expect(steps).toHaveLength(SHADES);
        expect(steps.map((step) => step.className.match(/stream-shade-(\d)/)[1]))
            .toEqual(['4', '3', '2', '1', '0']);
    });
});

describe('the phone\'s sort button on its own', () => {
    it('starts at the page\'s order, and asks for nothing until a choice is made', () => {
        render(<SortMenu />);

        const button = screen.getByRole('button', { name: 'Sort: Default order' });

        expect(button).toHaveAttribute('aria-haspopup', 'menu');
        expect(button).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(button);

        expect(button).toHaveAttribute('aria-expanded', 'true');

        fireEvent.click(screen.getByRole('menuitem', { name: 'Health, lowest first' }));

        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(button).toHaveAccessibleName('Sort: Default order');
    });

    it('closes on Escape, and leaves the sort as it was', () => {
        const onSort = jest.fn();

        render(<SortMenu sort={{ key: 'coverage', dir: 'asc' }} onSort={onSort} />);

        const button = screen.getByRole('button', { name: 'Sort: Coverage, lowest first' });

        fireEvent.click(button);
        fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(onSort).not.toHaveBeenCalled();
    });
});

describe('a phone\'s list (#161)', () => {
    const ROWS = [stream('A', { figures: { health: '90.00%', coverage: '50%', total: '1,000' } })];

    function pick(name) {
        const slot = rowOf(name).querySelector('.stream-row-pick');

        return [
            slot.querySelector('.stream-row-pick-value').textContent,
            slot.querySelector('.stream-row-pick-name').textContent,
        ];
    }

    it('shows each row\'s coverage while the list is in the page\'s order', () => {
        setup(ROWS);

        expect(pick('A')).toEqual(['50%', 'coverage']);
    });

    it('shows the figure the list is sorted by, so the order is one the reader can see', () => {
        setup(ROWS, { sort: { key: 'total', dir: 'desc' } });

        expect(pick('A')).toEqual(['1,000', 'records']);
    });

    it('shows no figure until the row\'s report is in', () => {
        setup([stream('A', { status: 'loading' })]);

        expect(pick('A')).toEqual(['', 'coverage']);
    });

    it('marks each row as one that opens, and says how', () => {
        setup(ROWS);

        expect(rowOf('A').querySelector('.stream-row-chevron')).toHaveAttribute('aria-hidden', 'true');
        expect(document.querySelector('.stream-rows-hint')).toHaveTextContent('Tap a stream to see its graph.');
    });
});

describe('the color key on a phone (#161)', () => {
    it('folds under its own button, which opens and closes it', () => {
        setup([stream('A')]);

        const toggle = screen.getByRole('button', { name: 'What the colors mean' });

        expect(toggle).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(document.querySelector('.stream-rows-legend')).toHaveClass('stream-rows-legend-open');

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(document.querySelector('.stream-rows-legend')).not.toHaveClass('stream-rows-legend-open');
    });
});

describe('the divider between the bars and the figures (#161)', () => {
    const ROWS = [stream('A', { bars: BARS }), stream('B')];

    function box() {
        return document.querySelector('.stream-rows');
    }

    function grip() {
        return document.querySelector('.stream-rows-grip');
    }

    function fold() {
        return screen.getByRole('button', { name: 'Fold Health, Coverage and Total Records' });
    }

    function rail() {
        return screen.queryByRole('button', { name: 'Show Health, Coverage and Total Records' });
    }

    //
    // a drag, as a pointer makes one: down on the strip, then moving, and up,
    // on the window
    //
    function press(x, init = {}) {
        fireEvent(grip(), new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: x, button: 0, ...init }));
    }

    function move(x) {
        act(() => {
            window.dispatchEvent(new MouseEvent('pointermove', { clientX: x }));
        });
    }

    function release() {
        act(() => {
            window.dispatchEvent(new MouseEvent('pointerup'));
        });
    }

    //
    // what a browser would measure: the rows' box `across` wide, and the
    // figures' headings at the stylesheet's width
    //
    function measured(across, figures) {
        return jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function measure() {
            const width = this.classList.contains('stream-rows')
                ? across
                : this.classList.contains('stream-rows-head-figures') ? figures : 0;

            return { width: width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0 };
        });
    }

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('folds the figures from the arrow halfway down it', () => {
        const onFold = jest.fn();

        setup(ROWS, { onFold: onFold });
        fireEvent.click(fold());

        expect(onFold).toHaveBeenCalledWith(true);
    });

    it('stands beside the rows only, so it stops at the last row (#167)', () => {
        setup(ROWS);

        const table = document.querySelector('.stream-rows-table');

        expect(table).toContainElement(document.querySelector('.stream-rows-divider'));
        expect(table).toContainElement(rowOf('B'));
        expect(table).not.toContainElement(document.querySelector('.stream-rows-readout'));
        expect(table).not.toContainElement(document.querySelector('.stream-rows-legend'));
    });

    it('leaves a rail beside the rows only, as well (#167)', () => {
        setup(ROWS, { folded: true });

        const table = document.querySelector('.stream-rows-table');

        expect(table).toContainElement(rail());
        expect(table).not.toContainElement(document.querySelector('.stream-rows-legend'));
    });

    it('draws no rail while the figures are open', () => {
        setup(ROWS);

        expect(rail()).toBeNull();
        expect(box()).not.toHaveClass('stream-rows-folded');
    });

    it('gives way to the rail the figures fold into, which opens them again', () => {
        const onFold = jest.fn();

        setup(ROWS, { folded: true, onFold: onFold });

        expect(box()).toHaveClass('stream-rows-folded');
        expect(document.querySelector('.stream-rows-divider')).toBeNull();

        fireEvent.click(rail());

        expect(onFold).toHaveBeenCalledWith(false);
    });

    it('is not a stop for a keyboard or a screen reader, where the arrow is', () => {
        setup(ROWS);

        expect(grip()).toHaveAttribute('aria-hidden', 'true');
        expect(fold()).toBeInTheDocument();
    });

    it('carries a width it was dragged to on the rows\' box, and none of its own otherwise', () => {
        const { rerender } = setup(ROWS, { width: 300 });

        expect(box().style.getPropertyValue('--stream-figures')).toBe('300px');

        rerender(<StreamRows rows={ROWS} rate='day' first='Sep 11' last='Now' />);

        expect(box().style.getPropertyValue('--stream-figures')).toBe('');
    });

    it('carries no width while the figures are folded', () => {
        setup(ROWS, { width: 300, folded: true });

        expect(box().style.getPropertyValue('--stream-figures')).toBe('');
    });

    it('widens the figures as it goes left and narrows them as it goes right, keeping where it settles', () => {
        const onResize = jest.fn();

        setup(ROWS, { width: 300, onResize: onResize });

        press(500);
        move(450);
        expect(onResize).toHaveBeenLastCalledWith(350, false);

        move(520);
        expect(onResize).toHaveBeenLastCalledWith(280, false);

        release();
        expect(onResize).toHaveBeenLastCalledWith(280, true);
        expect(onResize).toHaveBeenCalledTimes(3);
    });

    it('lets go of the pointer once it is up', () => {
        const onResize = jest.fn();

        setup(ROWS, { width: 300, onResize: onResize });

        press(500);
        move(450);
        release();
        move(400);

        expect(onResize).toHaveBeenCalledTimes(2);
    });

    it('stops the figures at the narrowest they can be', () => {
        const onResize = jest.fn();

        setup(ROWS, { width: 300, onResize: onResize });

        press(500);
        move(500 + (300 - FIGURES_MIN) + 10);

        expect(onResize).toHaveBeenLastCalledWith(FIGURES_MIN, false);
    });

    it('folds them once dragged far enough past the narrowest, and lets their width go', () => {
        const onResize = jest.fn();
        const onFold = jest.fn();

        setup(ROWS, { width: 300, onResize: onResize, onFold: onFold });

        press(500);
        move(500 + (300 - (FIGURES_MIN - FIGURES_FOLD)) + 1);

        expect(onFold).toHaveBeenCalledWith(true, true);
        expect(onResize).not.toHaveBeenCalled();

        move(400);
        release();

        expect(onResize).not.toHaveBeenCalled();
    });

    it('stops the figures at half the row', () => {
        const onResize = jest.fn();

        measured(800, 322);
        setup(ROWS, { width: 300, onResize: onResize });

        press(500);
        move(100);

        expect(onResize).toHaveBeenLastCalledWith(400, false);
    });

    it('starts from the width the stylesheet gave the figures, when none was dragged', () => {
        const onResize = jest.fn();

        measured(1200, 322);
        setup(ROWS, { onResize: onResize });

        press(500);
        move(490);

        expect(onResize).toHaveBeenLastCalledWith(332, false);
    });

    it('starts from the narrowest, where there is nothing to measure', () => {
        const onResize = jest.fn();

        setup(ROWS, { onResize: onResize });

        press(500);
        move(490);

        expect(onResize).toHaveBeenLastCalledWith(FIGURES_MIN + 10, false);
    });

    it('keeps nothing from a grab that never moved', () => {
        const onResize = jest.fn();

        setup(ROWS, { width: 300, onResize: onResize });

        press(500);
        release();

        expect(onResize).not.toHaveBeenCalled();
    });

    it('answers only the main button', () => {
        const onResize = jest.fn();

        setup(ROWS, { width: 300, onResize: onResize });

        press(500, { button: 2 });
        move(450);

        expect(onResize).not.toHaveBeenCalled();
    });

    it('drags once for a second grab, which takes over from the first', () => {
        const onResize = jest.fn();

        setup(ROWS, { width: 300, onResize: onResize });

        press(500);
        press(600);
        move(590);

        expect(onResize).toHaveBeenCalledTimes(1);
        expect(onResize).toHaveBeenLastCalledWith(310, false);
    });

    it('folds and drags harmlessly when nothing keeps the arrangement', () => {
        setup(ROWS, { width: 300 });

        fireEvent.click(fold());
        press(500);
        move(450);
        release();

        expect(box()).not.toHaveClass('stream-rows-folded');
    });

    it('lets go of the window when the rows go away mid-drag', () => {
        const onResize = jest.fn();
        const { unmount } = setup(ROWS, { width: 300, onResize: onResize });

        press(500);
        unmount();

        window.dispatchEvent(new MouseEvent('pointermove', { clientX: 400 }));

        expect(onResize).not.toHaveBeenCalled();
    });
});

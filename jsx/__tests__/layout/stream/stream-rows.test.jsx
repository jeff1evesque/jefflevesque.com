/**
 * stream-rows.test.jsx: every stream as a row of bars, with its figures beside it.
 *
 * stream-bars.test.js decides what each bar is. This covers how a row draws the
 * bars it is handed -- their heights on the row's own scale, their shades, what a
 * bar says when it is pointed at -- and how the figures sort the rows.
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';

import StreamRows, { SORT_KEYS, nextSort } from '../../../import/layout/stream/stream-rows.jsx';

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
        current: false,
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

    it('ends with its three figures, and says them again under its name for a phone', () => {
        setup([stream('SEC Filings', { figures: { health: '99%', coverage: '95%', total: '1,234' } })]);

        const row = rowOf('SEC Filings');

        expect([...row.querySelectorAll('.stream-row-figure')].map((cell) => cell.textContent))
            .toEqual(['99%', '95%', '1,234']);
        expect(row.querySelector('.stream-row-inline'))
            .toHaveTextContent('Health 99% · Coverage 95% · Records 1,234');
    });


    it('is marked when it is the stream the address names', () => {
        setup([stream('SEC Filings', { current: true }), stream('BLS')]);

        expect(rowOf('SEC Filings')).toHaveClass('stream-row-current');
        expect(rowOf('BLS')).not.toHaveClass('stream-row-current');
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

    it('are shaded by their health, and dotted where some failed', () => {
        setup([stream('SEC Filings', { bars: BARS })]);

        expect(bars()[1]).toHaveClass('stream-bar-reported', 'stream-health-0');
        expect(bars()[1]).not.toHaveClass('stream-bar-failed');
        expect(bars()[2]).toHaveClass('stream-health-3', 'stream-bar-failed');
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
    // and what they hand back through 'onSort'
    //
    function Sortable({ initial = null, told = () => {}, ...props }) {
        const [sort, setSort] = React.useState(initial);

        return (
            <StreamRows
                {...props}
                sort={sort}
                onSort={(next) => {
                    told(next);
                    setSort(next);
                }}
            />
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

    describe('from the phone\'s menu', () => {
        function menu() {
            return screen.getByRole('combobox');
        }

        it('offers the page\'s order, and each figure both ways', () => {
            sortable();

            expect([...menu().querySelectorAll('option')].map((option) => option.textContent)).toEqual([
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

            fireEvent.change(menu(), { target: { value: 'coverage:asc' } });

            expect(names()).toEqual(['A', 'B', 'C']);

            fireEvent.change(menu(), { target: { value: 'health:desc' } });

            expect(names()).toEqual(['C', 'A', 'B']);
            expect(mark('Health')).toBe('desc');
        });

        it('puts the page\'s order back from Default order', () => {
            const told = jest.fn();

            sortable({ initial: { key: 'health', dir: 'desc' }, told: told });

            fireEvent.change(menu(), { target: { value: '' } });

            expect(names()).toEqual(['A', 'B', 'C']);
            expect(told).toHaveBeenLastCalledWith(null);
        });

        it('shows the sort the headings chose', () => {
            sortable();

            fireEvent.click(heading('Total Records'));

            expect(menu()).toHaveValue('total:desc');
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

    it('has a legend for every shade and every kind of bar', () => {
        setup([stream('A')]);

        const legend = document.querySelector('.stream-rows-legend').textContent;

        ['All', '95-99%', '80-94%', '50-79%', 'Under 50%', 'Missed', 'Some failed', 'Not scheduled']
            .forEach((key) => expect(legend).toContain(key));
    });
});

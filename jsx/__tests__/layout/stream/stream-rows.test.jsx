/**
 * stream-rows.test.jsx: every stream as a row of bars, with its figures beside it.
 *
 * stream-bars.test.js decides what each bar is. This covers how a row draws the
 * bars it is handed -- their heights on the row's own scale, their shades, what a
 * bar says when it is pointed at -- and how the figures sort the rows.
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';

import StreamRows from '../../../import/layout/stream/stream-rows.jsx';

const at = (d) => new Date(2026, 8, d);

//
// a row, with only what a case needs said
//
function stream(name, overrides = {}) {
    return {
        stream: name.toLowerCase().replace(/\s+/g, '-'),
        name: name,
        schedule: 'weekdays, once a day',
        loading: false,
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

    it('shows a loader while its report is on the way', () => {
        setup([stream('SEC Filings', { loading: true }), stream('BLS')]);

        expect(rowOf('SEC Filings').querySelector('.stream-row-loader')).not.toBeNull();
        expect(rowOf('BLS').querySelector('.stream-row-loader')).toBeNull();
    });

    it('is marked when it is the stream the address names', () => {
        setup([stream('SEC Filings', { current: true }), stream('BLS')]);

        expect(rowOf('SEC Filings')).toHaveClass('stream-row-current');
        expect(rowOf('BLS')).not.toHaveClass('stream-row-current');
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

describe('sorting by a figure', () => {
    const ROWS = [
        stream('A', { figures: { health: '90.00%', coverage: '50%', total: '1,000' } }),
        stream('B', { figures: { health: 'n/a', coverage: '75%', total: '20' } }),
        stream('C', { figures: { health: '99.50%', coverage: '100%', total: 'n/a' } }),
    ];

    it('keeps the rows in the order they came until a figure is chosen', () => {
        setup(ROWS);

        expect(names()).toEqual(['A', 'B', 'C']);
    });

    it('puts the largest first, and n/a last', () => {
        setup(ROWS);

        fireEvent.click(screen.getByRole('button', { name: 'Sort by Health' }));

        expect(names()).toEqual(['C', 'A', 'B']);
        expect(screen.getByRole('button', { name: 'Sort by Health' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('reverses on a second click, and keeps n/a last', () => {
        setup(ROWS);

        fireEvent.click(screen.getByRole('button', { name: 'Sort by Health' }));
        fireEvent.click(screen.getByRole('button', { name: 'Sort by Health' }));

        expect(names()).toEqual(['A', 'C', 'B']);
    });

    it('reads a total with thousands separators as the number it is', () => {
        setup(ROWS);

        fireEvent.click(screen.getByRole('button', { name: 'Sort by Total Records' }));

        expect(names()).toEqual(['A', 'B', 'C']);
    });

    it('starts a new figure largest first', () => {
        setup(ROWS);

        fireEvent.click(screen.getByRole('button', { name: 'Sort by Health' }));
        fireEvent.click(screen.getByRole('button', { name: 'Sort by Coverage' }));

        expect(names()).toEqual(['C', 'B', 'A']);
        expect(screen.getByRole('button', { name: 'Sort by Health' })).toHaveAttribute('aria-pressed', 'false');
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

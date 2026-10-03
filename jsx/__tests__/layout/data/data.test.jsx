/**
 * data.test.jsx: the data distribution listing.
 *
 * 1741 lines, the largest file in the codebase, so this does not attempt line
 * coverage. It covers what a visitor sees and, more usefully, the two contracts
 * this layout shares with modules tested elsewhere:
 *
 *   - stream-name.js supplies every display label. The component holds ids like
 *     'stock-split', so a test that no raw id reaches the screen is what
 *     ties the unit-tested module to its consumer.
 *
 *   - streamCoverage() returns a note for the two stock streams and null for the
 *     rest, and the listing is expected to fill a Coverage cell only where there
 *     is one, and leave the rest blank. That asymmetry is invisible from either
 *     side alone.
 *
 * Note: no network is mocked. setup.js provides a fetch resolving not-ok, and every
 *       loader logs and carries on, so this is the genuine pre-data state.
 *
 * Note: not redux-connected -- redux/container/data/data.jsx wraps it -- so it
 *       renders standalone with no Provider.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import DataLayout from '../../../import/layout/data/data.jsx';
import { KEY, VERSION } from '../../../import/general/listing-preference.js';

function setup(props = {}) {
    return render(
        <MemoryRouter>
            <DataLayout {...props} />
        </MemoryRouter>
    );
}

function bodyText() {
    return document.body.textContent.replace(/\s+/g, ' ');
}

//
// each stream's cell in the listing's `label` column, by the stream's name as the
// row shows it
//
function column(label) {
    const cells = {};

    document.querySelectorAll('.listing-table tbody tr').forEach((row) => {
        cells[row.querySelector('th').textContent] = row.querySelector(`td[data-label="${label}"]`);
    });

    return cells;
}

describe('the listing', () => {
    it('is titled as a distribution view', () => {
        setup();

        expect(bodyText()).toContain('Data Distribution');
    });

    it('lists all five streams', () => {
        setup();

        expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('renders each stream under its display label', () => {
        //
        // 'S&P 500' is queried with getAllByText because it legitimately appears
        // twice -- once as the stock-market label, once as its coverage note. The
        // two come from different maps in stream-name.js and happen to read the
        // same, which getByText would reject as ambiguous.
        //
        setup();

        expect(screen.getAllByText('S&P 500').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Stock Splits')).toBeInTheDocument();
        expect(screen.getByText('Bureau of Labor Statistics')).toBeInTheDocument();
        expect(screen.getByText('SEC Filings')).toBeInTheDocument();
        expect(screen.getByText('US Weather Alerts')).toBeInTheDocument();
    });

    it('never leaks a raw stream id to the screen', () => {
        setup();

        const text = bodyText();
        expect(text).not.toContain('stock-market');
        expect(text).not.toContain('us-national-weather');
    });
});

describe('the coverage row', () => {
    it('states the universe for the two stock streams', () => {
        //
        // the pair that needs it: they sit adjacent and differ precisely in scope,
        // which the titles alone leave ambiguous. 'S&P 500' the label and 'S&P 500'
        // the coverage are separate strings from separate maps.
        //
        setup();

        expect(screen.getByText('Market-wide')).toBeInTheDocument();
        expect(screen.getAllByText('S&P 500').length).toBeGreaterThanOrEqual(2);
    });

    it('fills the Coverage column for the two stock streams alone', () => {
        //
        // streamCoverage() returns null for bls, sec and weather, and the listing is
        // expected to leave their cells blank rather than render the null. A filled
        // cell on any of the three would mean it is being rendered.
        //
        setup();

        const coverage = column('Coverage');

        expect(coverage['S&P 500']).toHaveTextContent('S&P 500');
        expect(coverage['Stock Splits']).toHaveTextContent('Market-wide');

        ['Bureau of Labor Statistics', 'SEC Filings', 'US Weather Alerts'].forEach((name) => {
            expect(coverage[name]).toHaveClass('listing-table-blank');
        });
    });

    it('states the publication lag on bls alone', () => {
        //
        // bls is the one feed whose current month is always empty, so its row lands
        // on 'Records 0' against a populated table. The lag is what separates an
        // unpublished month from an unpopulated stream.
        //
        // On bls's row alone: stream_lag() returns null for the other four, and a
        // lag on every row would read as a page-level note rather than bls's own.
        //
        setup();

        const lag = column('Lag');

        expect(lag['Bureau of Labor Statistics']).toHaveTextContent('1-2 months');

        ['S&P 500', 'Stock Splits', 'SEC Filings', 'US Weather Alerts'].forEach((name) => {
            expect(lag[name]).toHaveClass('listing-table-blank');
        });
    });
});

describe('each row before data arrives', () => {
    it('shows records and partitions as n/a', () => {
        //
        // 'n/a' and 0 mean different things: not measured yet, versus measured and
        // empty. A 0 here would read as a stream with no data.
        //
        setup();

        expect(bodyText()).toContain('Records');
        expect(bodyText()).toContain('Partitions');
        expect(screen.getAllByText('n/a').length).toBeGreaterThanOrEqual(5);
    });

    it('describes every stream as a hive type', () => {
        setup();

        expect(screen.getAllByText('Hive').length).toBe(5);
    });

    it('states RDF availability per stream, not globally', () => {
        //
        // four streams publish RDF and stock-split does not, so this is a per-stream
        // flag rather than a page-level one. Rendering 'Available' for all five would
        // advertise triples that are not there.
        //
        setup();

        expect(screen.getAllByText('Available').length).toBe(4);
        expect(screen.getAllByText('None').length).toBe(1);
    });
});

describe('the scale controls', () => {
    it('offers a month and year range, as two inputs', () => {
        //
        // a range rather than a single period: the distribution is drawn across
        // whatever span is chosen, so there is a from and a to.
        //
        setup();

        const text = bodyText();
        expect(text).toContain('mm/yyyy');
        expect((text.match(/mm\/yyyy/g) || []).length).toBe(2);
    });

    it('steps its picker on from a year to that year\'s months, rather than closing on the year', () => {
        //
        // the views ran month then year, so picking a year was the picker's
        // last step, and closed it before a month could be picked
        //
        setup();

        fireEvent.click(screen.getAllByRole('button', { name: /Choose date/ })[0]);
        fireEvent.click(screen.getByRole('radio', { name: '2025' }));

        expect(screen.getByRole('radio', { name: 'March' })).toBeInTheDocument();
    });

    it('offers a filter and a sort', () => {
        setup();

        expect(bodyText()).toContain('Filter');
        expect(bodyText()).toContain('Sort');
    });

    it('renders interactive controls', () => {
        setup();

        expect(document.querySelectorAll('button').length).toBeGreaterThan(0);
    });
});

describe('the reader\'s order', () => {
    //
    // an order moved into is kept for the next visit, in localStorage, which lasts
    // the whole of this file
    //
    afterEach(() => {
        window.localStorage.clear();
    });

    const names = () => [...document.querySelectorAll('.listing-table tbody th')]
        .map((cell) => cell.textContent);

    it('lists the rows in the order kept, and keeps a new one, apart from /stream\'s', () => {
        window.localStorage.setItem(KEY, JSON.stringify({
            v: VERSION,
            stream: { order: ['us-national-weather'] },
            data: { order: ['bls'] },
        }));
        setup();

        expect(names()[0]).toBe('Bureau of Labor Statistics');

        fireEvent.keyDown(screen.getByRole('button', { name: 'Move SEC Filings' }), { key: 'ArrowUp' });

        const kept = JSON.parse(window.localStorage.getItem(KEY));

        expect(kept.data.order).toEqual(['bls', 'stock-market', 'sec', 'stock-split', 'us-national-weather']);
        expect(kept.stream.order).toEqual(['us-national-weather']);
    });
});

describe('resilience', () => {
    it('mounts with no props at all', () => {
        //
        // the redux container supplies its props; the shell is useful before any
        // data loads, so a missing prop must not stop it rendering.
        //
        expect(() => setup()).not.toThrow();
    });

    it('renders the full listing when every request fails', () => {
        //
        // the state after a total api outage: labels, types and RDF flags are all
        // local, so the listing is fully readable with n/a for the measured values.
        //
        setup();

        expect(screen.getAllByText('S&P 500').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Hive').length).toBe(5);
        expect(screen.getAllByText('n/a').length).toBeGreaterThan(0);
    });

    it('survives an outright network rejection', () => {
        const original = global.fetch;
        global.fetch = () => Promise.reject(new Error('offline'));

        expect(() => setup()).not.toThrow();
        expect(screen.getByText('SEC Filings')).toBeInTheDocument();

        global.fetch = original;
    });

    it('does not construct a Worker on mount', () => {
        //
        // the workers are created when a distribution is actually requested, not at
        // mount. Worth pinning: setup.js stubs Worker, so a component that built one
        // eagerly would silently get a no-op rather than failing, and the reason
        // nothing rendered would be hard to find.
        //
        const RealWorker = global.Worker;
        const built = jest.fn();
        global.Worker = class extends RealWorker {
            constructor(...args) { super(...args); built(); }
        };

        setup();

        expect(built).not.toHaveBeenCalled();

        global.Worker = RealWorker;
    });
});

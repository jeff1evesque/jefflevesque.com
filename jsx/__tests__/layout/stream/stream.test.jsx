/**
 * stream.test.jsx: the stream listing layout.
 *
 * 1461 lines and 37 imports, so this does not attempt line coverage. What it
 * covers is the contract a visitor actually sees: which streams are listed, under
 * which labels, what each row shows before any data has arrived, and which rate
 * options are offered.
 *
 * The labels are the valuable part. They come from stream-name.js, which is unit
 * tested separately -- this is what proves the component actually routes its ids
 * through it rather than rendering raw ids like 'StockMarketStockSplit'. The two
 * are otherwise free to drift.
 *
 * Note: no network is mocked here. setup.js provides a fetch that resolves to a
 *       not-ok response, and every loader in this codebase logs and carries on, so
 *       this is the genuine "before any data arrives" state rather than a
 *       contrived one.
 *
 * Note: the component is not redux-connected -- redux/container/stream/stream.jsx
 *       wraps it -- so it renders standalone with no Provider.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import StreamLayout from '../../../import/layout/stream/stream.jsx';

function setup(props = {}) {
    return render(
        <MemoryRouter>
            <StreamLayout {...props} />
        </MemoryRouter>
    );
}

function bodyText() {
    return document.body.textContent.replace(/\s+/g, ' ');
}

describe('the stream listing', () => {
    it('lists all five streams', () => {
        setup();

        expect(bodyText()).toContain('Streams');
        expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('renders each stream under its display label, not its id', () => {
        //
        // the ids are 'StockMarket', 'StockMarketStockSplit', 'BLS', 'SEC' and
        // 'USNationalWeather'. Every one has to reach stream-name.js on the way to
        // the screen, or the listing shows raw identifiers.
        //
        setup();

        expect(screen.getByText('S&P 500')).toBeInTheDocument();
        expect(screen.getByText('Stock Splits')).toBeInTheDocument();
        expect(screen.getByText('Bureau of Labor Statistics')).toBeInTheDocument();
        expect(screen.getByText('SEC Filings')).toBeInTheDocument();
        expect(screen.getByText('US Weather Alerts')).toBeInTheDocument();
    });

    it('never leaks a raw stream id to the screen', () => {
        setup();

        const text = bodyText();
        expect(text).not.toContain('StockMarketStockSplit');
        expect(text).not.toContain('USNationalWeather');
        expect(text).not.toContain('stockmarketstocksplit');
    });

    it('distinguishes the two stock streams', () => {
        //
        // they sit adjacent in the listing and differ only in scope, which is the
        // whole reason stream-name.js matches on the WHOLE id rather than a prefix.
        // A prefix match would label the split feed 'S&P 500'.
        //
        setup();

        expect(screen.getByText('S&P 500')).toBeInTheDocument();
        expect(screen.getByText('Stock Splits')).toBeInTheDocument();
    });
});

describe('each row before data arrives', () => {
    it('shows a health, coverage, rate and total for every stream', () => {
        setup();

        const text = bodyText();
        expect(text).toContain('Health');
        expect(text).toContain('Coverage');
        expect(text).toContain('Rate');
        expect(text).toContain('Total Records');
    });

    it('shows n/a rather than a zero or a blank', () => {
        //
        // 'n/a' and 0 mean different things here: one is "not measured yet", the
        // other is "measured, and nothing arrived". Rendering 0 before the first
        // response would read as an outage.
        //
        setup();

        expect(screen.getAllByText('n/a').length).toBeGreaterThanOrEqual(5);
        expect(bodyText()).not.toContain('0%');
    });

    it('defaults every stream to the daily rate', () => {
        //
        // daily is the rate the page has always drawn, and the one every stream
        // supports -- minute coverage is only gradeable for stockmarket.
        //
        setup();

        expect(screen.getAllByText('Day').length).toBeGreaterThanOrEqual(5);
    });
});

describe('the rate selector', () => {
    it('offers exactly the rates the chart has windows for', () => {
        //
        // these mirror ROLLING_WINDOW in rolling-window.js, which carries minute,
        // hour, day and month -- and deliberately no per-second rate, since ingest
        // is not frequent enough for one to carry signal.
        //
        setup();

        const text = bodyText();
        expect(text).toContain('Monthly');
        expect(text).toContain('Daily');
        expect(text).toContain('Hourly');
        expect(text).toContain('Minutes');
    });

    it('offers no per-second rate', () => {
        setup();

        expect(bodyText()).not.toContain('Seconds');
    });
});

describe('the controls', () => {
    it('offers a filter and a sort', () => {
        setup();

        const text = bodyText();
        expect(text).toContain('Filter');
        expect(text).toContain('Sort');
    });

    it('renders interactive controls rather than static text', () => {
        setup();

        expect(document.querySelectorAll('button').length).toBeGreaterThan(0);
    });
});

describe('resilience', () => {
    it('mounts with no props at all', () => {
        //
        // the redux container supplies its props; a missing one must not stop the
        // listing rendering, since the shell is useful before any data loads.
        //
        expect(() => setup()).not.toThrow();
    });

    it('mounts when every request fails', () => {
        //
        // the default fetch in setup.js resolves not-ok, so this is the state after
        // a total api outage: the listing still renders, with n/a throughout.
        //
        setup();

        expect(screen.getByText('S&P 500')).toBeInTheDocument();
        expect(screen.getAllByText('n/a').length).toBeGreaterThan(0);
    });

    it('survives an outright network rejection', async () => {
        const original = global.fetch;
        global.fetch = () => Promise.reject(new Error('offline'));

        expect(() => setup()).not.toThrow();
        expect(screen.getByText('S&P 500')).toBeInTheDocument();

        global.fetch = original;
    });
});

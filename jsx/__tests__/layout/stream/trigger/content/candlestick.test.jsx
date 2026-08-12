/**
 * candlestick.test.jsx: the candlestick trigger's explanatory content.
 *
 * This is the half of the trigger page that is not the chart: the terms notice, the
 * window description, the reference table of patterns, and the four workflow
 * diagrams. It is static prose, so what is worth testing is not the wording but the
 * component's own logic -- the prop fallbacks it applies before rendering any of it,
 * and the two things that make it different from its three siblings in this folder:
 * it carries breadcrumbs, and it carries the pattern table.
 *
 * The table is the part with real consequences. Its fourteen rows are the same
 * fourteen patterns the api reports and the featured carousel links to, so it is a
 * user-facing copy of a list maintained in three other places.
 *
 * Note: 'react-device-detect' is mocked behind a getter, so a single describe can
 *       flip to the mobile layout. isMobile is a module constant evaluated at import
 *       -- without the getter, a test cannot reach the mobile branch at all.
 *
 * Note: the component is not redux-connected, but SummaryTrigger and the login link
 *       inside NoticeTerms use react-router, so it needs a router.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

let mockMobile = false;

jest.mock('react-device-detect', () => ({
    get isMobile() { return mockMobile; },
}));

import Candlestick from '../../../../../import/layout/stream/trigger/content/candlestick.jsx';

beforeEach(() => {
    mockMobile = false;
});

function setup(props = {}) {
    return render(
        <MemoryRouter>
            <Candlestick stream='stock-market' {...props} />
        </MemoryRouter>
    );
}

function bodyText() {
    return document.body.textContent.replace(/\s+/g, ' ');
}

describe('the heading', () => {
    it('names the trigger, defaulting to Candlestick', () => {
        setup();

        expect(screen.getByRole('heading', { name: 'Candlestick' })).toBeInTheDocument();
    });

    it('uses the title it was given', () => {
        //
        // trigger.jsx passes its own listing_graphic_title so the page heading and
        // the left column's filter header stay in step.
        //
        setup({ listing_graphic_title: 'Chart Patterns' });

        expect(screen.getByRole('heading', { name: 'Chart Patterns' })).toBeInTheDocument();
    });

    it('falls back when the title is empty rather than heading a blank page', () => {
        setup({ listing_graphic_title: '' });

        expect(screen.getByRole('heading', { name: 'Candlestick' })).toBeInTheDocument();
    });

    it('renders breadcrumbs, alone among the trigger contents', () => {
        //
        // stock-split, article-ingest and us-national-weather render none. Worth
        // pinning because it is the sort of asymmetry that gets "tidied" into
        // consistency without anyone deciding to.
        //
        setup();

        expect(document.querySelector('[aria-label="breadcrumb"]')).not.toBeNull();
    });
});

describe('the terms notice', () => {
    it('states that subscribing needs a login', () => {
        setup();

        expect(bodyText()).toContain('You need to login to subscribe');
    });

    it('lowercases the trigger name inside the sentence', () => {
        //
        // the title is a heading ('Candlestick') and mid-sentence prose
        // ('individual candlestick triggers') at once, so it is cased twice from one
        // prop.
        //
        setup({ listing_graphic_title: 'Chart Patterns' });

        expect(bodyText()).toContain('individual chart patterns triggers');
    });
});

describe('the window summary', () => {
    it('names the stream it was handed', () => {
        setup({ stream: 'stock-market' });

        expect(bodyText()).toContain('The stock-market ingest stream runs');
    });

    it('names the stock-market stream when none is supplied', () => {
        //
        // FIXED. The fallback was null, interpolated straight into the sentence: the
        // page read 'The null ingest stream runs between 9:30am...'. trigger.jsx
        // always passes the prop, which is why it was never seen.
        //
        // 'stock-market' rather than an empty string, because this content describes
        // that stream and nothing else -- its trading hours and its grouping by
        // ticker are written into the copy.
        //
        render(<MemoryRouter><Candlestick /></MemoryRouter>);

        const text = bodyText();
        expect(text).toContain('The stock-market ingest stream runs');
        expect(text).not.toContain('null');
    });

    it('describes the trading hours and the sliding window', () => {
        //
        // this is the one stream with an intraday schedule -- the other three ingest
        // on a fixed interval -- and the 5-minute/1-minute cadence is what makes the
        // minute rate on the chart meaningful.
        //
        setup();

        const text = bodyText();
        expect(text).toContain('9:30am through 4:30pm EDT');
        expect(text).toContain('5 minute windows sliding every minute');
    });

    it('draws the sliding-window graphic inline on desktop', () => {
        setup();

        expect(bodyText()).toContain('Sliding window having a fixed window size');
        expect(screen.queryByText('Sliding Window')).not.toBeInTheDocument();
    });
});

describe('on mobile', () => {
    it('moves the window graphic into an accordion', () => {
        //
        // the graphic is wide, so on a phone it is collapsed behind a titled panel
        // instead of being rendered beside the prose.
        //
        mockMobile = true;
        setup();

        expect(screen.getByText('Sliding Window')).toBeInTheDocument();
    });

    it('keeps the terms notice, shortened', () => {
        mockMobile = true;
        setup();

        expect(bodyText()).toContain('Login to subscribe');
    });
});

describe('the pattern table', () => {
    it('lists the patterns ten at a time, of fourteen', () => {
        //
        // fourteen is the count that has to agree with the api's pattern list, the
        // featured carousel, and the zero fill in get_filtered_data/candlestick.js.
        //
        setup();

        expect(bodyText()).toContain('1–10 of 14');
    });

    it('labels the columns', () => {
        setup();

        const header = document.querySelector('thead');
        expect(within(header).getByText('Pattern')).toBeInTheDocument();
        expect(within(header).getByText('Type')).toBeInTheDocument();
        expect(within(header).getByText('Strength')).toBeInTheDocument();
        expect(within(header).getByText('# Candle')).toBeInTheDocument();
    });

    it('describes each pattern by direction, strength and candle count', () => {
        setup();

        const row = screen.getByText('Morning Doji Star').closest('tr');
        expect(within(row).getByText('Bullish')).toBeInTheDocument();
        expect(within(row).getByText('Strong')).toBeInTheDocument();
        expect(within(row).getByText('3')).toBeInTheDocument();
    });

    it('holds the remaining patterns on the next page', async () => {
        setup();

        expect(screen.queryByText('Evening Star')).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: /next page/i }));

        expect(screen.getByText('Evening Star')).toBeInTheDocument();
        expect(bodyText()).toContain('11–14 of 14');
    });

    it('accepts a table supplied by the caller', () => {
        setup({
            trigger_candlestick_table: [
                { pattern: 'Marubozu', type: 'Bullish', strength: 'Strong', num_candle: 1 },
            ],
        });

        expect(screen.getByText('Marubozu')).toBeInTheDocument();
        expect(screen.queryByText('Inverted Hammer')).not.toBeInTheDocument();
    });

    it('ignores an empty table rather than rendering an empty reference', () => {
        //
        // an empty array is what a caller passes while its own data is still loading;
        // the reference table is static, so the default is always the better answer.
        //
        setup({ trigger_candlestick_table: [] });

        expect(screen.getByText('Inverted Hammer')).toBeInTheDocument();
    });

    it('accepts column labels supplied by the caller', () => {
        setup({
            trigger_candlestick_table_labels: [
                { id: 'pattern', label: 'Formation', minWidth: 170, align: 'right' },
            ],
        });

        expect(screen.getByText('Formation')).toBeInTheDocument();
        expect(screen.queryByText('Strength')).not.toBeInTheDocument();
    });
});

describe('the workflow accordions', () => {
    it('offers all four integration paths', () => {
        //
        // these four are what a subscription can be wired into, and the same four are
        // repeated by every other trigger content -- so a change here is a change to
        // the product's advertised surface, not to one page's copy.
        //
        setup();

        expect(screen.getByText('Basic Workflow')).toBeInTheDocument();
        expect(screen.getByText('Basic Model Workflow')).toBeInTheDocument();
        expect(screen.getByText('Aggregate Workflow')).toBeInTheDocument();
        expect(screen.getByText('Aggregate Model Workflow')).toBeInTheDocument();
    });

    it('explains what the candlestick trigger actually does', () => {
        setup();

        expect(bodyText()).toContain('You select any combination of stock-tickers');
    });
});

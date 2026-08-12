/**
 * stock-split.test.jsx: the stock-split trigger's explanatory content.
 *
 * The simplest of the four contents: no table, no breadcrumbs, and a tumbling window
 * rather than a sliding one. Its whole behaviour is the four prop fallbacks in its
 * constructor and the graphic it configures from them, so that is what is covered
 * here.
 *
 * trigger.jsx renders this one with NO props at all, so the defaults asserted below
 * are not a fallback path -- they are the only thing the page has ever shown.
 *
 * Note: the tumbling graphic reports itself through the window labels ('4day',
 *       '3day', ...) and through which of the two purple markers is drawn, so
 *       x_unit and late_arrival are checked there rather than by prop inspection.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let mockMobile = false;

jest.mock('react-device-detect', () => ({
    get isMobile() { return mockMobile; },
}));

import StockSplit from '../../../../../import/layout/stream/trigger/content/stock-split.jsx';

beforeEach(() => {
    mockMobile = false;
});

function setup(props = {}) {
    return render(
        <MemoryRouter>
            <StockSplit {...props} />
        </MemoryRouter>
    );
}

function bodyText() {
    return document.body.textContent.replace(/\s+/g, ' ');
}

describe('the defaults trigger.jsx relies on', () => {
    it('titles itself StockSplit', () => {
        //
        // trigger.jsx renders '<StockSplit />' bare, so every default in the
        // constructor is production behaviour rather than a safety net.
        //
        setup();

        expect(screen.getByText('StockSplit')).toBeInTheDocument();
    });

    it('describes a daily weekday ingest', () => {
        setup();

        expect(bodyText()).toContain('The StockSplit ingest stream runs daily at 12am EDT (M-F)');
    });

    it('scales the window graphic in days', () => {
        setup();

        expect(bodyText()).toContain('4day');
        expect(bodyText()).toContain('1day');
    });

    it('draws no late-arrival marker', () => {
        //
        // '#Purple2' is the extra dot the graphic drops into the PREVIOUS window to
        // show a record that missed its own. Absent by default, which is what makes
        // the default graphic describe the ordinary case.
        //
        // (the on-time position, '#Purple1', is a poor thing to assert on: one is
        // drawn unconditionally further along the same svg, so it is present either
        // way.)
        //
        setup();

        expect(document.querySelector('#Purple2')).toBeNull();
    });
});

describe('the props it accepts', () => {
    it('takes a title, and lowercases it in the notice', () => {
        setup({ listing_graphic_title: 'Share Splits' });

        expect(screen.getByText('Share Splits')).toBeInTheDocument();
        expect(bodyText()).toContain('individual share splits triggers');
    });

    it('falls back on an empty title', () => {
        setup({ listing_graphic_title: '' });

        expect(screen.getByText('StockSplit')).toBeInTheDocument();
    });

    it('takes an ingest interval', () => {
        setup({ ingest_interval: 'every 4 hours' });

        expect(bodyText()).toContain('ingest stream runs every 4 hours');
    });

    it('takes a window unit', () => {
        //
        // this works here, and does NOT work in article-ingest.jsx or
        // us-national-weather.jsx -- see the x_increment test in either of those.
        //
        setup({ x_unit: 'week' });

        expect(bodyText()).toContain('4week');
        expect(bodyText()).not.toContain('4day');
    });

    it('takes late arrival, which adds the missed-window marker', () => {
        setup({ late_arrival: true });

        expect(document.querySelector('#Purple2')).not.toBeNull();
    });
});

describe('the content itself', () => {
    it('requires a login before subscribing', () => {
        setup();

        expect(bodyText()).toContain('You need to login to subscribe');
    });

    it('explains what a split is, in both directions', () => {
        //
        // a reverse split is the case a reader is most likely to get backwards, so
        // the copy carries both ratios.
        //
        setup();

        const text = bodyText();
        expect(text).toContain('2-for-1');
        expect(text).toContain('1-for-2');
    });

    it('describes tumbling windows as non-overlapping', () => {
        //
        // the distinction from the candlestick trigger's SLIDING window is the whole
        // reason a reader is shown a graphic at all.
        //
        setup();

        expect(bodyText()).toContain('Records cannot overlap between windows');
    });

    it('carries no pattern table, unlike the candlestick content', () => {
        setup();

        expect(bodyText()).not.toContain('Rows per page');
    });

    it('offers all four integration paths', () => {
        setup();

        expect(screen.getByText('Basic Workflow')).toBeInTheDocument();
        expect(screen.getByText('Basic Model Workflow')).toBeInTheDocument();
        expect(screen.getByText('Aggregate Workflow')).toBeInTheDocument();
        expect(screen.getByText('Aggregate Model Workflow')).toBeInTheDocument();
    });
});

describe('on mobile', () => {
    it('moves the window graphic into an accordion', () => {
        mockMobile = true;
        setup();

        expect(screen.getByText('Tumbling Window')).toBeInTheDocument();
    });

    it('does not also render it inline', () => {
        //
        // the mobile branch passes the SAME element into the accordion as the desktop
        // one renders beside the prose, so a mistake here draws the graphic twice.
        // The window labels are unique to the graphic, so counting one of them counts
        // the graphics.
        //
        mockMobile = true;
        setup();

        expect(bodyText().match(/4day/g)).toHaveLength(1);
    });
});

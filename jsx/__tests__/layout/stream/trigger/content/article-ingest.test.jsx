/**
 * article-ingest.test.jsx: the BLS and SEC trigger content.
 *
 * One component serves both article streams -- trigger.jsx renders it with
 * listing_graphic_title 'BLS' or 'SEC' and a matching source_name -- so everything
 * stream-specific on those two pages arrives as a prop. That makes the prop
 * handling, rather than the prose, the thing worth covering.
 *
 * It also carries a live defect in that prop handling: the x_increment fallback
 * assigns to the wrong variable and silently discards x_unit. See 'the x_increment
 * fallback' below.
 *
 * Note: 'react-device-detect' is mocked behind a getter so the mobile branch is
 *       reachable; isMobile is otherwise fixed at import.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let mockMobile = false;

jest.mock('react-device-detect', () => ({
    get isMobile() { return mockMobile; },
}));

import ArticleIngest from '../../../../../import/layout/stream/trigger/content/article-ingest.jsx';

//
// what trigger.jsx passes for the BLS stream; SEC differs only in the two strings.
//
const BLS = {
    listing_graphic_title: 'BLS',
    source_name: 'the U.S. Bureau of Labor Statistics (BLS)',
    x_unit: 'hour',
    x_increment: 1,
    ingest_interval: 'every 1 hour',
};

beforeEach(() => {
    mockMobile = false;
});

function setup(props = {}) {
    return render(
        <MemoryRouter>
            <ArticleIngest {...props} />
        </MemoryRouter>
    );
}

function bodyText() {
    return document.body.textContent.replace(/\s+/g, ' ');
}

describe('as trigger.jsx configures it', () => {
    it('titles the page with the stream it was given', () => {
        setup(BLS);

        expect(screen.getByText('BLS')).toBeInTheDocument();
    });

    it('names the source in the summary', () => {
        //
        // this is the only place a reader learns whose filings the stream carries,
        // and it is the one string that distinguishes the BLS page from the SEC one.
        //
        setup(BLS);

        expect(bodyText()).toContain('captures articles, journals, filings, and alerts from the U.S. Bureau of Labor Statistics (BLS)');
    });

    it('serves a second stream from the same component', () => {
        setup({ ...BLS, listing_graphic_title: 'SEC', source_name: 'the U.S. Securities and Exchange Commission (SEC)' });

        expect(screen.getByText('SEC')).toBeInTheDocument();
        expect(bodyText()).toContain('Exchange Commission (SEC)');
        expect(bodyText()).not.toContain('Bureau of Labor');
    });

    it('states the ingest interval in both the summary and the integration copy', () => {
        //
        // the interval is interpolated three times from one prop; a reader comparing
        // the two sections would notice them disagreeing.
        //
        setup(BLS);

        const text = bodyText();
        expect(text).toContain('ingest stream runs every 1 hour');
        expect(text).toContain('batched every 1 hour, then stored to our datalake');
        expect(text).toContain('stream every 1 hour every day');
    });

    it('scales the window graphic to the interval', () => {
        setup(BLS);

        expect(bodyText()).toContain('4hour');
        expect(bodyText()).toContain('1hour');
    });
});

describe('the defaults', () => {
    it('titles itself Article Ingest', () => {
        setup();

        expect(screen.getByText('Article Ingest')).toBeInTheDocument();
    });

    it('describes the source vaguely rather than naming one', () => {
        setup();

        expect(bodyText()).toContain('from our configured sources');
    });

    it('assumes a daily weekday ingest', () => {
        setup();

        expect(bodyText()).toContain('ingest stream runs daily at 12am EDT (M-F)');
    });

    it('falls back on an empty title or source', () => {
        setup({ listing_graphic_title: '', source_name: '' });

        expect(screen.getByText('Article Ingest')).toBeInTheDocument();
        expect(bodyText()).toContain('our configured sources');
    });

    it('lowercases the title inside the notice', () => {
        setup(BLS);

        expect(bodyText()).toContain('individual bls triggers');
    });
});

describe('the x_increment fallback', () => {
    it('keeps x_unit when x_increment is absent', () => {
        //
        // FIXED. The else branch of the x_increment check read:
        //
        //     var x_unit = 10;
        //
        // -- assigning to x_unit, not x_increment, and 'var' made that the SAME
        // binding the x_unit check had just filled in. Omitting x_increment
        // overwrote the caller's unit with the number 10, which the graphic rejects
        // as a non-string and replaces with its own default of 'min', so an hourly
        // stream drew a minute axis. trigger.jsx always passes both, which is why it
        // was never seen.
        //
        setup({ x_unit: 'hour' });

        expect(bodyText()).toContain('hour');
        expect(bodyText()).not.toContain('4min');
    });

    it('defaults the increment to ten, not the unit', () => {
        //
        // ten was always the intended fallback increment; it just landed in the wrong
        // variable. With a unit given and no increment, the axis now counts in tens
        // of that unit.
        //
        setup({ x_unit: 'hour' });

        expect(bodyText()).toContain('10hour');
        expect(bodyText()).toContain('40hour');
    });

    it('honours x_unit once x_increment is supplied', () => {
        setup({ x_unit: 'hour', x_increment: 1 });

        expect(bodyText()).toContain('4hour');
    });

    it('multiplies the increment across the four windows', () => {
        //
        // the graphic labels windows at 1x, 2x, 3x and 4x the increment, so the
        // increment is what makes the axis read as a real interval.
        //
        setup({ x_unit: 'hour', x_increment: 6 });

        const text = bodyText();
        expect(text).toContain('6hour');
        expect(text).toContain('12hour');
        expect(text).toContain('18hour');
        expect(text).toContain('24hour');
    });
});

describe('the window markers', () => {
    it('draws none of the optional markers by default', () => {
        //
        // each flag adds one dot to the graphic: '#Purple4' and '#Green3' to the
        // first window, '#Blue2' to the second. All three default off, so the plain
        // graphic shows the bare tumbling sequence.
        //
        setup(BLS);

        expect(document.querySelector('#Purple4')).toBeNull();
        expect(document.querySelector('#Green3')).toBeNull();
        expect(document.querySelector('#Blue2')).toBeNull();
    });

    it('adds the first-window markers when asked', () => {
        setup({ ...BLS, window_1_purple: true, window_1_green: true });

        expect(document.querySelector('#Purple4')).not.toBeNull();
        expect(document.querySelector('#Green3')).not.toBeNull();
    });

    it('adds the second-window marker when asked', () => {
        setup({ ...BLS, window_2_blue: true });

        expect(document.querySelector('#Blue2')).not.toBeNull();
    });

    it('reads window_2_blue, the name trigger.jsx now passes', () => {
        //
        // trigger.jsx used to render this component with 'window_1_blue={false}'. No
        // such prop exists -- the component reads 'window_2_blue' -- so the value was
        // dropped on the floor. Harmless only because the passed value and the
        // default were both false, which is why it survived; the call site has been
        // corrected, and a name this component does not read is still inert.
        //
        setup({ ...BLS, window_1_blue: true });

        expect(document.querySelector('#Blue2')).toBeNull();
    });

    it('takes late arrival', () => {
        setup({ ...BLS, late_arrival: true });

        expect(document.querySelector('#Purple2')).not.toBeNull();
    });
});

describe('the content itself', () => {
    it('requires a login before subscribing', () => {
        setup(BLS);

        expect(bodyText()).toContain('You need to login to subscribe');
    });

    it('describes a tumbling window, not a sliding one', () => {
        //
        // article ingest batches on a fixed interval, so its windows cannot overlap;
        // the candlestick trigger is the only sliding one.
        //
        setup(BLS);

        const text = bodyText();
        expect(text).toContain('Records cannot overlap between windows');
        expect(text).not.toContain('Sliding window');
    });

    it('points at NLP over the title or summary', () => {
        setup(BLS);

        expect(bodyText()).toContain('You select either the title or summary and perform NLP analysis');
    });

    it('offers all four integration paths', () => {
        setup(BLS);

        expect(screen.getByText('Basic Workflow')).toBeInTheDocument();
        expect(screen.getByText('Basic Model Workflow')).toBeInTheDocument();
        expect(screen.getByText('Aggregate Workflow')).toBeInTheDocument();
        expect(screen.getByText('Aggregate Model Workflow')).toBeInTheDocument();
    });

    it('carries no pattern table', () => {
        setup(BLS);

        expect(bodyText()).not.toContain('Rows per page');
    });
});

describe('on mobile', () => {
    it('moves the window graphic into an accordion', () => {
        mockMobile = true;
        setup(BLS);

        expect(screen.getByText('Tumbling Window')).toBeInTheDocument();
    });

    it('renders the graphic once, not twice', () => {
        mockMobile = true;
        setup(BLS);

        expect(bodyText().match(/4hour/g)).toHaveLength(1);
    });
});

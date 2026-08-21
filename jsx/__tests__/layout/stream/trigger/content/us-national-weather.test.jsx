/**
 * us-national-weather.test.jsx: the weather-alert trigger content.
 *
 * Structurally a twin of article-ingest.jsx -- same tumbling window, same four
 * workflow panels, same constructor shape including the same x_increment defect --
 * but it serves one stream rather than two, and its copy is about alert attributes
 * rather than documents.
 *
 * What is covered here is what trigger.jsx actually renders (a five-minute cadence,
 * passed as three separate props that have to agree), and the prop fallbacks that
 * decide what happens when they do not.
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

import USNationalWeather from '../../../../../import/layout/stream/trigger/content/us-national-weather.jsx';

//
// exactly what trigger.jsx passes for the usnationalweather stream.
//
const WEATHER = {
    x_unit: 'min',
    x_increment: 5,
    ingest_interval: 'every 5 minutes',
    window_1_purple: false,
    window_1_green: false,
};

beforeEach(() => {
    mockMobile = false;
});

function setup(props = {}) {
    return render(
        <MemoryRouter>
            <USNationalWeather {...props} />
        </MemoryRouter>
    );
}

function bodyText() {
    return document.body.textContent.replace(/\s+/g, ' ');
}

describe('as trigger.jsx configures it', () => {
    it('titles the page for the weather service', () => {
        setup(WEATHER);

        expect(screen.getByText('US National Weather')).toBeInTheDocument();
    });

    it('states the five-minute cadence in the prose', () => {
        setup(WEATHER);

        const text = bodyText();
        expect(text).toContain('ingest stream runs every 5 minutes');
        expect(text).toContain('batched every 5 minutes');
    });

    it('scales the window graphic to the same five minutes', () => {
        //
        // the cadence reaches the page twice by different routes -- as prose through
        // ingest_interval, and as an axis through x_unit/x_increment -- so nothing
        // but a test keeps the sentence and the picture agreeing.
        //
        setup(WEATHER);

        const text = bodyText();
        expect(text).toContain('5min');
        expect(text).toContain('20min');
    });

    it('explains that alerts are captured as the service issues them', () => {
        setup(WEATHER);

        expect(bodyText()).toContain('Whenever the US National Weather Service issues a service alert');
    });

    it('lists the alert attributes a subscription can key on', () => {
        //
        // these are the fields the trigger form offers; the copy is the only place a
        // reader is told what can be filtered before signing in.
        //
        setup(WEATHER);

        const text = bodyText();
        expect(text).toContain('urgency, severity, certainty');
        expect(text).toContain('polygon (if provided), geocode, published date');
    });
});

describe('the defaults', () => {
    it('titles itself US National Weather', () => {
        setup();

        expect(screen.getByText('US National Weather')).toBeInTheDocument();
    });

    it('assumes a daily weekday ingest', () => {
        setup();

        expect(bodyText()).toContain('ingest stream runs daily at 12am EDT (M-F)');
    });

    it('falls back on an empty title', () => {
        setup({ listing_graphic_title: '' });

        expect(screen.getByText('US National Weather')).toBeInTheDocument();
    });

    it('takes a title when one is given', () => {
        //
        // trigger.jsx does not pass one today, so this is the path that would carry a
        // rename of the stream.
        //
        setup({ ...WEATHER, listing_graphic_title: 'NWS Alerts' });

        expect(screen.getByText('NWS Alerts')).toBeInTheDocument();
        expect(bodyText()).toContain('The NWS Alerts ingest stream runs');
    });

    it('draws the optional window markers only when asked', () => {
        //
        // trigger.jsx passes window_1_purple and window_1_green as false, which is
        // what the assertions below show; window_2_blue it never passes at all.
        //
        const { unmount } = setup(WEATHER);
        expect(document.querySelector('#Purple4')).toBeNull();
        expect(document.querySelector('#Green3')).toBeNull();
        expect(document.querySelector('#Blue2')).toBeNull();
        unmount();

        setup({ ...WEATHER, window_1_purple: true, window_2_blue: true });
        expect(document.querySelector('#Purple4')).not.toBeNull();
        expect(document.querySelector('#Blue2')).not.toBeNull();
    });

    it('lowercases the title inside the notice', () => {
        setup(WEATHER);

        expect(bodyText()).toContain('individual us national weather triggers');
    });

    it('draws no late-arrival marker', () => {
        //
        // '#Purple2' is the dot the graphic drops into the previous window for a
        // record that missed its own. Weather alerts are captured as they are issued,
        // so the default graphic shows none.
        //
        setup(WEATHER);

        expect(document.querySelector('#Purple2')).toBeNull();
    });

    it('takes late arrival when asked', () => {
        setup({ ...WEATHER, late_arrival: true });

        expect(document.querySelector('#Purple2')).not.toBeNull();
    });
});

describe('the x_increment fallback', () => {
    it('keeps x_unit when x_increment is absent', () => {
        //
        // the same fix as article-ingest.jsx: the else branch assigned
        // 'var x_unit = 10' where it meant x_increment, and var made that the same
        // binding, so the caller's unit was overwritten with a number the graphic
        // rejects. It fell back to 'min', which happens to be this stream's real
        // unit -- so here the fault was invisible even when it fired.
        //
        setup({ x_unit: 'hour' });

        expect(bodyText()).toContain('5hour');
        expect(bodyText()).not.toContain('4min');
    });

    it('honours x_unit once x_increment is supplied', () => {
        setup({ x_unit: 'hour', x_increment: 1 });

        expect(bodyText()).toContain('4hour');
    });
});

describe('the content itself', () => {
    it('requires a login before subscribing', () => {
        setup(WEATHER);

        expect(bodyText()).toContain('You need to login to subscribe');
    });

    it('describes a tumbling window, not a sliding one', () => {
        setup(WEATHER);

        const text = bodyText();
        expect(text).toContain('Records cannot overlap between windows');
        expect(text).not.toContain('Sliding window');
    });

    it('offers all four integration paths', () => {
        setup(WEATHER);

        expect(screen.getByText('Basic Workflow')).toBeInTheDocument();
        expect(screen.getByText('Basic Model Workflow')).toBeInTheDocument();
        expect(screen.getByText('Aggregate Workflow')).toBeInTheDocument();
        expect(screen.getByText('Aggregate Model Workflow')).toBeInTheDocument();
    });

    it('carries no pattern table', () => {
        setup(WEATHER);

        expect(bodyText()).not.toContain('Rows per page');
    });
});

describe('on mobile', () => {
    it('moves the window graphic into an accordion', () => {
        mockMobile = true;
        setup(WEATHER);

        expect(screen.getByText('Tumbling Window')).toBeInTheDocument();
    });

    it('renders the graphic once, not twice', () => {
        mockMobile = true;
        setup(WEATHER);

        expect(bodyText().match(/20min/g)).toHaveLength(1);
    });
});

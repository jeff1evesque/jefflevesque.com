/**
 * stock-market.test.jsx: the featured candlestick carousel.
 *
 * A card per candlestick pattern, each linking into the trigger page with that
 * pattern preselected. Two things here are worth more than the layout:
 *
 *   - the fourteen patterns are a fourth copy of a list that also lives in the api,
 *     in get_filtered_data/candlestick.js, and in the reference table on the trigger
 *     content. This file asserts the carousel's slugs against that list, so a card
 *     added here with a name the pipeline does not use is caught rather than
 *     shipping a link that preselects nothing.
 *
 *   - the link is the component's entire purpose. Its query string is assembled from
 *     the card title by lowercasing and replacing spaces, which is exactly the sort
 *     of derivation that goes wrong quietly -- 'Dark Cover Cloud' is already
 *     mis-titled relative to its slug.
 *
 * Note: 'react-device-detect' is mocked behind a getter, since the dots control is
 *       suppressed on mobile only.
 *
 * Note: the cards are built in componentDidMount rather than in the constructor, so
 *       everything asserted here is post-mount state.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let mockMobile = false;

jest.mock('react-device-detect', () => ({
    get isMobile() { return mockMobile; },
}));

import StockMarketFeatured from '../../../../import/layout/stream/featured/stock-market.jsx';

//
// the fourteen series the api reports and get_filtered_data/candlestick.js zero
// fills. The carousel's links must resolve to these exact names.
//
const PATTERNS = [
    'inverted_hammer',
    'shooting_star',
    'hammer',
    'hanging_man',
    'piercing',
    'dark_cloud_cover',
    'morning_doji_star',
    'evening_doji_star',
    'bearish_engulfing',
    'bullish_engulfing',
    'dragonfly_doji',
    'gravestone_doji',
    'morning_star',
    'evening_star',
];

beforeEach(() => {
    mockMobile = false;
});

function setup() {
    return render(
        <MemoryRouter>
            <StockMarketFeatured />
        </MemoryRouter>
    );
}

function links() {
    return [...document.querySelectorAll('a')].map(a => a.getAttribute('href'));
}

function selectedFrom(href) {
    return new URLSearchParams(href.split('?')[1]).get('selected');
}

describe('the carousel', () => {
    it('is headed as featured triggers', () => {
        setup();

        expect(screen.getByText('Featured Triggers')).toBeInTheDocument();
    });

    it('counts the cards it is showing', () => {
        //
        // the count is rendered from the pattern list rather than typed in, so it
        // cannot drift from the number of cards.
        //
        setup();

        expect(screen.getByText('14')).toBeInTheDocument();
    });

    it('renders a card per pattern', () => {
        setup();

        expect(links()).toHaveLength(14);
    });
});

describe('each card', () => {
    it('names the pattern and what it signals', () => {
        setup();

        expect(screen.getByText('Inverted Hammer')).toBeInTheDocument();
        expect(screen.getByText('Evening Star')).toBeInTheDocument();
    });

    it('says how many candles form the pattern and after which trend', () => {
        //
        // this is the only thing on the card that helps a visitor choose, and it is
        // the same information the trigger page's table gives in columns.
        //
        setup();

        const text = document.body.textContent.replace(/\s+/g, ' ');
        expect(text).toContain('One candlestick pattern found after a downtrend.');
        expect(text).toContain('Three candlestick sequence found after a uptrend.');
    });

    it('offers a subscribe link', () => {
        setup();

        expect(screen.getAllByText('Subscribe')).toHaveLength(14);
    });

    it('draws the pattern rather than describing it alone', () => {
        //
        // each card's media is an svg diagram of the candles, which is what the
        // carousel is for -- the labels inside it come from the svg components.
        //
        setup();

        expect(document.querySelectorAll('svg').length).toBeGreaterThanOrEqual(14);
    });
});

describe('the subscribe links', () => {
    it('points at the stock market trigger page', () => {
        setup();

        links().forEach((href) => {
            expect(href.startsWith('/stream/stockmarket/trigger?')).toBe(true);
        });
    });

    it('preselects the candlestick category', () => {
        //
        // the trigger page reads both query parameters; without the category it does
        // not know which selector the 'selected' value belongs to.
        //
        setup();

        links().forEach((href) => {
            expect(href).toContain('category=candlestick');
        });
    });

    it('slugs the card title into the pattern the api reports', () => {
        //
        // lowercase, spaces to underscores. This is the join between a human title
        // and a column name, and nothing else validates it.
        //
        setup();

        const selected = links().map(selectedFrom);

        expect(selected).toContain('inverted_hammer');
        expect(selected).toContain('morning_doji_star');
        expect(selected).toContain('dark_cloud_cover');
    });

    it('names exactly the fourteen series the chart carries', () => {
        //
        // the contract with get_filtered_data/candlestick.js: a link naming anything
        // outside this set lands on the trigger page with a selection the chart has
        // no series for, and the page silently draws nothing.
        //
        setup();

        expect(links().map(selectedFrom).sort()).toEqual([...PATTERNS].sort());
    });

    it('links each pattern once', () => {
        setup();

        const selected = links().map(selectedFrom);
        expect(new Set(selected).size).toBe(selected.length);
    });

    it('derives the slug from the media title, not the heading', () => {
        //
        // the two disagree on one card: the heading reads 'Dark Cover Cloud' while
        // the pattern is 'dark cloud cover'. Slugging the heading would produce
        // 'dark_cover_cloud', which the api does not report -- so this is not a
        // stylistic detail, it is why the link still works.
        //
        setup();

        expect(screen.getByText('Dark Cover Cloud')).toBeInTheDocument();
        expect(links().map(selectedFrom)).toContain('dark_cloud_cover');
        expect(links().map(selectedFrom)).not.toContain('dark_cover_cloud');
    });
});

describe('the dots control', () => {
    it('is offered on desktop', () => {
        setup();

        expect(document.querySelector('.alice-carousel__dots')).not.toBeNull();
    });

    it('is suppressed on mobile, where fourteen dots do not fit', () => {
        //
        // the threshold is eight cards; fourteen is over it, so a phone gets the
        // carousel without a dot strip it could not usefully tap.
        //
        mockMobile = true;
        setup();

        expect(document.querySelector('.alice-carousel__dots')).toBeNull();
    });
});

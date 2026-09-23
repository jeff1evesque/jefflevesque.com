/**
 * canonical-stream.test.jsx: a url naming a stream by a name it used to go by,
 * replaced with the url naming it by its id.
 *
 * The site linked '/stream/StockMarket/alarm', '/stream?item=USNationalWeather'
 * and '/data?item=stockmarket', and those urls are in bookmarks. What is held
 * here is that each still reaches its page, at the url the site links now, with
 * everything else the url carried kept -- and that a url already naming its
 * stream by id, or naming no stream, is left as it is.
 *
 * Note: main-route.jsx wraps the four routes that name a stream in this, and
 *       page.test.jsx drives the old urls through that route table.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom';

import CanonicalStream, { canonicalLocation } from '../../import/route/canonical-stream.jsx';

const at = (pathname, search = '', hash = '') => ({ pathname, search, hash });

describe('canonicalLocation, for a stream named in the path', () => {
    it.each([
        ['/stream/StockMarket/alarm', 'StockMarket', '/stream/stock-market/alarm'],
        ['/stream/stockmarket/alarm', 'stockmarket', '/stream/stock-market/alarm'],
        ['/stream/StockMarketStockSplit/trigger', 'StockMarketStockSplit', '/stream/stock-split/trigger'],
        ['/stream/StockSplit/trigger', 'StockSplit', '/stream/stock-split/trigger'],
        ['/stream/USNationalWeather/alarm', 'USNationalWeather', '/stream/us-national-weather/alarm'],
        ['/stream/BLS/alarm', 'BLS', '/stream/bls/alarm'],
    ])('moves %s to %s', (pathname, stream, expected) => {
        expect(canonicalLocation(at(pathname), stream)).toEqual(at(expected));
    });

    it('keeps the query string and the hash', () => {
        //
        // the featured cards link the trigger page with the category and the
        // patterns in its query string, and the page reads both.
        //
        expect(canonicalLocation(
            at('/stream/stockmarket/trigger', '?category=candlestick&selected=hammer', '#chart'),
            'stockmarket'
        )).toEqual(at('/stream/stock-market/trigger', '?category=candlestick&selected=hammer', '#chart'));
    });

    it('leaves a url that already names its stream by id', () => {
        expect(canonicalLocation(at('/stream/stock-market/alarm'), 'stock-market')).toBeNull();
    });

    it('leaves a url naming no stream at all, for the page to answer', () => {
        expect(canonicalLocation(at('/stream/no-such-stream/alarm'), 'no-such-stream')).toBeNull();
    });

    it('reads past a segment that is not valid percent-encoding', () => {
        //
        // decodeURIComponent throws on one, and a url someone typed can carry
        // anything. The segment is compared as it is, and the stream's is still
        // found.
        //
        expect(canonicalLocation(at('/x/%zz/StockMarket'), 'StockMarket'))
            .toEqual(at('/x/%zz/stock-market'));
    });

    it('leaves the path alone when the stream is not one of its segments', () => {
        //
        // the route's own param always is. A caller handing this some other
        // name gets no rewritten path rather than a guess at one.
        //
        expect(canonicalLocation(at('/stream/other/alarm'), 'StockMarket')).toBeNull();
    });

    it('rewrites only the segment that is the stream', () => {
        //
        // the segment is found by its value, so a route whose other segments
        // happen to spell a stream's old name keeps them.
        //
        expect(canonicalLocation(at('/stream/bls/alarm'), 'bls')).toBeNull();
        expect(canonicalLocation(at('/stream/BLS/alarm'), 'BLS')).toEqual(at('/stream/bls/alarm'));
    });
});

describe('canonicalLocation, for a stream named by ?item=', () => {
    it.each([
        ['/stream', '?item=StockMarket&rate=Day', '?item=stock-market&rate=Day'],
        ['/stream', '?item=USNationalWeather&rate=Day', '?item=us-national-weather&rate=Day'],
        ['/stream', '?rate=Minute&item=StockMarketStockSplit', '?rate=Minute&item=stock-split'],
        ['/data', '?item=StockMarket', '?item=stock-market'],
        ['/data', '?item=usnationalweather', '?item=us-national-weather'],
    ])('moves %s%s to %s', (pathname, search, expected) => {
        expect(canonicalLocation(at(pathname, search))).toEqual(at(pathname, expected));
    });

    it.each([
        ['/stream', '?item=stock-market&rate=Day'],
        ['/stream', '?rate=Day'],
        ['/stream', ''],
        ['/data', '?item=no-such-stream'],
    ])('leaves %s%s as it is', (pathname, search) => {
        expect(canonicalLocation(at(pathname, search))).toBeNull();
    });
});

describe('CanonicalStream, on a route', () => {
    function renderAt(path, pattern, state) {
        const seen = {};

        const Page = () => {
            const location = useLocation();

            seen.location = location;
            seen.type = useNavigationType();
            return <div>the page</div>;
        };

        render(
            <MemoryRouter initialEntries={[state ? { pathname: path, state } : path]}>
                <Routes>
                    <Route path={pattern} element={<CanonicalStream><Page /></CanonicalStream>} />
                </Routes>
            </MemoryRouter>
        );

        return seen;
    }

    it('renders the page at a url that names its stream by id', () => {
        const seen = renderAt('/stream/stock-market/alarm', '/stream/:stream/alarm');

        expect(screen.getByText('the page')).toBeInTheDocument();
        expect(seen.location.pathname).toBe('/stream/stock-market/alarm');
        expect(seen.type).toBe('POP');
    });

    it('replaces an old url rather than adding one to the history', () => {
        //
        // 'back' from the new url should leave, not land on a url that sends
        // the reader forward again.
        //
        const seen = renderAt('/stream/StockMarket/alarm', '/stream/:stream/alarm');

        expect(seen.location.pathname).toBe('/stream/stock-market/alarm');
        expect(seen.type).toBe('REPLACE');
    });

    it('rewrites the ?item= of a route with no stream in its path', () => {
        const seen = renderAt('/stream?item=USNationalWeather&rate=Day', '/stream');

        expect(seen.location.search).toBe('?item=us-national-weather&rate=Day');
    });

    it('carries the location state along', () => {
        const seen = renderAt('/stream/StockMarket/alarm', '/stream/:stream/alarm', { from: 'somewhere' });

        expect(seen.location.state).toEqual({ from: 'somewhere' });
    });

    it('leaves the page to answer a url naming no stream', () => {
        const seen = renderAt('/stream/no-such-stream/alarm', '/stream/:stream/alarm');

        expect(screen.getByText('the page')).toBeInTheDocument();
        expect(seen.location.pathname).toBe('/stream/no-such-stream/alarm');
    });
});

/**
 * stream-item.test.jsx: '/stream/<id>', the address the alarm emails link a
 * stream by, sent to '/stream?item=<id>', where the site opens a stream on its
 * own (#214). It was the 404 page.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom';

import StreamItem, { streamItemLocation } from '../../import/route/stream-item.jsx';

const at = (pathname, search = '', hash = '') => ({ pathname, search, hash });

describe('streamItemLocation', () => {
    it.each([
        ['sec', '?item=sec'],
        ['sec-companyfacts', '?item=sec-companyfacts'],
        ['StockMarket', '?item=stock-market'],
        ['usnationalweather', '?item=us-national-weather'],
    ])('sends /stream/%s to /stream%s', (name, search) => {
        expect(streamItemLocation(at(`/stream/${name}`), name)).toEqual(at('/stream', search));
    });

    it('sends a name that is no stream\'s to every stream', () => {
        expect(streamItemLocation(at('/stream/nope'), 'nope')).toEqual(at('/stream'));
        expect(streamItemLocation(at('/stream/nope', '?item=sec&rate=hour'), 'nope'))
            .toEqual(at('/stream', '?rate=hour'));
    });

    it('keeps the rest of the address, and the stream the path names wins', () => {
        expect(streamItemLocation(at('/stream/sec', '?rate=hour&item=bls', '#top'), 'sec'))
            .toEqual(at('/stream', '?rate=hour&item=sec', '#top'));
    });
});

describe('StreamItem, on its route', () => {
    function renderAt(path, state) {
        const seen = {};

        const Page = () => {
            const location = useLocation();

            seen.location = location;
            seen.type = useNavigationType();
            return <div>every stream</div>;
        };

        render(
            <MemoryRouter initialEntries={[state ? { pathname: path, state } : path]}>
                <Routes>
                    <Route path='/stream' element={<Page />} />
                    <Route path='/stream/:stream' element={<StreamItem />} />
                </Routes>
            </MemoryRouter>
        );

        return seen;
    }

    it('opens the stream the email links, on its own', () => {
        const seen = renderAt('/stream/sec');

        expect(screen.getByText('every stream')).toBeInTheDocument();
        expect(seen.location.pathname).toBe('/stream');
        expect(seen.location.search).toBe('?item=sec');
    });

    it('opens one by a name it has gone by', () => {
        expect(renderAt('/stream/StockMarket').location.search).toBe('?item=stock-market');
    });

    it('opens every stream for a name that is no stream\'s', () => {
        const seen = renderAt('/stream/nope');

        expect(seen.location.pathname).toBe('/stream');
        expect(seen.location.search).toBe('');
    });

    it('replaces the address, so Back does not return to it', () => {
        expect(renderAt('/stream/sec').type).toBe('REPLACE');
    });

    it('carries the location state along', () => {
        expect(renderAt('/stream/sec', { from: 'an email' }).location.state).toEqual({ from: 'an email' });
    });
});

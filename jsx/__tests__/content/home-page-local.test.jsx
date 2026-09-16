/**
 * home-page-local.test.jsx: the front page as a LOCAL development build.
 *
 * home-page.test.jsx covers the deployed build, where is_local is false and every
 * loader is handed a url. This covers the other arm of the same three ternaries:
 * when the bundle was built for local development, getData is passed no url and
 * serves its own mock csv instead, because the artifacts it would otherwise fetch
 * fail CORS from localhost.
 *
 * Note: a separate file rather than more cases in home-page.test.jsx. is_local is a
 *       MODULE, mapped in by jest.config.js's moduleNameMapper, and jest.mock is
 *       hoisted to the top of whichever file declares it -- so flipping it would
 *       flip it for every test in that file, including the ones asserting that a
 *       url IS requested. __stubs__/is_local.js says as much: "a test that needs the
 *       other branch should mock this module itself rather than flipping the value
 *       here for everyone."
 *
 * Note: the graph api is deliberately NOT part of this. It is public and allows any
 *       origin, so the front page asks for the graph from a local build exactly as
 *       it does from a deployed one -- there is no is_local arm to cover.
 */

import React from 'react';
import { render, act } from '@testing-library/react';

jest.mock('../../is_local.js', () => ({
    __esModule: true,
    default: true,
}));

jest.mock('@aws-amplify/auth', () => ({
    __esModule: true,
    default: { currentSession: jest.fn().mockRejectedValue(new Error('no session')) },
}));

jest.mock('../../import/animation/graph-cluster.jsx', () => ({
    __esModule: true,
    default: () => <div data-testid='graph-cluster' />,
}));

jest.mock('../../import/general/article-listing.jsx', () => ({
    __esModule: true,
    default: () => <div data-testid='listing' />,
}));

jest.mock('../../import/general/get-data.js', () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve([])),
}));

jest.mock('../../import/general/get-graph-schema.js', () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('react-datepicker', () => ({
    __esModule: true,
    default: ({ onChange }) => (
        <button
            data-testid='date-picker'
            onClick={() => onChange(new Date('2026/09/10 12:00'))}
        >pick</button>
    ),
}));

import getData from '../../import/general/get-data.js';
import getGraphSchema from '../../import/general/get-graph-schema.js';
import HomePage from '../../import/content/home-page.jsx';

async function setup() {
    const held = React.createRef();

    await act(async () => {
        render(<HomePage ref={held} dispatchLayout={jest.fn()} />);
    });

    return { page: held.current };
}

beforeEach(() => {
    jest.clearAllMocks();
    getData.mockReturnValue(Promise.resolve([]));
    getGraphSchema.mockReturnValue(Promise.resolve(null));
});

describe('a bundle built for local development', () => {
    it('asks for the ticker and split lists with no url', async () => {
        //
        // getData serves its built-in mock csv when the url is null. Reaching for the
        // real artifact instead fails CORS from localhost, which reads as an empty page
        // rather than as an error.
        //
        await setup();

        const urls = getData.mock.calls.map(call => call[1]);

        expect(urls.length).toBeGreaterThan(0);
        urls.forEach(url => expect(url).toBeNull());
    });

    it('still asks for all three lists', async () => {
        //
        // the gate changes the url, not whether the request happens -- a local build
        // shows the same page, from local data.
        //
        await setup();

        const types = getData.mock.calls.map(call => call[0]);

        expect(types).toContain('ticker-nasdaq');
        expect(types).toContain('ticker-custom');
        expect(types).toContain('stock-split');
    });

    it('asks for the split list with no url when the date changes', async () => {
        //
        // componentDidUpdate repeats the same ternary rather than sharing it, so the
        // local arm has to be covered in both places.
        //
        const { page } = await setup();
        getData.mockClear();

        await act(async () => {
            page.setState({ dd: '11', mm: '09', yyyy: 2026 });
        });

        expect(getData).toHaveBeenCalled();
        expect(getData.mock.calls[0][0]).toBe('stock-split');
        expect(getData.mock.calls[0][1]).toBeNull();
    });

    it('still fetches the knowledge graph', async () => {
        //
        // the graph api is public and allows any origin, so unlike the csv artifacts it
        // is reachable from localhost and is not gated.
        //
        await setup();

        expect(getGraphSchema).toHaveBeenCalledTimes(1);
    });
});

/**
 * home-page.test.jsx: the front page.
 *
 * The page is the knowledge-graph backdrop and nothing else, so what is worth
 * testing is the one path it has: fetch the published schema, filter it to what
 * the animation can legibly carry, hand the result over -- and hand over nothing,
 * rather than a stand-in, when there is nothing to hand.
 *
 * The rest of this suite used to cover a second presentation reached by a pair of
 * checkboxes in the bottom right corner: a content filter that collapsed into a
 * Filter button on a phone, a date picker, and a ~90 line merge joining the day's
 * stock splits against two ticker lists. All of it went with the checkboxes -- the
 * listings it built are what /data and /stream do properly. The cases below that
 * assert those things are ABSENT are the residue of that: they are cheap, and they
 * are what makes a re-introduction loud rather than quiet.
 *
 * Note: GraphCluster is mocked as a probe that records what reached its `data`
 *       prop. It is a 47k d3 simulation with its own suite, and rendering it here
 *       would make every assertion below depend on it. A probe that dropped props
 *       would let the whole filtering path pass untested while still satisfying
 *       every 'is the animation on screen' assertion.
 *
 * Note: get-graph-schema.js is mocked. The real one reaches the network, and
 *       setup.js's default fetch stub answers not-ok -- so without this every test
 *       here would exercise the failure arm and setState after the act() had
 *       closed.
 */

import React from 'react';
import { render, act } from '@testing-library/react';

jest.mock('@aws-amplify/auth', () => ({
    __esModule: true,
    default: { currentSession: jest.fn().mockRejectedValue(new Error('no session')) },
}));

jest.mock('../../import/animation/graph-cluster.jsx', () => ({
    __esModule: true,
    default: ({ data }) => (
        <div
            data-testid='graph-cluster'
            data-types={data ? Object.keys(data.node_types).length : 'none'}
        />
    ),
}));

jest.mock('../../import/general/get-graph-schema.js', () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve(null)),
}));

import Auth from '@aws-amplify/auth';
import getGraphSchema from '../../import/general/get-graph-schema.js';
import HomePage from '../../import/content/home-page.jsx';
import { GRAPH_NODE_TYPES } from '../../import/animation/filter-schema.js';

//
// Note: async, and the render is awaited inside act(). componentDidMount fires the
//       schema fetch and setStates when it resolves -- which is AFTER a synchronous
//       test body, so React warns that the update was not wrapped in act() and
//       setup.js turns that warning into a failure. Awaiting an async act lets
//       those microtasks settle while the component is still inside it.
//
async function setup() {
    const held = React.createRef();
    const dispatchLayout = jest.fn();
    let utils;

    await act(async () => {
        utils = render(<HomePage ref={held} dispatchLayout={dispatchLayout} />);
    });

    return { ...utils, page: held.current, dispatchLayout };
}

beforeEach(() => {
    jest.clearAllMocks();
    getGraphSchema.mockReturnValue(Promise.resolve(null));
});

//
// a schema with `count` node types, named t0..tN with descending counts, and no
// edges. Used to watch the page's own filtering rather than to test the rule --
// filter-schema.test.js owns that.
//
function schemaOf(count) {
    const node_types = {};
    for (let i = 0; i < count; i++) {
        node_types[`t${i}`] = { count: count - i, category: 'entity' };
    }

    return { version: '1.3', node_types: node_types, edge_types: {} };
}

const clusterTypes = () => document
    .querySelector('[data-testid="graph-cluster"]')
    .getAttribute('data-types');

describe('what the front page shows', () => {
    it('shows the knowledge-graph animation', async () => {
        const { getByTestId } = await setup();

        expect(getByTestId('graph-cluster')).toBeTruthy();
    });

    it('renders the cluster and no other element', async () => {
        //
        // the page is the graph. Not the graph plus an empty row left behind by
        // the listings that used to sit in it.
        //
        const { container } = await setup();
        const page = container.querySelector('.home');

        expect(page.children).toHaveLength(1);
        expect(page.children[0].getAttribute('data-testid')).toBe('graph-cluster');
    });

    it('shows it unconditionally, rather than as one of two presentations', async () => {
        //
        // the animation used to be drawn only while 'display' was 'stock-market',
        // and a checkbox set that state to 'summary'. There is no such state now,
        // and nothing on the page can take the graph off it.
        //
        const { page } = await setup();

        expect(page.state).not.toHaveProperty('display');
        expect(page.setDisplay).toBeUndefined();
    });

    it('tells redux to switch to the analysis layout on mount', async () => {
        const { dispatchLayout } = await setup();

        expect(dispatchLayout).toHaveBeenCalledTimes(1);
        expect(dispatchLayout.mock.calls[0][0]).toMatchObject({ layout: 'analysis' });
    });
});

describe('what the front page no longer shows', () => {
    //
    // the presentation checkboxes and everything behind them. These assert an
    // absence, which is worth a test only because the absence is the change: the
    // listings were a worse copy of /data and /stream, behind a control that
    // named neither of them.
    //
    it('offers no presentation checkboxes', async () => {
        await setup();

        expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
        expect(document.body.textContent).not.toContain('StockMarket');
        expect(document.body.textContent).not.toContain('Summary');
    });

    it('draws no article listings', async () => {
        await setup();

        expect(document.querySelector('.article-stream')).toBeNull();
        expect(document.querySelector('.article-stock-split')).toBeNull();
    });

    it('offers no content filter', async () => {
        await setup();

        expect(document.querySelector('.checkbox-horizontal')).toBeNull();
        expect(document.querySelector('.checkbox-vertical')).toBeNull();
        expect(document.querySelector('.filter')).toBeNull();
        expect(document.querySelector('.apply-filter')).toBeNull();
    });

    it('keeps no state for a presentation it cannot show', async () => {
        //
        // state that nothing reads is state that gets read again later by mistake.
        //
        const { page } = await setup();

        //
        // both are read on the way into GraphCluster: the slice it draws, and the
        // palette it draws it in. The palette is built from the UNFILTERED schema
        // so this page and /graph paint a namespace the same colour -- see
        // buildPalette -- which is why it is kept here rather than derived from
        // 'graph_schema' below.
        //
        expect(Object.keys(page.state)).toEqual(['graph_schema', 'graph_palette']);
    });

    it('asks for no csv on mount', async () => {
        //
        // the ticker lists and the day's splits were fetched for the listings and
        // for nothing else. The graph api is the page's only request now.
        //
        const fetched = jest.spyOn(global, 'fetch');

        await setup();

        expect(fetched).not.toHaveBeenCalled();

        fetched.mockRestore();
    });
});

describe('the knowledge-graph backdrop', () => {
    //
    // the page fetches the published schema on mount, filters it to what the backdrop
    // can legibly carry, and hands the result to GraphCluster. Until that lands -- and
    // if it never does -- the cluster is given nothing and draws its gray field alone,
    // which is deliberate: a stand-in graph would be indistinguishable on screen from
    // the real one.
    //
    it('asks for the published schema on mount', async () => {
        await setup();

        expect(getGraphSchema).toHaveBeenCalledTimes(1);
    });

    it('hands the cluster nothing while the fetch is pending', async () => {
        //
        // never resolves, so the state under test is the one a visitor sees on every
        // cold load before the api answers.
        //
        getGraphSchema.mockReturnValue(new Promise(() => {}));

        await setup();

        expect(clusterTypes()).toBe('none');
    });

    it('hands the cluster nothing when the fetch fails', async () => {
        //
        // the helper resolves null for every failure -- rejected, non-ok, malformed --
        // so this is the whole failure surface as the page sees it.
        //
        getGraphSchema.mockReturnValue(Promise.resolve(null));

        await setup();

        expect(clusterTypes()).toBe('none');
    });

    it('hands the fetched schema to the cluster', async () => {
        getGraphSchema.mockReturnValue(Promise.resolve(schemaOf(5)));

        await setup();

        expect(clusterTypes()).toBe('5');
    });

    it('filters a large schema down to the budget /graph also draws', async () => {
        //
        // the live build publishes 152 node types, so the page filters before
        // handing it over rather than drawing every type behind the hero text.
        //
        // The budget is the SHARED one. It used to be 24 here against 60 on
        // /graph, which left the page people land on first drawing a fifth of
        // the build's edges and missing a third of its namespaces entirely.
        //
        getGraphSchema.mockReturnValue(Promise.resolve(schemaOf(80)));

        await setup();

        expect(clusterTypes()).toBe(String(GRAPH_NODE_TYPES));
    });

    it('hands the cluster nothing for an unusable payload', async () => {
        //
        // propTypes warns but does not block a render, so a schema missing node_types
        // has to be stopped here rather than at the component.
        //
        getGraphSchema.mockReturnValue(Promise.resolve({ version: '1.3' }));

        await setup();

        expect(clusterTypes()).toBe('none');
    });

    it('keeps the schema on the page state', async () => {
        const { page } = await setup();

        expect(page.state).toHaveProperty('graph_schema');
    });
});

describe('the session lookup', () => {
    it('logs a live session rather than doing anything with it', async () => {
        //
        // the resolve arm. It logs the session object and stops -- nothing on the page
        // reads it, so a signed-in visitor sees exactly what a signed-out one sees.
        //
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});
        Auth.currentSession.mockResolvedValueOnce({ token: 'live' });
        const { page } = await setup();

        await page.currentUser();
        await act(async () => {});

        expect(quiet).toHaveBeenCalledWith({ token: 'live' });

        quiet.mockRestore();
    });

    it('logs the rejection rather than surfacing it', async () => {
        //
        // 'currentUser' is called by nothing on this page -- it neither renders from
        // the session nor gates anything on it. Both arms only log, so an expired
        // session and a live one are indistinguishable to the caller, and the method
        // cannot reject: the catch swallows it.
        //
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});
        const { page } = await setup();

        await expect(page.currentUser()).resolves.toBeUndefined();
        await act(async () => {});

        expect(quiet).toHaveBeenCalled();

        quiet.mockRestore();
    });
});

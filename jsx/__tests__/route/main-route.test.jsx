/**
 * main-route.test.jsx: which graph page an address opens.
 *
 * Two pages share the '/graph' prefix: the Training graph, which takes a build id
 * as '/graph/:graph', and the Retrieval graph at '/graph/retrieval'. The one thing
 * that must not happen is 'retrieval' being read as a build id -- the Training
 * graph would fall back to its default build, and the reader would be looking at
 * the wrong page with nothing on it saying so.
 *
 * Note: both graph pages are probes that report which one rendered, and with what
 *       from the address. Each has its own suite; what is under test here is the
 *       route table, and page.test.jsx's setup is borrowed for it -- MainRoute
 *       imports every top level layout, and some reach for Amplify on mount.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { createStore, combineReducers } from 'redux';

jest.mock('@aws-amplify/auth', () => ({
    __esModule: true,
    default: {
        currentAuthenticatedUser: jest.fn().mockRejectedValue(new Error('not signed in')),
        signIn: jest.fn(),
        signUp: jest.fn(),
        signOut: jest.fn(),
        currentSession: jest.fn().mockRejectedValue(new Error('no session')),
    },
}));

jest.mock('../../import/layout/graph/graph.jsx', () => {
    const mockReact = require('react');
    const { useParams } = require('react-router-dom');

    const probe = (page) => function Probe() {
        return mockReact.createElement('div', {
            'data-testid': 'graph-page',
            'data-page': page,
            'data-params': JSON.stringify(useParams()),
        });
    };

    return { __esModule: true, default: probe('training'), RetrievalGraph: probe('retrieval') };
});

import user from '../../import/redux/reducer/login.jsx';
import layout from '../../import/redux/reducer/layout.jsx';
import page from '../../import/redux/reducer/page.jsx';
import article from '../../import/redux/reducer/article.jsx';
import hide from '../../import/redux/reducer/hide.jsx';
import MainRoute from '../../import/route/main-route.jsx';

function renderAt(path) {
    const store = createStore(
        combineReducers({ user, page, layout, article, hide }),
        { user: { name: 'anonymous' }, page: { status: 'default' } }
    );

    render(
        <Provider store={store}>
            <MemoryRouter initialEntries={[path]}>
                <MainRoute />
            </MemoryRouter>
        </Provider>
    );

    const shown = screen.getByTestId('graph-page');

    return { page: shown.dataset.page, params: JSON.parse(shown.dataset.params) };
}

describe('the Retrieval graph', () => {
    it('opens at /graph/retrieval', () => {
        expect(renderAt('/graph/retrieval')).toEqual({ page: 'retrieval', params: {} });
    });

    it('opens on a day named in the address', () => {
        expect(renderAt('/graph/retrieval/2026-09-23'))
            .toEqual({ page: 'retrieval', params: { day: '2026-09-23' } });
    });
});

describe('the Training graph', () => {
    it('keeps /graph', () => {
        expect(renderAt('/graph')).toEqual({ page: 'training', params: {} });
    });

    it('still opens on a build named in the address', () => {
        //
        // every link to a build that was shared before the Retrieval graph
        // existed keeps working.
        //
        expect(renderAt('/graph/all-sources.2026-09.20260924T050042Z.1024d')).toEqual({
            page: 'training',
            params: { graph: 'all-sources.2026-09.20260924T050042Z.1024d' },
        });
    });

    it('never reads "retrieval" as a build id', () => {
        //
        // '/graph/retrieval' is a static segment, and outranks '/graph/:graph'
        // however the two are written down.
        //
        expect(renderAt('/graph/retrieval').page).toBe('retrieval');
    });
});

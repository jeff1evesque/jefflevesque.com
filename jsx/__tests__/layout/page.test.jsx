/**
 * page.test.jsx: url to layout routing.
 *
 * Rewritten from an enzyme suite that could not run. Beyond the dead 'src/'
 * import path, it pointed at 'layout/register.jsx', which does not exist --
 * registration moved to layout/register/register.jsx.
 *
 * Its assertions were also empty. Every case read:
 *
 *     expect(wrapper.find(SomeComponent)).toBeTruthy()
 *
 * and an enzyme wrapper is an object, so that is true whether the component
 * rendered or not. All five tests would have passed against a blank page.
 *
 * These assert on what a visitor actually sees at each url instead, which cannot
 * pass vacuously.
 *
 * Note: MainRoute imports every top level layout at module load, so this file
 *       pulls in a large share of the app. That is the point -- it is the closest
 *       thing here to a smoke test that the route table wires up at all.
 *
 * Note: '@aws-amplify/auth' is mocked. Several containers reach for the current
 *       user on mount, and unmocked Amplify throws without configuration.
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

import user from '../../import/redux/reducer/login.jsx';
import layout from '../../import/redux/reducer/layout.jsx';
import page from '../../import/redux/reducer/page.jsx';
import article from '../../import/redux/reducer/article.jsx';
import hide from '../../import/redux/reducer/hide.jsx';
import MainRoute from '../../import/route/main-route.jsx';

//
// the same shape store.jsx builds, minus the sessionStorage lookup for the
// username -- an anonymous visitor is the interesting case for routing.
//
function buildStore() {
    return createStore(
        combineReducers({ user, page, layout, article, hide }),
        {
            user: { name: 'anonymous' },
            page: { status: 'default' },
        }
    );
}

function renderAt(path) {
    return render(
        <Provider store={buildStore()}>
            <MemoryRouter initialEntries={[path]}>
                <MainRoute />
            </MemoryRouter>
        </Provider>
    );
}

describe('registration route', () => {
    it('/register renders the registration layout', () => {
        renderAt('/register');

        expect(screen.getByText('Create your account')).toBeInTheDocument();
    });

    it('/register renders the registration form itself', () => {
        renderAt('/register');

        expect(document.querySelector('[name="user[name]"]')).toBeInTheDocument();
        expect(document.querySelector('[name="user[email]"]')).toBeInTheDocument();
    });
});

describe('login routes', () => {
    it('/login renders the sign-in form', () => {
        renderAt('/login');

        expect(document.querySelector('[name="user[login]"]')).toBeInTheDocument();
        expect(document.querySelector('[name="user[password]"]')).toBeInTheDocument();
    });

    it('/logout renders the same layout as /login', () => {
        //
        // both urls map to LoginLayout on purpose: signing out lands the visitor
        // back on the sign-in form rather than on a dedicated page.
        //
        renderAt('/logout');

        expect(document.querySelector('[name="user[login]"]')).toBeInTheDocument();
    });
});

describe('unmatched routes', () => {
    it('a single unknown segment is treated as a username, not a 404', () => {
        //
        // WORTH KNOWING, and easy to be surprised by: the route table carries
        //
        //     <Route path='/:user' element={<AccountLayout />} />
        //
        // so ANY single-segment url matches it. '/no-such-page' renders the
        // profile layout rather than the 404 page, and there is effectively no
        // 404 for one-segment paths at all -- a typo'd link lands on an empty
        // profile instead of an error.
        //
        // This is the github style of top-level usernames, so it may well be
        // intended; it is pinned here so a change to the route order is a
        // deliberate one.
        //
        renderAt('/no-such-page');

        expect(screen.getByText('My Profile')).toBeInTheDocument();
        expect(screen.queryByText('404 - Not found')).not.toBeInTheDocument();
    });

    it('a deep unknown url does render the 404 page', () => {
        renderAt('/no/such/page/at/all');

        expect(screen.getByText('404 - Not found')).toBeInTheDocument();
    });

    it('a known two-segment route is not shadowed by the username route', () => {
        renderAt('/login/reset');

        expect(screen.queryByText('My Profile')).not.toBeInTheDocument();
        expect(screen.queryByText('404 - Not found')).not.toBeInTheDocument();
    });

    it('the 404 page is not shown on a route that does match', () => {
        renderAt('/register');

        expect(screen.queryByText('404 - Not found')).not.toBeInTheDocument();
    });
});

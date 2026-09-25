/**
 * header-menu.test.jsx: the header shown to anonymous visitors.
 *
 * HeaderMenu picks one of four headers:
 *
 *   layout.type === 'login'    -> a bare home icon
 *   layout.type === 'register' -> home icon + login link
 *   viewport > small           -> the full desktop bar
 *   otherwise                  -> the collapsed mobile bar
 *
 * The first two are the interesting ones, because the value they test is not the
 * value the store holds until a SET-LAYOUT action has been dispatched. The layout
 * reducer starts as the STRING 'analysis', and 'analysis'.type is undefined -- so
 * on a cold load these branches cannot be taken. That is pinned below with the
 * string form, which is what redux/container/header-menu.jsx actually forwards.
 *
 * Note: the desktop/mobile split comes from rearm's BreakpointRender, which reads
 *       window.innerWidth in its constructor. jsdom defaults to 1024, which is
 *       above the 576 'small' cap, so the DEFAULT render here is the desktop one;
 *       the mobile tests shrink the viewport before mounting.
 *
 * Note: the login/register links are connected components, so a Provider is
 *       required even though this file is testing the presentational header.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Provider } from 'react-redux';
import { createStore, combineReducers } from 'redux';

import user from '../../import/redux/reducer/login.jsx';
import HeaderMenu from '../../import/navigation/header-menu.jsx';

const DESKTOP = 1024;
const MOBILE = 375;

//
// where the router is, so a test can tell a link the router followed from one it
// never saw
//
function Where() {
    return <output data-testid='where'>{useLocation().pathname}</output>;
}

function renderHeader({ layout, username = 'anonymous', width = DESKTOP, path = '/' } = {}) {
    window.innerWidth = width;

    const store = createStore(
        combineReducers({ user }),
        { user: { name: username } }
    );

    return render(
        <Provider store={store}>
            <MemoryRouter initialEntries={[path]}>
                <HeaderMenu layout={layout} />
                <Where />
            </MemoryRouter>
        </Provider>
    );
}

//
// the desktop Graph section is a dropdown: a toggle, and a menu the toggle opens
//
async function openGraphMenu() {
    await userEvent.click(screen.getByRole('button', { name: 'Graph' }));
}

afterEach(() => {
    window.innerWidth = DESKTOP;
});

describe('the login header', () => {
    it('shows only a way back to the home page', () => {
        const { container } = renderHeader({ layout: { type: 'login' } });

        expect(container.querySelector('nav')).toHaveClass('menu-login');
        expect(screen.getAllByRole('link')).toHaveLength(1);
        expect(screen.getByRole('link')).toHaveAttribute('href', '/');
    });

    it('does not offer a login link on the login page itself', () => {
        renderHeader({ layout: { type: 'login' } });

        expect(screen.queryByText('Login in')).not.toBeInTheDocument();
        expect(screen.queryByText('Sign up')).not.toBeInTheDocument();
    });
});

describe('the register header', () => {
    it('offers the home icon and a route back to signing in', () => {
        const { container } = renderHeader({ layout: { type: 'register' } });

        expect(container.querySelector('nav')).toHaveClass('menu-register');
        expect(screen.getByRole('link', { name: 'Login in' }))
            .toHaveAttribute('href', '/login');
    });

    it('does not repeat the sign-up call to action', () => {
        renderHeader({ layout: { type: 'register' } });

        expect(screen.queryByText('Sign up')).not.toBeInTheDocument();
    });
});

describe('what the layout prop has to look like', () => {
    it('a bare string layout does NOT select the login header', () => {
        //
        // WORTH KNOWING: reducer/layout.jsx initializes to the string 'analysis'
        // and only replaces it with { css, type } once SET-LAYOUT is dispatched.
        // Until then redux/container/header-menu.jsx forwards a string, and
        // 'login'.type is undefined -- so the guard here is really "has a layout
        // action been dispatched yet", not "which page is this".
        //
        renderHeader({ layout: 'login' });

        expect(screen.getByRole('link', { name: 'Data' })).toBeInTheDocument();
    });

    it('the reducer default falls through to the responsive header', () => {
        renderHeader({ layout: 'analysis' });

        expect(screen.getByRole('link', { name: 'Stream' })).toBeInTheDocument();
    });

    it('an unrecognised layout type falls through to the responsive header', () => {
        renderHeader({ layout: { type: 'analysis' } });

        expect(screen.getByRole('link', { name: 'Model' })).toBeInTheDocument();
    });

    it('no layout prop at all falls through to the responsive header', () => {
        renderHeader();

        expect(screen.getByRole('link', { name: 'Data' })).toBeInTheDocument();
    });
});

describe('the desktop header', () => {
    it('links every section through the router', () => {
        renderHeader();

        expect(screen.getByRole('link', { name: 'Data' })).toHaveAttribute('href', '/data');
        expect(screen.getByRole('link', { name: 'Stream' })).toHaveAttribute('href', '/stream');
        expect(screen.getByRole('link', { name: 'Model' })).toHaveAttribute('href', '/model');
        expect(screen.getByRole('button', { name: 'Graph' })).toBeInTheDocument();
    });

    it('offers both login and sign-up to an anonymous visitor', () => {
        renderHeader({ username: 'anonymous' });

        expect(screen.getByRole('link', { name: 'Login in' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Sign up' })).toBeInTheDocument();
    });

    it('drops the sign-up prompt once somebody is signed in', () => {
        //
        // RegisterLink hides itself for a named user. LoginLink does not -- see
        // the next test.
        //
        renderHeader({ username: 'jeff' });

        expect(screen.queryByText('Sign up')).not.toBeInTheDocument();
    });

    it('opens Graph onto its two pages, through the router', async () => {
        //
        // the Training graph keeps /graph, so every link to a build keeps
        // working, and the Retrieval graph sits beside it. Both are router
        // links, as the pills beside the dropdown are.
        //
        renderHeader();

        await openGraphMenu();

        const training = screen.getByRole('link', { name: 'Training graph' });
        const retrieval = screen.getByRole('link', { name: 'Retrieval graph' });

        expect(training).toHaveAttribute('href', '/graph');
        expect(retrieval).toHaveAttribute('href', '/graph/retrieval');

        //
        // followed by the router, without a page load: the in-memory address
        // moves, which a plain href would leave where it was
        //
        await userEvent.click(retrieval);

        expect(screen.getByTestId('where')).toHaveTextContent('/graph/retrieval');
    });

    it('offers nothing but the two pages under Graph', async () => {
        renderHeader();

        await openGraphMenu();

        const menu = document.querySelector('.main-navigation-dropdown .dropdown-menu');

        expect([...menu.querySelectorAll('a')].map((a) => a.textContent))
            .toEqual(['Training graph', 'Retrieval graph']);
    });

    it.each([
        ['/graph', 'Training graph'],
        ['/graph/all-sources.2026-09.20260924T050042Z.1024d', 'Training graph'],
        ['/graph/retrieval', 'Retrieval graph'],
        ['/graph/retrieval/2026-09-23', 'Retrieval graph'],
    ])('on %s, marks Graph and %s as where the reader is', async (path, page) => {
        //
        // '/graph' is a prefix of '/graph/retrieval', which is why the marking is
        // the page's own and not a NavLink's: that would light the Training
        // graph on both pages.
        //
        renderHeader({ path: path });

        expect(screen.getByRole('button', { name: 'Graph' })).toHaveClass('active');

        await openGraphMenu();

        const marked = [...document.querySelectorAll('.main-navigation-dropdown .dropdown-item.active')]
            .map((a) => a.textContent);

        expect(marked).toEqual([page]);
    });

    it('marks nothing under Graph on another section', async () => {
        renderHeader({ path: '/data' });

        expect(screen.getByRole('button', { name: 'Graph' })).not.toHaveClass('active');

        await openGraphMenu();

        expect(document.querySelectorAll('.main-navigation-dropdown .dropdown-item.active')).toHaveLength(0);
    });

    it('still shows "Login in" to a signed-in user', () => {
        //
        // WORTH KNOWING: this header has no signed-in state of its own. It stays
        // correct only because layout/page.jsx swaps the whole component for
        // UserMenuState the moment the username is not 'anonymous'. Render
        // HeaderMenu anywhere else and a signed-in visitor is invited to log in
        // again.
        //
        renderHeader({ username: 'jeff' });

        expect(screen.getByRole('link', { name: 'Login in' })).toBeInTheDocument();
    });
});

describe('the mobile header', () => {
    it('replaces the section links with a collapsed Session dropdown', () => {
        renderHeader({ width: MOBILE });

        expect(screen.getByText('Session')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Data' })).not.toBeInTheDocument();
    });

    it('shows login and register as icons rather than buttons', () => {
        renderHeader({ width: MOBILE });

        expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
        expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
    });

    it('reveals every section once the dropdown is opened', async () => {
        renderHeader({ width: MOBILE });

        await userEvent.click(screen.getByRole('button', { name: /Session/ }));

        expect(screen.getByRole('link', { name: 'Data' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Stream' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Model' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Training graph' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Retrieval graph' })).toBeInTheDocument();
    });

    it('lists the two graph pages under a Graph heading of their own', async () => {
        //
        // a dropdown inside this dropdown would be a menu a phone cannot hold
        // open while the reader moves between them, so the one Graph entry
        // became a heading over two.
        //
        renderHeader({ width: MOBILE });

        await userEvent.click(screen.getByRole('button', { name: /Session/ }));

        const entries = [...document.querySelectorAll('.session .dropdown-menu > *')]
            .map((entry) => `${entry.classList.contains('dropdown-header') ? '# ' : ''}${entry.textContent}`);

        expect(entries).toEqual([
            'Stream',
            'Data',
            '# Graph',
            'Training graph',
            'Retrieval graph',
            'Model',
        ]);
        expect(screen.getByRole('link', { name: 'Training graph' })).toHaveAttribute('href', '/graph');
        expect(screen.getByRole('link', { name: 'Retrieval graph' })).toHaveAttribute('href', '/graph/retrieval');
    });

    it('navigates the mobile sections with plain hrefs, not the router', async () => {
        //
        // WORTH KNOWING: the desktop bar uses NavLink (client-side), the mobile
        // dropdown uses NavDropdown.Item href (a full page load). The same
        // destinations behave differently depending on viewport width.
        //
        renderHeader({ width: MOBILE });

        await userEvent.click(screen.getByRole('button', { name: /Session/ }));

        const data = screen.getByRole('link', { name: 'Data' });
        expect(data).toHaveAttribute('href', '/data');
        expect(data).toHaveAttribute('data-rr-ui-dropdown-item');
    });
});

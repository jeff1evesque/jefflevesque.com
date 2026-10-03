/**
 * header-menu.test.jsx: the header shown to anonymous visitors.
 *
 * HeaderMenu draws one of two headers, on every page:
 *
 *   viewport > small           -> the full desktop bar
 *   otherwise                  -> the phone's bar, and the menu it drops
 *
 * The sign-in and sign-up pages wore bare headers of their own, picked by the
 * 'layout' a page set as it mounted. They wear the same two now, less the
 * account button for the page on screen (#179), and a 'layout' handed in changes
 * nothing.
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
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Provider } from 'react-redux';
import { createStore, combineReducers } from 'redux';

import user from '../../import/redux/reducer/login.jsx';
import HeaderMenu from '../../import/navigation/header-menu.jsx';
import { colors, toRGB } from '../../import/general/colors.js';

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

describe('the sign-in and sign-up pages (#179)', () => {
    //
    // they wore bare headers of their own -- a house and the theme's switch,
    // with no bar, no menu and no sections. They wear the site's own header now,
    // less the account button for the page on screen
    //
    const PAGES = ['/login', '/register', '/forgot-password'];

    it.each(PAGES)('draws the wide header on %s, with every section', (path) => {
        renderHeader({ path: path });

        ['Stream', 'Data', 'Model'].forEach((name) => {
            expect(screen.getByRole('link', { name: name })).toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: 'Graph' })).toBeInTheDocument();
        expect(document.querySelector('.menu-login, .menu-register')).toBeNull();
    });

    it.each(PAGES)('draws the phone\'s bar and its menu on %s', async (path) => {
        renderHeader({ width: MOBILE, path: path });

        expect(document.querySelector('.phone-header')).not.toBeNull();

        await userEvent.click(document.querySelector('.navbar-toggler'));

        expect(screen.getByRole('navigation', { name: 'Site' })).toBeInTheDocument();
    });

    it('leaves "Login in" out on the sign-in page, and keeps "Sign up"', () => {
        renderHeader({ path: '/login' });

        expect(screen.queryByRole('link', { name: 'Login in' })).toBeNull();
        expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/register');
    });

    it('leaves "Sign up" out on the sign-up page, and keeps "Login in"', () => {
        renderHeader({ path: '/register' });

        expect(screen.queryByRole('link', { name: 'Sign up' })).toBeNull();
        expect(screen.getByRole('link', { name: 'Login in' })).toHaveAttribute('href', '/login');
    });

    it('keeps both on the page that resets a password', () => {
        renderHeader({ path: '/forgot-password' });

        expect(screen.getByRole('link', { name: 'Login in' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Sign up' })).toBeInTheDocument();
    });

    it.each([
        ['/login', 'Register'],
        ['/register', 'Login'],
    ])('leaves the phone menu\'s own button out on %s, and keeps the other', async (path, left) => {
        renderHeader({ width: MOBILE, path: path });

        await userEvent.click(document.querySelector('.navbar-toggler'));

        expect([...document.querySelectorAll('.phone-menu-actions .btn')].map((button) => button.textContent))
            .toEqual([left]);
    });

    it('changes nothing for a layout handed in, which it no longer reads', () => {
        renderHeader({ layout: { type: 'login' }, path: '/stream' });

        expect(screen.getByRole('link', { name: 'Login in' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Sign up' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Stream' })).toBeInTheDocument();
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

        const training = screen.getByRole('link', { name: 'Training Graph' });
        const retrieval = screen.getByRole('link', { name: 'Retrieval Graph' });

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
            .toEqual(['Training Graph', 'Retrieval Graph']);
    });

    it.each([
        ['/graph', 'Training Graph'],
        ['/graph/all-sources.2026-09.20260924T050042Z.1024d', 'Training Graph'],
        ['/graph/retrieval', 'Retrieval Graph'],
        ['/graph/retrieval/2026-09-23', 'Retrieval Graph'],
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
    //
    // the phone's bar and the menu it drops over the page (#173): one list of
    // the pages, Login and Register as buttons under it, and three ways out --
    // the bar's own button, the arrow on the menu's foot, and a tap on the
    // dimmed page.
    //
    const menuButton = () => document.querySelector('.navbar-toggler');
    const menu = () => screen.getByRole('navigation', { name: 'Site' });
    const scrim = () => document.querySelector('.phone-menu-scrim');

    async function openMenu() {
        await userEvent.click(menuButton());
    }

    it('starts closed, and says what its button will do', async () => {
        renderHeader({ width: MOBILE });

        expect(menuButton()).toHaveAttribute('aria-label', 'Open the menu');
        expect(menuButton()).toHaveClass('collapsed');
        expect(scrim()).toBeNull();

        await openMenu();

        expect(menuButton()).toHaveAttribute('aria-label', 'Close the menu');
        expect(menuButton()).not.toHaveClass('collapsed');
        expect(scrim()).not.toBeNull();
    });

    it('lists every page, in the wide header\'s order, with no Session and no Graph heading', async () => {
        renderHeader({ width: MOBILE });

        await openMenu();

        const rows = [...menu().querySelectorAll('.phone-menu-link')];

        expect(rows.map((row) => row.textContent)).toEqual([
            'Stream',
            'Data',
            'Training Graph',
            'Retrieval Graph',
            'Model',
        ]);
        expect(rows.map((row) => row.getAttribute('href'))).toEqual([
            '/stream',
            '/data',
            '/graph',
            '/graph/retrieval',
            '/model',
        ]);
        expect(screen.queryByText('Session')).not.toBeInTheDocument();
        expect(document.querySelector('.dropdown-header, .menu-sub-item')).toBeNull();
    });

    it('ends every row in an arrow a screen reader passes over', async () => {
        renderHeader({ width: MOBILE });

        await openMenu();

        menu().querySelectorAll('.phone-menu-link').forEach((row) => {
            expect(row.querySelector('.phone-menu-arrow')).toHaveAttribute('aria-hidden', 'true');
        });
    });

    it('offers Login and Register as the wide header\'s two buttons, at the menu\'s foot', async () => {
        renderHeader({ width: MOBILE });

        await openMenu();

        const login = within(menu()).getByRole('link', { name: 'Login' });
        const register = within(menu()).getByRole('link', { name: 'Register' });

        expect(login).toHaveAttribute('href', '/login');
        expect(login).toHaveClass('btn');
        expect(login).not.toHaveClass('btn-primary');
        expect(register).toHaveAttribute('href', '/register');
        expect(register).toHaveClass('btn', 'btn-primary');
        expect(login.closest('.phone-menu-actions')).toBe(register.closest('.phone-menu-actions'));
    });

    it('goes through the router, and closes the menu on the way', async () => {
        //
        // the wide header's links always did; the phone's were plain hrefs, and
        // loaded the whole site again
        //
        renderHeader({ width: MOBILE, path: '/stream' });

        await openMenu();
        await userEvent.click(within(menu()).getByRole('link', { name: 'Data' }));

        expect(screen.getByTestId('where')).toHaveTextContent('/data');
        expect(menuButton()).toHaveAttribute('aria-label', 'Open the menu');
        expect(scrim()).toBeNull();
    });

    it('closes from the arrow on the menu\'s foot', async () => {
        renderHeader({ width: MOBILE });

        await openMenu();
        await userEvent.click(within(menu()).getByRole('button', { name: 'Close the menu' }));

        expect(menuButton()).toHaveAttribute('aria-label', 'Open the menu');
        expect(scrim()).toBeNull();
    });

    it('closes from a tap on the dimmed page, which a screen reader is not shown', async () => {
        renderHeader({ width: MOBILE });

        await openMenu();

        expect(scrim()).toHaveAttribute('aria-hidden', 'true');

        await userEvent.click(scrim());

        expect(menuButton()).toHaveAttribute('aria-label', 'Open the menu');
        expect(scrim()).toBeNull();
    });

    it('closes from its own button on the bar', async () => {
        renderHeader({ width: MOBILE });

        await openMenu();
        await userEvent.click(menuButton());

        expect(menuButton()).toHaveAttribute('aria-label', 'Open the menu');
        expect(scrim()).toBeNull();
    });

    it.each([
        ['/stream', 'Stream'],
        ['/stream/sec/alarm', 'Stream'],
        ['/data', 'Data'],
        ['/graph', 'Training Graph'],
        ['/graph/all-sources.2026-09.20260924T050042Z.1024d', 'Training Graph'],
        ['/graph/retrieval', 'Retrieval Graph'],
        ['/graph/retrieval/2026-09-23', 'Retrieval Graph'],
        ['/model', 'Model'],
    ])('marks %s as on %s, and nothing else', async (path, label) => {
        renderHeader({ width: MOBILE, path: path });

        await openMenu();

        const marked = [...menu().querySelectorAll('[aria-current="page"]')];

        expect(marked.map((row) => row.textContent)).toEqual([label]);
        expect(marked[0]).toHaveClass('active');
    });

    it('marks nothing on the home page', async () => {
        renderHeader({ width: MOBILE, path: '/' });

        await openMenu();

        expect(menu().querySelector('[aria-current], .active')).toBeNull();
    });
});

//
// the light and dark switch, in every header an anonymous visitor sees -- see
// theme-toggle.jsx. Beside the control that ends each one: left of Login where
// there is a Login, and beside the menu button on a phone.
//
describe('the house on the bar', () => {
    //
    // green-roofed on the home page, and gray-roofed until pointed at on any
    // other -- see HomeBrand in menu-items/home.jsx
    //
    const roof = () => toRGB(document.querySelector('.navbar-brand svg.home path').style.fill);

    it.each([['desktop', DESKTOP], ['mobile', MOBILE]])('has a green roof on the home page, on a %s bar', (name, width) => {
        renderHeader({ width: width, path: '/' });

        expect(roof()).toBe(toRGB(colors['green-3']));
    });

    it.each([['desktop', DESKTOP], ['mobile', MOBILE]])('has a gray roof on any other page, on a %s bar', (name, width) => {
        renderHeader({ width: width, path: '/stream' });

        expect(roof()).toBe(toRGB(colors['gray-5']));
    });
});

describe('the theme switch', () => {
    const toggle = () => screen.getByRole('button', { name: 'Dark theme' });
    const before = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    it('sits just left of Login on a wide screen', () => {
        renderHeader();

        expect(before(toggle(), screen.getByRole('link', { name: 'Login in' }))).toBe(true);
        expect(toggle().parentNode).toBe(screen.getByRole('link', { name: 'Login in' }).parentNode);
    });

    it('sits on a phone\'s bar beside the menu button, not inside the menu', () => {
        renderHeader({ width: MOBILE });

        expect(toggle().closest('.navbar-collapse')).toBeNull();
        expect(before(toggle(), document.querySelector('.navbar-toggler'))).toBe(true);
    });

    it('wears its page look on a phone\'s bar, which is no longer black (#173)', () => {
        renderHeader({ width: MOBILE });

        expect(toggle()).toHaveClass('theme-toggle', 'theme-toggle-phone');
        expect(toggle()).not.toHaveClass('theme-toggle-bar');
    });

    it('sits just left of Sign up on the sign-in page, whose Login in is left out (#179)', () => {
        renderHeader({ path: '/login' });

        expect(before(toggle(), screen.getByRole('link', { name: 'Sign up' }))).toBe(true);
        expect(toggle().parentNode).toBe(screen.getByRole('link', { name: 'Sign up' }).parentNode);
    });

    it('sits just left of Login on the sign-up page, as on any other (#179)', () => {
        renderHeader({ path: '/register' });

        expect(before(toggle(), screen.getByRole('link', { name: 'Login in' }))).toBe(true);
    });
});

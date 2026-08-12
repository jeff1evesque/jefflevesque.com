/**
 * user-menu.test.jsx: the header shown once somebody is signed in.
 *
 * Two areas are worth the coverage here.
 *
 * The first is sign-out, which is the only place in the navigation tree with
 * side effects: it dispatches LOGGED-OUT, clears sessionStorage, calls Cognito
 * and then navigates. The ORDER matters and is not obvious from reading it --
 * the local teardown happens BEFORE the remote sign-out is awaited, so a failing
 * Auth.signOut leaves the app locally signed out and remotely still signed in.
 * That is pinned rather than asserted as correct.
 *
 * The second is the anonymous fallback. getCurrentUser() answers 'anonymous'
 * when there is no user, and that string is then interpolated straight into the
 * profile urls -- so a menu rendered without a user offers links to '/anonymous'.
 *
 * Note: '@aws-amplify/auth' is mocked. Unmocked Amplify throws without
 *       configuration, and these tests need to control whether sign-out resolves.
 *
 * Note: window.location is replaced for the sign-out tests. jsdom does not
 *       implement navigation and reports the attempt as a console error, which
 *       setup.js turns into a test failure.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

jest.mock('@aws-amplify/auth', () => ({
    __esModule: true,
    default: { signOut: jest.fn() },
}));

import Auth from '@aws-amplify/auth';
import UserMenu from '../../import/navigation/user-menu.jsx';

const DESKTOP = 1024;
const MOBILE = 375;

function renderMenu({ user, width = DESKTOP, dispatchLogout = jest.fn() } = {}) {
    window.innerWidth = width;

    render(
        <MemoryRouter>
            <UserMenu user={user} dispatchLogout={dispatchLogout} />
        </MemoryRouter>
    );

    return { dispatchLogout };
}

//
// react-bootstrap does not mount a dropdown's menu until it is opened, so every
// assertion about the items has to open it first. The user dropdown is the first
// toggle; the session dropdown is the second.
//
async function openUserDropdown() {
    const [userToggle] = screen.getAllByRole('button', { expanded: false });
    await userEvent.click(userToggle);
}

beforeEach(() => {
    Auth.signOut.mockReset();
    Auth.signOut.mockResolvedValue(undefined);
});

afterEach(() => {
    window.innerWidth = DESKTOP;
    sessionStorage.clear();
});

describe('the desktop dropdown', () => {
    it('greets the signed-in user by name', async () => {
        renderMenu({ user: { name: 'jeff' } });
        await openUserDropdown();

        expect(screen.getByText('Welcome jeff!')).toBeInTheDocument();
    });

    it('builds the profile links from the username', async () => {
        renderMenu({ user: { name: 'jeff' } });
        await openUserDropdown();

        expect(screen.getByRole('link', { name: 'My Profile' }))
            .toHaveAttribute('href', '/jeff');
        expect(screen.getByRole('link', { name: 'Account Settings' }))
            .toHaveAttribute('href', '/jeff/settings');
    });

    it('carries a sign-out item pointing at /logout', async () => {
        renderMenu({ user: { name: 'jeff' } });
        await openUserDropdown();

        expect(screen.getByRole('link', { name: 'Sign out' }))
            .toHaveAttribute('href', '/logout');
    });

    it('renders the session shortcuts in a second dropdown', async () => {
        renderMenu({ user: { name: 'jeff' } });

        const toggles = screen.getAllByRole('button', { expanded: false });
        await userEvent.click(toggles[1]);

        expect(screen.getByRole('link', { name: 'Add new data' }))
            .toHaveAttribute('href', '/session/data-new');
        expect(screen.getByRole('link', { name: 'Append data' }))
            .toHaveAttribute('href', '/session/data-append');
        expect(screen.getByRole('link', { name: 'Generate model' }))
            .toHaveAttribute('href', '/session/model-generate');
        expect(screen.getByRole('link', { name: 'Make prediction' }))
            .toHaveAttribute('href', '/session/model-predict');
    });

    it('gives both dropdowns the same dom id', () => {
        //
        // DEFECT: the user dropdown and the session dropdown are both
        // id='basic-nav-dropdown', and each menu points at that id with
        // aria-labelledby. A screen reader resolves both to whichever element
        // comes first, and getElementById can only ever reach one of them.
        //
        renderMenu({ user: { name: 'jeff' } });

        expect(document.querySelectorAll('#basic-nav-dropdown')).toHaveLength(2);
    });
});

describe('the anonymous fallback', () => {
    it.each([
        ['no user prop', undefined],
        ['an empty username', { name: '' }],
        ['an explicit anonymous user', { name: 'anonymous' }],
    ])('falls back to anonymous given %s', async (label, user) => {
        renderMenu({ user });
        await openUserDropdown();

        expect(screen.getByText('Welcome anonymous!')).toBeInTheDocument();
    });

    it('points the profile links at a literal /anonymous', async () => {
        //
        // WORTH KNOWING: the fallback username is interpolated into the urls
        // without a further check, so an anonymous render offers 'My Profile'
        // linking to '/anonymous'. That url matches the '/:user' route, so it
        // renders an empty profile page rather than a 404.
        //
        renderMenu({ user: undefined });
        await openUserDropdown();

        expect(screen.getByRole('link', { name: 'My Profile' }))
            .toHaveAttribute('href', '/anonymous');
        expect(screen.getByRole('link', { name: 'Account Settings' }))
            .toHaveAttribute('href', '/anonymous/settings');
    });
});

describe('the mobile dropdown', () => {
    it('labels the toggle with the username instead of hiding it behind an icon', () => {
        renderMenu({ user: { name: 'jeff' }, width: MOBILE });

        expect(screen.getByText('jeff')).toBeInTheDocument();
    });

    it('drops the greeting row that the desktop menu carries', async () => {
        renderMenu({ user: { name: 'jeff' }, width: MOBILE });
        await openUserDropdown();

        expect(screen.queryByText('Welcome jeff!')).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'My Profile' })).toBeInTheDocument();
    });

    it('keeps sign-out available', async () => {
        renderMenu({ user: { name: 'jeff' }, width: MOBILE });
        await openUserDropdown();

        expect(screen.getByRole('link', { name: 'Sign out' })).toBeInTheDocument();
    });
});

describe('signing out', () => {
    let realLocation;

    beforeEach(() => {
        realLocation = Object.getOwnPropertyDescriptor(window, 'location');
        Object.defineProperty(window, 'location', {
            configurable: true,
            writable: true,
            value: { href: 'http://localhost/', pathname: '/' },
        });
    });

    afterEach(() => {
        Object.defineProperty(window, 'location', realLocation);
    });

    async function signOut(dispatchLogout = jest.fn()) {
        renderMenu({ user: { name: 'jeff' }, dispatchLogout });
        await openUserDropdown();
        await userEvent.click(screen.getByRole('link', { name: 'Sign out' }));
        return dispatchLogout;
    }

    it('dispatches the logout action', async () => {
        const dispatchLogout = await signOut();

        expect(dispatchLogout).toHaveBeenCalledWith({
            type: 'LOGGED-OUT',
            user: { name: 'anonymous' },
        });
    });

    it('clears the cached username', async () => {
        sessionStorage.setItem('username', 'jeff');

        await signOut();

        expect(sessionStorage.getItem('username')).toBeNull();
    });

    it('signs out of cognito', async () => {
        await signOut();

        expect(Auth.signOut).toHaveBeenCalledTimes(1);
    });

    it('lands the visitor on /login rather than /logout', async () => {
        //
        // the item's href is '/logout', but handleClick preventDefaults it and
        // redirects to '/login' -- '/logout' exists in the route table only so
        // the link has somewhere to point.
        //
        await signOut();

        await waitFor(() => expect(window.location.href).toBe('/login'));
    });

    it('tears down local state before cognito has confirmed anything', async () => {
        //
        // WORTH KNOWING: handleClick dispatches LOGGED-OUT and clears
        // sessionStorage BEFORE awaiting Auth.signOut. When the remote call
        // fails the redirect is skipped, so the visitor stays on the page --
        // but the app already believes they are anonymous while Cognito still
        // holds a valid session. Signing back in is the only way out.
        //
        Auth.signOut.mockRejectedValue(new Error('network down'));
        sessionStorage.setItem('username', 'jeff');

        const dispatchLogout = await signOut();

        expect(dispatchLogout).toHaveBeenCalledTimes(1);
        expect(sessionStorage.getItem('username')).toBeNull();
        expect(window.location.href).toBe('http://localhost/');
    });

    it('does not navigate when cognito rejects', async () => {
        Auth.signOut.mockRejectedValue(new Error('network down'));

        await signOut();

        await waitFor(() => expect(Auth.signOut).toHaveBeenCalled());
        expect(window.location.href).toBe('http://localhost/');
    });
});

/**
 * account.test.jsx: the two user-area pages.
 *
 * layout/user/ holds account.jsx (served at '/:user') and settings.jsx (served at
 * '/:user/settings').
 *
 * The profile page is still a placeholder: a heading and the literal word 'Content'.
 * It is worth pinning anyway, because '/:user' is the catch-all single-segment route --
 * as route/main-route.jsx's own test records, ANY unrecognised one-segment url lands on
 * AccountLayout rather than on the 404 page. Whatever it renders is what a visitor sees
 * after a mistyped link.
 *
 * Account Settings lists the alarms the reader is subscribed to, each with a way to
 * unsubscribe, from the account api. Who the reader is comes from their session's token
 * -- never from the '/:user' in the url, so neither page reads its props.
 *
 * Note: 'general/account-api.js' is mocked, pending by default, as alarm.test.jsx mocks
 *       it -- and the api's session reader imports Amplify, which jest cannot load
 *       unmocked. The module has its own suite.
 */

jest.mock('../../../import/general/account-api.js', () => ({
    __esModule: true,
    signedIn: jest.fn(),
    readerToken: jest.fn(),
    listSubscriptions: jest.fn(),
    unsubscribe: jest.fn(),
}));

import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { signedIn, readerToken, listSubscriptions, unsubscribe } from '../../../import/general/account-api.js';
import AccountLayout from '../../../import/layout/user/account.jsx';
import SettingsLayout, { expiryOf } from '../../../import/layout/user/settings.jsx';

const pending = () => new Promise(() => {});

const HELD = { stream: 'bls', alarm: 'ingest', since: '2026-09-26T12:00:00Z', terms: '2026-09' };

beforeEach(() => {
    jest.clearAllMocks();
    signedIn.mockImplementation(pending);
    readerToken.mockImplementation(pending);
    listSubscriptions.mockImplementation(pending);
    unsubscribe.mockImplementation(pending);
});

//
// the settings page links to the streams and to sign-in, so it renders in a router
//
function renderSettings(props = {}) {
    return render(
        <MemoryRouter>
            <SettingsLayout {...props} />
        </MemoryRouter>
    );
}

const section = () => screen.getByRole('heading', { level: 4, name: 'Alarm subscriptions' }).parentElement;

describe('the profile page', () => {
    it('is headed "My Profile"', () => {
        render(<AccountLayout />);

        expect(screen.getByRole('heading', { level: 1, name: 'My Profile' }))
            .toBeInTheDocument();
    });

    it('shows the unimplemented placeholder body', () => {
        render(<AccountLayout />);

        expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('renders inside the shared .account wrapper', () => {
        const { container } = render(<AccountLayout />);

        expect(container.querySelector('.account')).toBeInTheDocument();
    });
});

describe('the settings page', () => {
    it('is headed "My Settings"', () => {
        renderSettings();

        expect(screen.getByRole('heading', { level: 1, name: 'My Settings' }))
            .toBeInTheDocument();
    });

    it('is its own component now, rather than a copy of the profile page', () => {
        //
        // it declared `class AccountLayout` too, so React DevTools, error boundaries
        // and stack traces could not tell the two pages apart
        //
        expect(SettingsLayout.name).toBe('SettingsLayout');
        expect(AccountLayout.name).toBe('AccountLayout');
    });

    it('says it is checking while the subscriptions are on their way', () => {
        renderSettings();

        expect(within(section()).getByText(/Checking your subscriptions/)).toBeInTheDocument();
    });
});

describe('the alarm subscriptions', () => {
    it('lists each one: its stream, its alarm, and when it started', async () => {
        listSubscriptions.mockResolvedValue([HELD]);

        renderSettings();

        const stream = await screen.findByRole('link', { name: 'Bureau of Labor Statistics' });

        expect(stream).toHaveAttribute('href', '/stream/bls/alarm');
        expect(section()).toHaveTextContent('Bureau of Labor Statistics ingest alarm');
        expect(section()).toHaveTextContent('since 2026-09-26');
    });

    it('unsubscribes, and takes the row away once the api has answered', async () => {
        listSubscriptions.mockResolvedValue([HELD, { ...HELD, stream: 'sec' }]);
        unsubscribe.mockResolvedValue(true);

        renderSettings();

        const [first] = await screen.findAllByRole('button', { name: 'Unsubscribe' });

        fireEvent.click(first);

        await waitFor(() => expect(screen.getAllByRole('button', { name: 'Unsubscribe' })).toHaveLength(1));
        expect(unsubscribe).toHaveBeenCalledWith('bls', 'ingest');
        expect(screen.queryByRole('link', { name: 'Bureau of Labor Statistics' })).toBeNull();
        expect(screen.getByRole('link', { name: 'SEC Filings' })).toBeInTheDocument();
    });

    it('holds a row still while its unsubscribe is on its way', async () => {
        listSubscriptions.mockResolvedValue([HELD]);

        renderSettings();

        fireEvent.click(await screen.findByRole('button', { name: 'Unsubscribe' }));

        await waitFor(() => expect(screen.getByRole('button', { name: 'Unsubscribe' })).toBeDisabled());
    });

    it('leaves the row, and says why, when the api refuses', async () => {
        listSubscriptions.mockResolvedValue([HELD]);
        unsubscribe.mockRejectedValue(new Error('busy, try again'));

        renderSettings();

        fireEvent.click(await screen.findByRole('button', { name: 'Unsubscribe' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('busy, try again');
        expect(screen.getByRole('button', { name: 'Unsubscribe' })).toBeEnabled();
    });

    it('points to the streams when there are none', async () => {
        listSubscriptions.mockResolvedValue([]);

        renderSettings();

        expect(await screen.findByRole('link', { name: 'Stream' })).toHaveAttribute('href', '/stream');
        expect(section()).toHaveTextContent('You are not subscribed to any alarms.');
    });

    it('asks the reader to sign in when there is no one signed in', async () => {
        listSubscriptions.mockResolvedValue(null);

        renderSettings();

        expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    });

    it('asks them to sign in again once the session has ended', async () => {
        //
        // null from the api is a 401: not an error, a reader who has to sign in again
        //
        listSubscriptions.mockResolvedValue([HELD]);
        unsubscribe.mockResolvedValue(null);

        renderSettings();

        fireEvent.click(await screen.findByRole('button', { name: 'Unsubscribe' }));

        expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument();
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('says so when they could not be listed', async () => {
        listSubscriptions.mockRejectedValue(new Error('busy, try again'));

        renderSettings();

        expect(await screen.findByRole('alert')).toHaveTextContent('busy, try again');
    });
});

//
// an ID token as the sign-in issues one: three base64url parts, the middle one its
// claims. The page reads 'exp' from it, and nothing else.
//
function tokenExpiring(exp) {
    const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

    return `${part({ alg: 'RS256', kid: 'key' })}.${part({ sub: 'a-reader', exp: exp })}.signature`;
}

// 2026-09-27T01:00:00Z
const EXPIRES = 1790470800;
const TOKEN = tokenExpiring(EXPIRES);

describe('API access', () => {
    //
    // the reader's ID token, for calling the account api from a script. Hidden until
    // asked for, read fresh when it is, held only while it shows, and offered only to
    // a reader who is signed in.
    //
    const heading = () => screen.queryByRole('heading', { level: 4, name: 'API access' });
    const shown = () => document.querySelector('.account-token');

    //
    // the page for a signed-in reader, with the section drawn
    //
    async function renderSignedIn() {
        signedIn.mockResolvedValue(true);
        listSubscriptions.mockResolvedValue([]);
        readerToken.mockResolvedValue(TOKEN);

        renderSettings();

        await screen.findByRole('heading', { level: 4, name: 'API access' });
        await screen.findByRole('link', { name: 'Stream' });
    }

    async function showToken() {
        fireEvent.click(screen.getByRole('button', { name: 'Show token' }));
        await waitFor(() => expect(shown()).not.toBeNull());
    }

    afterEach(() => {
        delete navigator.clipboard;
    });

    it('is not offered to a reader who is signed out', async () => {
        signedIn.mockResolvedValue(false);
        listSubscriptions.mockResolvedValue(null);

        renderSettings();

        await screen.findByRole('link', { name: 'Sign in' });
        expect(heading()).toBeNull();
        expect(screen.queryByRole('button', { name: 'Show token' })).toBeNull();
    });

    it('keeps the token hidden until it is asked for', async () => {
        await renderSignedIn();

        expect(shown()).toBeNull();
        expect(document.body.textContent).not.toContain(TOKEN);
        expect(readerToken).not.toHaveBeenCalled();
    });

    it('reads a current token when asked, and shows it', async () => {
        await renderSignedIn();
        await showToken();

        expect(shown()).toHaveTextContent(TOKEN);
        expect(readerToken).toHaveBeenCalledTimes(1);
    });

    it('warns that the token is as good as a password', async () => {
        await renderSignedIn();

        expect(within(heading().parentElement).getByText(/Treat it like a password/))
            .toHaveTextContent('anyone holding it can act as you on the account API until it expires');
    });

    it('links the account api\'s page, which says how to use it', async () => {
        await renderSignedIn();

        expect(within(heading().parentElement).getByRole('link', { name: 'account API' }))
            .toHaveAttribute('href', 'https://jeff1evesque.github.io/jefflevesque.com/api/account/');
    });

    it('copies the token to the clipboard', async () => {
        const writeText = jest.fn(() => Promise.resolve());

        navigator.clipboard = { writeText: writeText };

        await renderSignedIn();
        await showToken();

        fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

        expect(await screen.findByRole('status')).toHaveTextContent('Copied.');
        expect(writeText).toHaveBeenCalledWith(TOKEN);
    });

    it.each([
        ['a clipboard that refuses', () => { navigator.clipboard = { writeText: () => Promise.reject(new Error('denied')) }; }],
        ['no clipboard at all', () => {}],
    ])('says to copy it by hand, with %s', async (name, arrange) => {
        arrange();

        await renderSignedIn();
        await showToken();

        fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Select it, and copy it yourself.');
    });

    it('says when it expires, in local time, read from the token itself', async () => {
        await renderSignedIn();
        await showToken();

        const local = new Date(EXPIRES * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

        expect(document.querySelector('.account-token-expiry')).toHaveTextContent(`Expires ${local}`);
    });

    it('says so when it cannot read the expiry from the token', async () => {
        await renderSignedIn();
        readerToken.mockResolvedValue('not-a-token');
        await showToken();

        expect(document.querySelector('.account-token-expiry'))
            .toHaveTextContent('When it expires could not be read from it.');
    });

    it('hides it again, and reads a fresh one the next time it is asked for', async () => {
        await renderSignedIn();
        await showToken();

        fireEvent.click(screen.getByRole('button', { name: 'Hide' }));

        expect(shown()).toBeNull();
        expect(document.body.textContent).not.toContain(TOKEN);

        await showToken();

        expect(readerToken).toHaveBeenCalledTimes(2);
    });

    it('keeps it in no storage', async () => {
        await renderSignedIn();
        await showToken();

        const stored = [localStorage, sessionStorage].flatMap((storage) => Object.keys(storage)
            .map((key) => `${key}=${storage.getItem(key)}`));

        stored.forEach((entry) => expect(entry).not.toContain(TOKEN));
    });

    it('is taken away when the session has ended by the time the token is asked for', async () => {
        await renderSignedIn();
        readerToken.mockResolvedValue(null);

        fireEvent.click(screen.getByRole('button', { name: 'Show token' }));

        await waitFor(() => expect(heading()).toBeNull());
    });

    it('is taken away when the subscriptions come back signed out', async () => {
        signedIn.mockResolvedValue(true);
        listSubscriptions.mockResolvedValue(null);

        renderSettings();

        await screen.findByRole('link', { name: 'Sign in' });
        await waitFor(() => expect(heading()).toBeNull());
    });
});

describe('expiryOf', () => {
    it('reads the expiry from the token\'s claims', () => {
        expect(expiryOf(TOKEN)).toEqual(new Date(EXPIRES * 1000));
    });

    it('reads claims whose base64url needs padding, and holds - and _', () => {
        //
        // base64url drops the padding and swaps '+' and '/' for '-' and '_'
        //
        const claims = { exp: EXPIRES, name: '>>>???' };
        const part = Buffer.from(JSON.stringify(claims)).toString('base64url');

        expect(part).toMatch(/[-_]/);
        expect(expiryOf(`header.${part}.signature`)).toEqual(new Date(EXPIRES * 1000));
    });

    it.each([
        ['no claims at all', 'no-dots'],
        ['claims that are not json', 'a.bm90IGpzb24.c'],
        ['claims with no expiry', `a.${Buffer.from('{"sub":"x"}').toString('base64url')}.c`],
        ['nothing', undefined],
    ])('is null for %s', (name, token) => {
        expect(expiryOf(token)).toBeNull();
    });
});

describe('what the pages do NOT do', () => {
    it('the profile page ignores every prop it is given', () => {
        //
        // the route is '/:user', so the username is available in the url -- but the
        // page reads neither params nor props, so it renders the same whoever's
        // profile was asked for
        //
        const { container: bare } = render(<AccountLayout />);
        const { container: withProps } = render(
            <AccountLayout user={{ name: 'jeff' }} effects={{ spinner: true }} />
        );

        expect(withProps.innerHTML).toBe(bare.innerHTML);
    });

    it('the settings page ignores every prop it is given, reading the reader from the token', () => {
        const { container: bare } = renderSettings();
        const { container: withProps } = renderSettings({ user: { name: 'jeff' }, effects: { spinner: true } });

        expect(withProps.innerHTML).toBe(bare.innerHTML);
        expect(listSubscriptions).toHaveBeenCalledWith();
    });

    it('the profile page never shows the error fallback for its own content', () => {
        render(<AccountLayout />);

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.queryByText('Something went wrong:')).not.toBeInTheDocument();
    });

    it.each([
        ['AccountLayout', () => render(<AccountLayout />), 'My Profile', 'Content'],
        ['SettingsLayout', () => renderSettings(), 'My Settings', 'Alarm subscriptions'],
    ])('%s keeps its heading outside the error boundary', (label, draw, heading, body) => {
        //
        // the boundary wraps the body only, so a failure there replaces the body and
        // leaves the visitor with a titled page rather than a blank one
        //
        const { container } = draw();
        const title = screen.getByRole('heading', { level: 1, name: heading });

        expect(container.querySelector('.account')).toContainElement(title);
        expect(title.nextSibling).toHaveTextContent(body);
    });
});

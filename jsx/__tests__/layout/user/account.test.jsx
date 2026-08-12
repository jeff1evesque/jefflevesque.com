/**
 * account.test.jsx: the two user-area placeholder pages.
 *
 * layout/user/ holds account.jsx (served at '/:user') and settings.jsx (served
 * at '/:user/settings'). Neither has been implemented: both render a heading and
 * the literal word 'Content'. They are worth pinning anyway, because '/:user'
 * is the catch-all single-segment route -- as route/main-route.jsx's own test
 * records, ANY unrecognised one-segment url lands on AccountLayout rather than
 * on the 404 page. Whatever these two render is what a visitor sees after a
 * mistyped link.
 *
 * Three things are recorded here that are easy to lose in a later rewrite:
 *
 *   - neither page reads props, so neither knows WHOSE profile it is showing;
 *   - the heading sits OUTSIDE the ErrorBoundary, so a future crash in the
 *     content leaves the heading and swaps only the body;
 *   - settings.jsx declares its class as 'AccountLayout' too, so both pages
 *     show up under the same name in React DevTools and in error output.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import AccountLayout from '../../../import/layout/user/account.jsx';
import SettingsLayout from '../../../import/layout/user/settings.jsx';

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
        render(<SettingsLayout />);

        expect(screen.getByRole('heading', { level: 1, name: 'My Settings' }))
            .toBeInTheDocument();
    });

    it('shows the same unimplemented placeholder body', () => {
        render(<SettingsLayout />);

        expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('is a copy of account.jsx down to the class name', () => {
        //
        // WORTH KNOWING: settings.jsx declares `class AccountLayout`, so both
        // modules export a component called AccountLayout. React DevTools, error
        // boundaries and stack traces cannot tell the two pages apart.
        //
        expect(SettingsLayout.name).toBe('AccountLayout');
        expect(AccountLayout.name).toBe('AccountLayout');
    });

    it('differs from the profile page only in its heading', () => {
        const { container: profile } = render(<AccountLayout />);
        const { container: settings } = render(<SettingsLayout />);

        expect(settings.innerHTML.replace('My Settings', 'My Profile'))
            .toBe(profile.innerHTML);
    });
});

describe('what the pages do NOT do', () => {
    it.each([
        ['AccountLayout', AccountLayout],
        ['SettingsLayout', SettingsLayout],
    ])('%s ignores every prop it is given', (label, Layout) => {
        //
        // the route is '/:user', so the username is available in the url -- but
        // neither page reads params or props, so both render identically no
        // matter whose profile was requested.
        //
        const { container: bare } = render(<Layout />);
        const { container: withProps } = render(
            <Layout user={{ name: 'jeff' }} effects={{ spinner: true }} />
        );

        expect(withProps.innerHTML).toBe(bare.innerHTML);
    });

    it.each([
        ['AccountLayout', AccountLayout],
        ['SettingsLayout', SettingsLayout],
    ])('%s never shows the error fallback for its own content', (label, Layout) => {
        render(<Layout />);

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.queryByText('Something went wrong:')).not.toBeInTheDocument();
    });

    it.each([
        ['AccountLayout', AccountLayout, 'My Profile'],
        ['SettingsLayout', SettingsLayout, 'My Settings'],
    ])('%s keeps its heading outside the error boundary', (label, Layout, heading) => {
        //
        // the boundary wraps the body only. That is the right shape for a page
        // whose content will eventually load remote data -- a failure there
        // replaces the body and leaves the visitor with a titled page rather
        // than a blank one -- but today it guards a static string and can never
        // trigger.
        //
        const { container } = render(<Layout />);
        const title = screen.getByRole('heading', { level: 1, name: heading });

        expect(container.querySelector('.account')).toContainElement(title);
        expect(title.nextSibling).toHaveTextContent('Content');
    });
});

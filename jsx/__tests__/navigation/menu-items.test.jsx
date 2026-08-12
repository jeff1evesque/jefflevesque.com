/**
 * menu-items.test.jsx: the three usable menu-item components.
 *
 * menu-items/ holds four files. Only three are tested here -- menu.jsx cannot be
 * imported at all, which is pinned separately in dead-modules.test.js.
 *
 * Two things worth knowing come out of these:
 *
 *   - 'activeclassname' is a leftover from react-router v5. In v6 the prop does
 *     nothing; the active class comes from NavLink itself. The lowercase spelling
 *     is why React never complains -- camelCase 'activeClassName' would have
 *     warned about an unknown DOM attribute and got noticed years ago.
 *
 *   - LoginLink's prop guards are vacuous. checkValidString takes a VALUE, but
 *     the call sites pass the KEY NAME as a string literal, so the check is
 *     always true and any supplied prop is used verbatim.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import HomeLink from '../../import/navigation/menu-items/home.jsx';
import LoginLink from '../../import/navigation/menu-items/login.jsx';
import RegisterLink from '../../import/navigation/menu-items/register.jsx';

function renderAt(ui, path = '/') {
    return render(
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    );
}

describe('HomeLink', () => {
    it('links to the site root', () => {
        renderAt(<HomeLink />);

        expect(screen.getByRole('link')).toHaveAttribute('href', '/');
    });

    it('renders the house icon rather than a text label', () => {
        renderAt(<HomeLink />);

        expect(screen.getByRole('link').textContent).toBe('');
        expect(screen.getByRole('link').querySelector('svg')).toBeInTheDocument();
    });

    it('gets its active class from react-router, not from activeclassname', () => {
        //
        // the component asks for activeclassname='active'; what actually adds
        // 'active' is NavLink v6, which appends it to the className string when
        // the route matches. Proof: the attribute is present on both renders,
        // but the class only appears on the matching one.
        //
        const { container: onHome } = renderAt(<HomeLink />, '/');
        const { container: elsewhere } = renderAt(<HomeLink />, '/stream');

        expect(onHome.querySelector('a')).toHaveClass('icon', 'home', 'active');
        expect(elsewhere.querySelector('a')).toHaveClass('icon', 'home');
        expect(elsewhere.querySelector('a')).not.toHaveClass('active');
    });

    it('passes activeclassname through to the dom as an inert attribute', () => {
        renderAt(<HomeLink />, '/stream');

        expect(screen.getByRole('link')).toHaveAttribute('activeclassname', 'active');
    });
});

describe('LoginLink defaults', () => {
    it('points at /login and reads "Login in"', () => {
        //
        // 'Login in' is the shipped label -- pinned as-is so a fix to the wording
        // is a deliberate one rather than a surprise.
        //
        renderAt(<LoginLink />);

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', '/login');
        expect(link).toHaveTextContent('Login in');
    });

    it('carries the btn classes used by the header', () => {
        renderAt(<LoginLink />);

        expect(screen.getByRole('link')).toHaveClass('btn', 'mn-2');
    });
});

describe('LoginLink props', () => {
    it('honours a supplied path and text', () => {
        renderAt(<LoginLink path='/login/reset' text='Forgot password' />);

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', '/login/reset');
        expect(link).toHaveTextContent('Forgot password');
    });

    it('accepts an empty string, because the validity guard never runs on the value', () => {
        //
        // DEFECT: the guard is
        //
        //     'text' in this.props && checkValidString('text', this.props)
        //
        // and checkValidString(value) tests its FIRST argument -- here the
        // literal 'text', a non-empty string, so it is always true. The value is
        // never inspected. An empty label therefore defeats the default instead
        // of falling back to it, and the link renders with no text at all.
        //
        renderAt(<LoginLink text='' />);

        expect(screen.getByRole('link')).toHaveTextContent('');
        expect(screen.getByRole('link')).not.toHaveTextContent('Login in');
    });

    it('ignores later prop changes, because the label is copied into state once', () => {
        //
        // path and text are read in the constructor and stored in state, and
        // nothing syncs them afterwards. A parent that re-renders this link with
        // a new label keeps showing the old one.
        //
        const { rerender } = renderAt(<LoginLink text='Login in' />);

        rerender(
            <MemoryRouter><LoginLink text='Sign in' /></MemoryRouter>
        );

        expect(screen.getByRole('link')).toHaveTextContent('Login in');
    });
});

describe('RegisterLink', () => {
    it('offers "Sign up" to an anonymous visitor', () => {
        renderAt(<RegisterLink user={{ name: 'anonymous' }} />);

        const link = screen.getByRole('link', { name: 'Sign up' });
        expect(link).toHaveAttribute('href', '/register');
        expect(link).toHaveClass('btn', 'btn-primary');
    });

    it('renders nothing for a signed-in user', () => {
        renderAt(<RegisterLink user={{ name: 'jeff' }} />);

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('renders nothing when it is given no user at all', () => {
        //
        // the guard is an equality test against 'anonymous', not a check for a
        // missing user, so the safe direction is the one taken: no user means no
        // sign-up prompt.
        //
        renderAt(<RegisterLink />);

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('renders an empty span rather than null when hidden', () => {
        //
        // worth pinning because the header lays these out inline: the hidden
        // state still occupies an element in the dom.
        //
        const { container } = renderAt(<RegisterLink user={{ name: 'jeff' }} />);

        expect(container.querySelector('span')).toBeInTheDocument();
    });
});

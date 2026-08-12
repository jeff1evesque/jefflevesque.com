/**
 * breadcrumbs.test.jsx: the breadcrumb trail rendered above stream content.
 *
 * BreadCrumbs is unusual in this codebase: it is rendered inside react-router
 * pages (trigger.jsx, alarm.jsx, trigger/content/candlestick.jsx) but reads
 * 'window.location.pathname' directly and emits plain '<a href>' links. So it
 * needs no router to render, and its links leave the SPA rather than navigating
 * through it. Both are pinned below, because neither is visible from the call
 * site.
 *
 * The trail is derived purely from the url -- there is no route table, no
 * titles, no labels. Whatever the path segment says is what the crumb says,
 * which is why the empty-segment cases matter: '/' and a trailing slash both
 * produce a crumb with no text at all.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import BreadCrumbs from '../../import/navigation/breadcrumbs.jsx';

function renderAt(pathname) {
    window.history.pushState({}, '', pathname);
    return render(<BreadCrumbs />);
}

function crumbs() {
    //
    // MUI puts the separators in their own <li aria-hidden='true'>, so the
    // accessible listitem query returns the crumbs alone.
    //
    return within(screen.getByRole('navigation', { name: 'breadcrumb' }))
        .getAllByRole('listitem');
}

afterEach(() => {
    window.history.pushState({}, '', '/');
});

describe('a nested path', () => {
    it('produces one crumb per path segment', () => {
        renderAt('/stream/trigger/candlestick');

        expect(crumbs().map(c => c.textContent))
            .toEqual(['stream', 'trigger', 'candlestick']);
    });

    it('links each ancestor to its own cumulative path', () => {
        renderAt('/stream/trigger/candlestick');

        expect(screen.getByRole('link', { name: 'stream' }))
            .toHaveAttribute('href', '/stream');
        expect(screen.getByRole('link', { name: 'trigger' }))
            .toHaveAttribute('href', '/stream/trigger');
    });

    it('leaves the current page as plain text rather than a link', () => {
        renderAt('/stream/trigger/candlestick');

        expect(screen.getByText('candlestick')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'candlestick' })).not.toBeInTheDocument();
    });

    it('links only the ancestors, so a two-segment path has exactly one link', () => {
        renderAt('/stream/trigger');

        expect(screen.getAllByRole('link')).toHaveLength(1);
    });
});

describe('paths with an empty final segment', () => {
    it('renders a single empty crumb at the site root', () => {
        //
        // '/'.split('/').slice(1) is [''] -- one segment, and it is the last, so
        // it renders as a Typography with no text. The breadcrumb bar on the
        // home page is therefore an empty row rather than nothing at all.
        //
        renderAt('/');

        const [only] = crumbs();
        expect(crumbs()).toHaveLength(1);
        expect(only).toHaveTextContent('');
        expect(screen.queryAllByRole('link')).toHaveLength(0);
    });

    it('a trailing slash hides the name of the page you are on', () => {
        //
        // WORTH KNOWING: '/stream/' splits to ['stream', ''], so the empty
        // string becomes the current-page crumb and 'stream' -- the page the
        // visitor is actually looking at -- is demoted to a link back to
        // itself.
        //
        renderAt('/stream/');

        expect(crumbs().map(c => c.textContent)).toEqual(['stream', '']);
        expect(screen.getByRole('link', { name: 'stream' }))
            .toHaveAttribute('href', '/stream');
    });
});

describe('how it reads the url', () => {
    it('renders with no router in the tree at all', () => {
        //
        // it never touches router context, so it cannot be broken by being
        // mounted outside a <Router> -- and equally it never learns about a
        // client-side navigation except by being re-rendered.
        //
        window.history.pushState({}, '', '/data/append');

        expect(() => render(<BreadCrumbs />)).not.toThrow();
        expect(crumbs().map(c => c.textContent)).toEqual(['data', 'append']);
    });

    it('re-reads window.location on every render rather than caching it', () => {
        const { rerender } = renderAt('/data');

        window.history.pushState({}, '', '/model/generate');
        rerender(<BreadCrumbs />);

        expect(crumbs().map(c => c.textContent)).toEqual(['model', 'generate']);
    });

    it('emits plain anchors, so an ancestor crumb costs a full page load', () => {
        //
        // every other link in the app is a react-router NavLink/Link. these are
        // MUI Links with a bare href, so following one unmounts the SPA and
        // reloads it from the server.
        //
        renderAt('/stream/trigger');

        const link = screen.getByRole('link', { name: 'stream' });
        expect(link.tagName).toBe('A');
        expect(link).toHaveAttribute('href');
    });
});

describe('duplicated segments', () => {
    it('renders both crumbs when a segment repeats', () => {
        //
        // the crumbs are keyed by title (key={b.title}), so '/data/data' hands
        // React two children with the same key. MUI re-keys the children when it
        // interleaves the separators, which is the only reason this does not
        // warn -- the trail itself still renders correctly.
        //
        renderAt('/data/data');

        expect(crumbs().map(c => c.textContent)).toEqual(['data', 'data']);
        expect(screen.getByRole('link', { name: 'data' }))
            .toHaveAttribute('href', '/data');
    });
});

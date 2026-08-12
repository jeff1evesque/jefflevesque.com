/**
 * reducer.test.js: the five redux reducers.
 *
 * These are pure functions and the app's whole state machine, so they are the
 * cheapest thing in the codebase to hold still -- and the easiest place for a
 * wrong default to go unnoticed, because a reducer never throws.
 *
 * Three behaviours below are labelled as defects or quirks rather than contracts.
 * The most consequential is 'article', which ignores action.type entirely: it
 * rebuilds its whole slice on EVERY dispatched action, so an unrelated action
 * resets it. The others concern the string initial states, which produce
 * character-indexed keys when spread.
 */

import article from '../../import/redux/reducer/article.jsx';
import hide from '../../import/redux/reducer/hide.jsx';
import layout from '../../import/redux/reducer/layout.jsx';
import page from '../../import/redux/reducer/page.jsx';
import user from '../../import/redux/reducer/login.jsx';

describe('user (login)', () => {
    it('records the username on LOGGED-IN', () => {
        expect(user({}, { type: 'LOGGED-IN', user: { name: 'jeff' } }))
            .toEqual({ name: 'jeff' });
    });

    it('falls back to anonymous when LOGGED-IN carries no name', () => {
        expect(user({}, { type: 'LOGGED-IN', user: {} }))
            .toEqual({ name: 'anonymous' });
        expect(user({}, { type: 'LOGGED-IN' }))
            .toEqual({ name: 'anonymous' });
    });

    it('clears the username on LOGGED-OUT', () => {
        expect(user({ name: 'jeff' }, { type: 'LOGGED-OUT' }))
            .toEqual({ name: 'anonymous' });
    });

    it('ignores the supplied name on LOGGED-OUT', () => {
        //
        // logging out must not be able to log somebody else in.
        //
        expect(user({ name: 'jeff' }, { type: 'LOGGED-OUT', user: { name: 'other' } }))
            .toEqual({ name: 'anonymous' });
    });

    it('preserves unrelated keys in its slice', () => {
        expect(user({ extra: 1 }, { type: 'LOGGED-IN', user: { name: 'jeff' } }))
            .toEqual({ extra: 1, name: 'jeff' });
    });

    it('returns the state untouched for an unrelated action', () => {
        const state = { name: 'jeff' };

        expect(user(state, { type: 'SET-SPINNER', spinner: true })).toBe(state);
    });

    it('returns the STRING default when no state is supplied', () => {
        //
        // QUIRK worth knowing: the default parameter is the string 'anonymous', not
        // an object, and the default switch branch returns it as-is. So an
        // uninitialised slice is the string 'anonymous' and 'state.user.name' is
        // undefined rather than 'anonymous'.
        //
        // store.jsx preloads { user: { name: ... } }, which hides this -- but a
        // reducer combined without that preload would surprise its consumer.
        //
        expect(user(undefined, { type: 'UNKNOWN' })).toBe('anonymous');
    });
});

describe('layout', () => {
    it.each([
        ['login', 'login'],
        ['register', 'register'],
        ['analysis', 'analysis-container'],
    ])('maps the %s layout to its css class', (name, css) => {
        expect(layout({}, { type: 'SET-LAYOUT', layout: name }))
            .toEqual({ css, type: name });
    });

    it('ignores an unknown layout name', () => {
        const state = { css: 'login', type: 'login' };

        expect(layout(state, { type: 'SET-LAYOUT', layout: 'nonsense' })).toBe(state);
    });

    it('requires the SET-LAYOUT type, not just a layout key', () => {
        //
        // both the type and the payload are checked, so an action carrying a
        // 'layout' key for some other purpose cannot reshape the page.
        //
        const state = { css: 'login' };

        expect(layout(state, { layout: 'register' })).toBe(state);
        expect(layout(state, { type: 'SOMETHING-ELSE', layout: 'register' })).toBe(state);
    });

    it('tolerates a missing or empty action', () => {
        const state = { css: 'login' };

        expect(layout(state, {})).toBe(state);
        expect(layout(state, null)).toBe(state);
    });

    it('preserves unrelated keys', () => {
        expect(layout({ extra: 1 }, { type: 'SET-LAYOUT', layout: 'login' }))
            .toEqual({ extra: 1, css: 'login', type: 'login' });
    });
});

describe('page', () => {
    it('sets the content type', () => {
        expect(page({}, { type: 'SET-CONTENT-TYPE', content_type: 'stream' }))
            .toEqual({ content_type: 'stream' });
    });

    it('sets the spinner without discarding other effects', () => {
        //
        // effects is nested, so a shallow spread would drop its siblings. The
        // spinner is toggled constantly, so losing a neighbour here would be
        // frequent and hard to trace.
        //
        expect(page({ effects: { modal: true } }, { type: 'SET-SPINNER', spinner: true }))
            .toEqual({ effects: { modal: true, spinner: true } });
    });

    it('turns the spinner off again', () => {
        expect(page({ effects: { spinner: true } }, { type: 'SET-SPINNER', spinner: false }))
            .toEqual({ effects: { spinner: false } });
    });

    it('creates the effects object when there is none', () => {
        expect(page({}, { type: 'SET-SPINNER', spinner: true }))
            .toEqual({ effects: { spinner: true } });
    });

    it('returns the state untouched for an unrelated action', () => {
        const state = { content_type: 'stream' };

        expect(page(state, { type: 'LOGGED-IN' })).toBe(state);
    });

    it('throws on a missing action', () => {
        //
        // DOCUMENTS A LIMIT: unlike 'layout', this reducer reads action.type with no
        // guard, so a dispatch with no action object at all raises. Redux always
        // supplies one, so this is unreachable through the store.
        //
        expect(() => page({}, undefined)).toThrow();
    });
});

describe('hide', () => {
    it('records hide_all when it is a real boolean', () => {
        expect(hide({}, { hide_all: true })).toEqual({ hide_all: true });
        expect(hide({}, { hide_all: false })).toEqual({ hide_all: false });
    });

    it('records hide_graph independently', () => {
        expect(hide({}, { hide_graph: true })).toEqual({ hide_graph: true });
    });

    it('records both at once', () => {
        expect(hide({}, { hide_all: true, hide_graph: false }))
            .toEqual({ hide_all: true, hide_graph: false });
    });

    it('ignores a truthy non-boolean', () => {
        //
        // it validates through checkValidBool rather than truthiness, so the string
        // 'true' and 1 are both refused. That matters because these flags come from
        // query strings and checkboxes, where a string is easy to pass by accident.
        //
        expect(hide({}, { hide_all: 'true' })).toEqual({});
        expect(hide({}, { hide_all: 1 })).toEqual({});
        expect(hide({}, { hide_graph: 'false' })).toEqual({});
    });

    it('leaves existing flags alone when the action carries none', () => {
        expect(hide({ hide_all: true }, { type: 'SOMETHING' }))
            .toEqual({ hide_all: true });
    });

    it('overwrites only the flag the action names', () => {
        expect(hide({ hide_all: true, hide_graph: true }, { hide_graph: false }))
            .toEqual({ hide_all: true, hide_graph: false });
    });

    it('tolerates a null action', () => {
        expect(hide({ hide_all: true }, null)).toEqual({ hide_all: true });
    });

    it('returns a new object rather than mutating', () => {
        const state = { hide_all: true };

        expect(hide(state, { hide_graph: true })).not.toBe(state);
        expect(state).toEqual({ hide_all: true });
    });
});

describe('article', () => {
    it('records the fields the action supplies', () => {
        const result = article({}, {
            article: { type: 'earnings', ticker: 'AAPL', clicked: true },
        });

        expect(result.type).toBe('earnings');
        expect(result.ticker).toBe('AAPL');
        expect(result.clicked).toBe(true);
    });

    it('defaults every unsupplied field', () => {
        const result = article({}, { article: {} });

        expect(result).toEqual({
            type: 'general',
            ticker: null,
            date: null,
            clicked: false,
            started_on: 'n/a',
            completed_on: 'n/a',
            retry: 'n/a',
            expected_runtime: 'n/a',
            actual_runtime: 'n/a',
        });
    });

    //
    // DOCUMENTS A DEFECT.
    //
    // Every other reducer here switches on action.type and returns state untouched
    // for anything it does not recognise. This one has no switch at all: it
    // rebuilds its entire slice on EVERY action that reaches the store, defaulting
    // any field the action does not carry.
    //
    // So dispatching an unrelated action -- SET-SPINNER, which fires on every
    // load -- silently resets the article slice. Whatever was selected is lost,
    // with no error.
    //
    // The fix is to switch on a type as the others do. When that lands, these two
    // should assert the state survives.
    //
    it('resets its whole slice on an unrelated action', () => {
        const state = { type: 'earnings', ticker: 'AAPL', clicked: true };

        const result = article(state, { type: 'SET-SPINNER', spinner: true });

        expect(result.type).toBe('general');
        expect(result.ticker).toBeNull();
        expect(result.clicked).toBe(false);
    });

    it('cannot preserve a selection across any dispatch', () => {
        const selected = article({}, { article: { ticker: 'MSFT', clicked: true } });

        const afterUnrelated = article(selected, { type: 'LOGGED-IN' });

        expect(selected.ticker).toBe('MSFT');
        expect(afterUnrelated.ticker).toBeNull();
    });
});

describe('the string initial states', () => {
    it('spread into character-indexed keys', () => {
        //
        // QUIRK, shared by article, hide and page: the default parameter is a
        // STRING ('default'), and spreading a string yields its characters under
        // numeric keys. So an uninitialised slice carries 0:'d', 1:'e', ... beside
        // the real fields.
        //
        // Harmless in practice, because store.jsx preloads the slices it cares
        // about and nothing reads a numeric key. Recorded because it makes a
        // reducer's output surprising to anyone inspecting it, and because an
        // object default would be free.
        //
        const result = article(undefined, { article: {} });

        expect(result[0]).toBe('d');
        expect(result[6]).toBe('t');
        expect(result.type).toBe('general');
    });

    it('hide does the same', () => {
        const result = hide(undefined, { hide_all: true });

        expect(result[0]).toBe('d');
        expect(result.hide_all).toBe(true);
    });
});

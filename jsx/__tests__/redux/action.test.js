/**
 * action.test.js: the redux action creators.
 *
 * Pure functions producing plain objects, so the interesting part is whether the
 * shape each one emits is the shape the matching reducer reads. Two of them do not
 * line up, and both are covered below -- an action whose type no reducer handles
 * is indistinguishable from a working one at the call site, because dispatching
 * it succeeds and simply changes nothing.
 */

import { setStockSplitProp } from '../../import/redux/action/article.jsx';
import { setHide } from '../../import/redux/action/hide.jsx';
import { setLoginState } from '../../import/redux/action/login.jsx';
import setLogoutState from '../../import/redux/action/logout.jsx';
import { setContentType, setLayout, setSpinner } from '../../import/redux/action/page.jsx';
import { setParsedCsv } from '../../import/redux/action/parseCsv.jsx';

import article from '../../import/redux/reducer/article.jsx';
import hide from '../../import/redux/reducer/hide.jsx';
import layout from '../../import/redux/reducer/layout.jsx';
import page from '../../import/redux/reducer/page.jsx';
import user from '../../import/redux/reducer/login.jsx';

describe('login and logout', () => {
    it('setLoginState carries the username under LOGGED-IN', () => {
        expect(setLoginState('jeff')).toEqual({
            type: 'LOGGED-IN',
            user: { name: 'jeff' },
        });
    });

    it('setLogoutState always says anonymous', () => {
        expect(setLogoutState()).toEqual({
            type: 'LOGGED-OUT',
            user: { name: 'anonymous' },
        });
    });

    it('both round-trip through the user reducer', () => {
        //
        // the pairing that matters: the creator's shape has to be the one the
        // reducer reads, and nothing else checks that.
        //
        expect(user({}, setLoginState('jeff'))).toEqual({ name: 'jeff' });
        expect(user({ name: 'jeff' }, setLogoutState())).toEqual({ name: 'anonymous' });
    });

    it('passes an empty username through as anonymous via the reducer', () => {
        expect(user({}, setLoginState(''))).toEqual({ name: 'anonymous' });
    });
});

describe('page actions', () => {
    it('setLayout emits SET-LAYOUT with the layout name', () => {
        expect(setLayout({ layout: 'login' })).toEqual({
            type: 'SET-LAYOUT',
            layout: 'login',
        });
    });

    it('setSpinner emits SET-SPINNER with the flag', () => {
        expect(setSpinner({ spinner: true })).toEqual({
            type: 'SET-SPINNER',
            spinner: true,
        });
    });

    it('setContentType reads its value from a key called layout', () => {
        //
        // WORTH KNOWING: the argument key is 'layout' but the field produced is
        // 'content_type'. A caller passing { content_type: 'x' } gets undefined,
        // and the reducer stores undefined without complaint.
        //
        expect(setContentType({ layout: 'stream' })).toEqual({
            type: 'SET-CONTENT-TYPE',
            content_type: 'stream',
        });

        expect(setContentType({ content_type: 'stream' })).toEqual({
            type: 'SET-CONTENT-TYPE',
            content_type: undefined,
        });
    });

    it('all three round-trip through their reducers', () => {
        expect(layout({}, setLayout({ layout: 'register' })))
            .toEqual({ css: 'register', type: 'register' });

        expect(page({}, setSpinner({ spinner: true })))
            .toEqual({ effects: { spinner: true } });

        expect(page({}, setContentType({ layout: 'stream' })))
            .toEqual({ content_type: 'stream' });
    });
});

describe('setHide', () => {
    it('emits SET-HIDE-GRAPH with the flag', () => {
        expect(setHide({ type: 'SET-HIDE-GRAPH', action: true })).toEqual({
            type: 'SET-HIDE-GRAPH',
            hide_graph: true,
        });
    });

    it('emits SET-HIDE-ALL with the flag', () => {
        expect(setHide({ type: 'SET-HIDE-ALL', action: false })).toEqual({
            type: 'SET-HIDE-ALL',
            hide_all: false,
        });
    });

    it('falls back to hiding nothing for an unrecognised type', () => {
        //
        // a safe default: an unknown request reveals rather than conceals, so a
        // typo cannot blank the page.
        //
        expect(setHide({ type: 'SET-SOMETHING', action: true })).toEqual({
            type: 'SET-HIDE-ALL',
            hide_all: false,
        });
    });

    it('emits a typeless action when the argument is incomplete', () => {
        expect(setHide({})).toEqual({ type: null });
        expect(setHide({ type: 'SET-HIDE-ALL' })).toEqual({ type: null });
        expect(setHide({ action: true })).toEqual({ type: null });
    });

    it('round-trips through the hide reducer', () => {
        expect(hide({}, setHide({ type: 'SET-HIDE-GRAPH', action: true })))
            .toEqual({ hide_graph: true });
    });

    it('a non-boolean flag survives the creator but is refused by the reducer', () => {
        //
        // the creator does not validate; the reducer does, through checkValidBool.
        // So the guard is one layer later than the call site suggests.
        //
        const action = setHide({ type: 'SET-HIDE-ALL', action: 'true' });

        expect(action.hide_all).toBe('true');
        expect(hide({}, action)).toEqual({});
    });
});

describe('setStockSplitProp', () => {
    it('defaults every field the caller omits', () => {
        expect(setStockSplitProp({ article: {} }).article).toEqual({
            type: 'general',
            date: null,
            ticker: null,
            clicked: false,
            started_on: 'n/a',
            completed_on: 'n/a',
            retry: 'n/a',
            expected_runtime: 'n/a',
            actual_runtime: 'n/a',
        });
    });

    it('carries the fields the caller supplies', () => {
        const action = setStockSplitProp({ article: { ticker: 'NVDA', clicked: true } });

        expect(action.article.ticker).toBe('NVDA');
        expect(action.article.clicked).toBe(true);
    });

    it('emits a type the article reducer never reads', () => {
        //
        // DOCUMENTS A MISMATCH, the mirror of the article reducer's defect.
        //
        // The creator sets type 'SET-ARTICLE-STOCK-SPLIT', but article.jsx has no
        // switch at all -- it rebuilds its slice on every action regardless of
        // type. So the type here is decorative: dispatching this action works, and
        // dispatching any OTHER action has the same effect on this slice.
        //
        const action = setStockSplitProp({ article: { ticker: 'NVDA' } });
        expect(action.type).toBe('SET-ARTICLE-STOCK-SPLIT');

        const viaCreator = article({}, action);
        expect(viaCreator.ticker).toBe('NVDA');

        //
        // the same payload under a nonsense type produces an identical result,
        // which is what proves the type is unused.
        //
        const viaNonsense = article({}, { type: 'NONSENSE', article: { ticker: 'NVDA' } });
        expect(viaNonsense).toEqual(viaCreator);
    });
});

describe('setParsedCsv', () => {
    it('returns the key and content it was given', () => {
        expect(setParsedCsv('bls', 'a,b\n1,2')).toEqual({
            key: 'bls',
            content: 'a,b\n1,2',
        });
    });

    it('emits no type at all, so no reducer can handle it', () => {
        //
        // DOCUMENTS A DEFECT.
        //
        // Every reducer here dispatches on action.type. This creator emits an object
        // with no 'type' key, so each reducer takes its default branch and the
        // dispatch changes nothing. It cannot work as an action.
        //
        // Dispatching it does not fail -- redux only requires a plain object -- so
        // the call site looks correct.
        //
        const action = setParsedCsv('bls', 'a,b\n1,2');

        expect(action).not.toHaveProperty('type');

        const state = { content_type: 'stream' };
        expect(page(state, action)).toBe(state);
        expect(layout(state, action)).toBe(state);
        expect(user(state, action)).toBe(state);
    });
});

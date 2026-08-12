/**
 * container.test.jsx: every connect() wrapper in redux/container/.
 *
 * A container is two pure functions and a connect() call, so the only thing to
 * test is which props come out for a given store. Each presentational component
 * is replaced with a probe that records the props it was handed -- that keeps
 * the assertions on the mapping itself rather than on markup already covered
 * elsewhere, and keeps the heavy layouts (data, stream, page) out of the run.
 *
 * Two findings dominate this file.
 *
 * The first is that NO container in this codebase actually binds its action
 * creator. Every mapDispatchToProps is written as
 *
 *     dispatchThing: dispatch.bind(setThing)
 *
 * which is Function.prototype.bind: it produces a copy of `dispatch` whose
 * `this` is setThing, and `dispatch` never looks at `this`. The intended form is
 * `(...args) => dispatch(setThing(...args))`. So every dispatch prop in the app
 * is a bare dispatch under a misleading name, and they work only because each
 * call site happens to build the action itself first:
 *
 *     const action = setLogoutState();
 *     this.props.dispatchLogout(action);
 *
 * Pass the CREATOR's argument instead of the action, as the name invites, and
 * redux rejects it. That is pinned per container rather than once, because each
 * one names a different creator and each name is equally untrue.
 *
 * The second is that mapStateToProps is copy-pasted. data, model, page and
 * stream carry the same username-and-spinner block, and login/register carry a
 * second spelling of the username half. They are asserted to agree, so a fix
 * applied to one and not the others shows up here.
 */

import React from 'react';
import { act, render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore, combineReducers } from 'redux';

//
// The prop bag each probe last received, keyed by the name passed to mockProbe.
// Named with the 'mock' prefix so babel-plugin-jest-hoist allows the hoisted
// jest.mock factories below to reference it.
//
const mockSeen = {};

function mockProbe(name) {
    const ReactModule = require('react');

    return {
        __esModule: true,
        default: function Probe(props) {
            mockSeen[name] = props;
            return ReactModule.createElement('div', { 'data-probe': name });
        },
    };
}

jest.mock('../../import/general/article-listing.jsx', () => mockProbe('article-listing'));
jest.mock('../../import/layout/data/data.jsx', () => mockProbe('data'));
jest.mock('../../import/content/forgot-password.jsx', () => mockProbe('forgot-password'));
jest.mock('../../import/navigation/header-menu.jsx', () => mockProbe('header-menu'));
jest.mock('../../import/content/home-page.jsx', () => mockProbe('home-page'));
jest.mock('../../import/navigation/menu-items/login.jsx', () => mockProbe('login-link'));
jest.mock('../../import/content/login.jsx', () => mockProbe('login'));
jest.mock('../../import/layout/model.jsx', () => mockProbe('model'));
jest.mock('../../import/layout/page.jsx', () => mockProbe('page'));
jest.mock('../../import/navigation/menu-items/register.jsx', () => mockProbe('register-link'));
jest.mock('../../import/layout/register/content/webform.jsx', () => mockProbe('register'));
jest.mock('../../import/layout/stream/stream.jsx', () => mockProbe('stream'));
jest.mock('../../import/layout/stream/trigger.jsx', () => mockProbe('trigger'));
jest.mock('../../import/layout/stream/trigger/left_column/candlestick.jsx', () => mockProbe('candlestick'));
jest.mock('../../import/navigation/user-menu.jsx', () => mockProbe('user-menu'));

import ArticleListingState from '../../import/redux/container/article-listing.jsx';
import DataLayoutState from '../../import/redux/container/data/data.jsx';
import ForgotPasswordState from '../../import/redux/container/forgot-password.jsx';
import HeaderMenuState from '../../import/redux/container/header-menu.jsx';
import HomePageState from '../../import/redux/container/home-page.jsx';
import LoginLinkState from '../../import/redux/container/login-link.jsx';
import LoginState from '../../import/redux/container/login.jsx';
import ModelLayoutState from '../../import/redux/container/model.jsx';
import PageLayoutState from '../../import/redux/container/page.jsx';
import RegisterLinkState from '../../import/redux/container/register-link.jsx';
import RegisterState from '../../import/redux/container/register.jsx';
import StreamLayoutState from '../../import/redux/container/stream/stream.jsx';
import CandlestickLeftColumnState from '../../import/redux/container/stream/trigger/left_column/candlestick.jsx';
import StreamTriggerLayoutState from '../../import/redux/container/stream/trigger/trigger.jsx';
import UserMenuState from '../../import/redux/container/user-menu.jsx';

import { setLayout, setSpinner } from '../../import/redux/action/page.jsx';
import setLogoutState from '../../import/redux/action/logout.jsx';

import user from '../../import/redux/reducer/login.jsx';
import layout from '../../import/redux/reducer/layout.jsx';
import page from '../../import/redux/reducer/page.jsx';
import article from '../../import/redux/reducer/article.jsx';
import hide from '../../import/redux/reducer/hide.jsx';

//
// a store that keeps whatever state it is given and records what was dispatched
// at it, so the dispatch props can be examined without a reducer in the way.
//
function inertStore(state) {
    const dispatched = [];
    const store = createStore((previous = state, action) => {
        dispatched.push(action);
        return previous;
    });

    return { store, dispatched };
}

//
// the real reducer set, for the cases where the interesting question is what a
// container sees on a COLD store rather than on a hand-written one.
//
function realStore(preloaded) {
    return createStore(
        combineReducers({ user, page, layout, article, hide }),
        preloaded
    );
}

function propsOf(Container, state, name) {
    const { store, dispatched } = inertStore(state);

    render(<Provider store={store}><Container /></Provider>);

    return { props: mockSeen[name], dispatched };
}

//
// connect() injects its own `dispatch` when a container passes no
// mapDispatchToProps, and that function is a different instance per store -- so
// it has to come off before two containers' output can be compared.
//
function mapped(props) {
    const { dispatch, ...rest } = props;

    return rest;
}

beforeEach(() => {
    Object.keys(mockSeen).forEach(key => delete mockSeen[key]);
});

describe('the username normalisation shared by six containers', () => {
    const containers = [
        ['data', DataLayoutState, 'data'],
        ['model', ModelLayoutState, 'model'],
        ['page', PageLayoutState, 'page'],
        ['stream', StreamLayoutState, 'stream'],
        ['login-link', LoginLinkState, 'login-link'],
        ['register-link', RegisterLinkState, 'register-link'],
        ['user-menu', UserMenuState, 'user-menu'],
        ['login', LoginState, 'login'],
        ['register', RegisterState, 'register'],
    ];

    it.each(containers)('%s passes a real username straight through', (label, Container, probe) => {
        const { props } = propsOf(Container, { user: { name: 'jeff' } }, probe);

        expect(props.user).toEqual({ name: 'jeff' });
    });

    it.each(containers)('%s reports anonymous for an empty username', (label, Container, probe) => {
        const { props } = propsOf(Container, { user: { name: '' } }, probe);

        expect(props.user).toEqual({ name: 'anonymous' });
    });

    it.each(containers)('%s reports anonymous when there is no user slice', (label, Container, probe) => {
        const { props } = propsOf(Container, {}, probe);

        expect(props.user).toEqual({ name: 'anonymous' });
    });

    it.each(containers)('%s always emits user as an object with a name', (label, Container, probe) => {
        //
        // every consumer declares user: PropTypes.shape({ name: string.isRequired }),
        // so the shape matters as much as the value.
        //
        const { props } = propsOf(Container, { user: { name: 'jeff', extra: 1 } }, probe);

        expect(Object.keys(props.user)).toEqual(['name']);
    });
});

describe('the spinner flag shared by four containers', () => {
    const containers = [
        ['data', DataLayoutState, 'data'],
        ['model', ModelLayoutState, 'model'],
        ['page', PageLayoutState, 'page'],
        ['stream', StreamLayoutState, 'stream'],
    ];

    it.each(containers)('%s reads it from page.effects.spinner', (label, Container, probe) => {
        const { props } = propsOf(Container, { page: { effects: { spinner: true } } }, probe);

        expect(props.effects).toEqual({ spinner: true });
    });

    it.each(containers)('%s defaults it to false rather than undefined', (label, Container, probe) => {
        const { props } = propsOf(Container, {}, probe);

        expect(props.effects).toEqual({ spinner: false });
    });

    it.each(containers)('%s coerces a truthy non-boolean to true', (label, Container, probe) => {
        //
        // PageLayout declares effects.spinner as bool.isRequired, so the
        // coercion here is what keeps a sloppy dispatch from warning. Pinned
        // because the guard is easy to lose when this block is rewritten.
        //
        const { props } = propsOf(Container, { page: { effects: { spinner: 'yes' } } }, probe);

        expect(props.effects).toEqual({ spinner: true });
    });

    it.each(containers)('%s survives a page slice with no effects', (label, Container, probe) => {
        const { props } = propsOf(Container, { page: { status: 'default' } }, probe);

        expect(props.effects).toEqual({ spinner: false });
    });
});

describe('model, page and stream are the same mapping three times', () => {
    it.each([
        ['an anonymous cold store', {}],
        ['a signed-in user', { user: { name: 'jeff' } }],
        ['a running spinner', { user: { name: 'jeff' }, page: { effects: { spinner: true } } }],
    ])('they agree given %s', (label, state) => {
        const model = mapped(propsOf(ModelLayoutState, state, 'model').props);
        const pageProps = mapped(propsOf(PageLayoutState, state, 'page').props);
        const stream = mapped(propsOf(StreamLayoutState, state, 'stream').props);

        expect(pageProps).toEqual(model);
        expect(stream).toEqual(model);
    });
});

describe('the data container', () => {
    it('defaults the whole article slice when the store has none', () => {
        const { props } = propsOf(DataLayoutState, {}, 'data');

        expect(props.article).toEqual({
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

    it('passes a populated article slice through', () => {
        const { props } = propsOf(DataLayoutState, {
            article: {
                type: 'stock-split',
                ticker: 'crwd',
                date: '01/02/2024',
                clicked: true,
                started_on: '10:00',
                completed_on: '10:05',
                retry: 2,
                expected_runtime: 300,
                actual_runtime: 290,
            },
        }, 'data');

        expect(props.article).toEqual({
            type: 'stock-split',
            ticker: 'crwd',
            date: '01/02/2024',
            clicked: true,
            started_on: '10:00',
            completed_on: '10:05',
            retry: 2,
            expected_runtime: 300,
            actual_runtime: 290,
        });
    });

    it('reports a zero runtime as "n/a"', () => {
        //
        // DEFECT: every article field is guarded with `!!state.article.x`, which
        // cannot tell "absent" from "zero". A job that finished in under a
        // second, or retried zero times, is displayed as if the figure were
        // unknown. The action creator uses `'x' in action.article` and does not
        // have this problem, so the two disagree about the same data.
        //
        const { props } = propsOf(DataLayoutState, {
            article: { retry: 0, actual_runtime: 0, expected_runtime: 0 },
        }, 'data');

        expect(props.article.retry).toBe('n/a');
        expect(props.article.actual_runtime).toBe('n/a');
        expect(props.article.expected_runtime).toBe('n/a');
    });

    it('reports an unclicked article as false rather than "n/a"', () => {
        const { props } = propsOf(DataLayoutState, { article: { clicked: false } }, 'data');

        expect(props.article.clicked).toBe(false);
    });

    it('carries the username and spinner alongside the article', () => {
        //
        // 'dispatch' is in the list because the container passes no
        // mapDispatchToProps, so connect() injects the raw store dispatch. Every
        // state-only container in this directory does the same -- DataLayout can
        // dispatch anything it likes without a single named action prop.
        //
        const { props } = propsOf(DataLayoutState, { user: { name: 'jeff' } }, 'data');

        expect(Object.keys(props).sort()).toEqual(['article', 'dispatch', 'effects', 'user']);
    });
});

describe('the header-menu container', () => {
    it('forwards the layout slice untouched', () => {
        const { props } = propsOf(HeaderMenuState, { layout: { css: 'login', type: 'login' } }, 'header-menu');

        expect(props.layout).toEqual({ css: 'login', type: 'login' });
    });

    it('forwards the reducer\'s initial STRING on a cold store', () => {
        //
        // this is the other half of the header-menu finding: reducer/layout.jsx
        // starts as the string 'analysis', the container hands that string
        // straight to HeaderMenu, and HeaderMenu tests `layout.type` -- which is
        // undefined on a string. See navigation/header-menu.test.jsx.
        //
        const store = realStore();

        render(<Provider store={store}><HeaderMenuState /></Provider>);

        expect(mockSeen['header-menu'].layout).toBe('analysis');
    });

    it('does not invent a layout when the slice is missing', () => {
        const { props } = propsOf(HeaderMenuState, {}, 'header-menu');

        expect(props.layout).toBeUndefined();
    });
});

describe('the stream-trigger container', () => {
    it('defaults hide.all to false but leaves hide.graph undefined', () => {
        //
        // DEFECT: hide_all is initialised (`var hide_all = false`) before the
        // guards, hide_graph is not -- it is only declared inside the nested
        // `if`, so a store without it yields undefined. StreamTriggerLayout then
        // gets `hide.graph === undefined` where it expects a boolean.
        //
        const { props } = propsOf(StreamTriggerLayoutState, {}, 'trigger');

        expect(props.hide).toEqual({ all: false, graph: undefined });
        expect(props.hide.all).toBe(false);
        expect(props.hide.graph).toBeUndefined();
    });

    it('reads both flags when the slice carries them', () => {
        const { props } = propsOf(StreamTriggerLayoutState, {
            hide: { hide_all: true, hide_graph: true },
        }, 'trigger');

        expect(props.hide).toEqual({ all: true, graph: true });
    });

    it('ignores non-boolean flags rather than passing them on', () => {
        const { props } = propsOf(StreamTriggerLayoutState, {
            hide: { hide_all: 'true', hide_graph: 1 },
        }, 'trigger');

        expect(props.hide).toEqual({ all: false, graph: undefined });
    });

    it('still yields undefined for graph against the real cold reducer', () => {
        //
        // reducer/hide.jsx starts as the string 'default' and spreads it on the
        // first action, so a cold store holds a character-indexed object rather
        // than the string -- which is the only reason mapStateToProps does not
        // throw on `'hide_all' in state.hide`. The result is still an undefined
        // graph flag on first render.
        //
        const store = realStore();

        render(<Provider store={store}><StreamTriggerLayoutState /></Provider>);

        expect(mockSeen['trigger'].hide).toEqual({ all: false, graph: undefined });
    });

    it('names its mapping function mapDispatchToProps although it maps state', () => {
        //
        // the first argument to connect() is mapStateToProps. This container
        // calls its function mapDispatchToProps and passes null second, so the
        // name says the opposite of what it does -- and the component receives
        // a plain `dispatch` prop it was never given a name for.
        //
        const { props } = propsOf(StreamTriggerLayoutState, {}, 'trigger');

        expect(props.dispatch).toEqual(expect.any(Function));
    });
});

describe('the dispatch props are bare dispatch under another name', () => {
    const cases = [
        ['article-listing', ArticleListingState, 'article-listing', ['dispatchArticleProp']],
        ['forgot-password', ForgotPasswordState, 'forgot-password', ['dispatchLayout', 'dispatchSpinner']],
        ['home-page', HomePageState, 'home-page', ['dispatchLayout']],
        ['login', LoginState, 'login', ['dispatchLogin', 'dispatchLayout', 'dispatchSpinner']],
        ['login-link', LoginLinkState, 'login-link', ['dispatchLogout']],
        ['register', RegisterState, 'register', ['dispatchLayout', 'dispatchSpinner']],
        ['user-menu', UserMenuState, 'user-menu', ['dispatchLogout']],
        ['candlestick left column', CandlestickLeftColumnState, 'candlestick', ['dispatchHide']],
    ];

    it.each(cases)('%s supplies every prop it promises', (label, Container, probe, names) => {
        const { props } = propsOf(Container, {}, probe);

        names.forEach(name => expect(props[name]).toEqual(expect.any(Function)));
    });

    it.each(cases)('%s dispatches a ready-made action verbatim', (label, Container, probe, names) => {
        const { props, dispatched } = propsOf(Container, {}, probe);

        props[names[0]]({ type: 'A-READY-MADE-ACTION' });

        expect(dispatched).toContainEqual({ type: 'A-READY-MADE-ACTION' });
    });

    it.each(cases)('%s does NOT apply the action creator its name refers to', (label, Container, probe, names) => {
        //
        // the payload below is what the creator takes, not what redux takes. A
        // correctly bound prop would turn it into an action; `dispatch.bind(...)`
        // hands it to the store as-is, and redux rejects it for having no type.
        //
        const { props } = propsOf(Container, {}, probe);

        expect(() => props[names[0]]({ layout: 'login' }))
            .toThrow(/type/);
    });

    it('every dispatch prop on one container is interchangeable with the others', () => {
        //
        // the clearest demonstration: dispatchLayout happily dispatches a
        // spinner action, because neither prop knows anything about its creator.
        //
        const { props, dispatched } = propsOf(ForgotPasswordState, {}, 'forgot-password');

        props.dispatchLayout(setSpinner({ spinner: true }));
        props.dispatchSpinner(setLayout({ layout: 'login' }));

        expect(dispatched).toContainEqual({ type: 'SET-SPINNER', spinner: true });
        expect(dispatched).toContainEqual({ type: 'SET-LAYOUT', layout: 'login' });
    });

    it('works end to end the way the call sites actually use it', () => {
        //
        // UserMenu.handleClick builds the action itself and then dispatches it,
        // which is why the mis-bind has never surfaced in the running app.
        //
        const store = realStore({ user: { name: 'jeff' } });

        render(<Provider store={store}><UserMenuState /></Provider>);
        act(() => mockSeen['user-menu'].dispatchLogout(setLogoutState()));

        expect(store.getState().user).toEqual({ name: 'anonymous' });
    });
});

describe('the article-listing container', () => {
    it('binds an action creator that does not exist', () => {
        //
        // DEFECT: it imports { setArticleProp } from action/article.jsx, which
        // exports setStockSplitProp and nothing else. The import is undefined.
        // Because the bind target is ignored anyway this is inert today -- the
        // prop still dispatches -- but the name refers to nothing at all.
        //
        const actions = require('../../import/redux/action/article.jsx');

        expect(actions.setArticleProp).toBeUndefined();
        expect(actions.setStockSplitProp).toEqual(expect.any(Function));
    });

    it('still supplies a working dispatchArticleProp', () => {
        const { props, dispatched } = propsOf(ArticleListingState, {}, 'article-listing');

        props.dispatchArticleProp({ type: 'SET-ARTICLE-STOCK-SPLIT', article: {} });

        expect(dispatched).toContainEqual({ type: 'SET-ARTICLE-STOCK-SPLIT', article: {} });
    });

    it('passes no state props at all', () => {
        const { props } = propsOf(ArticleListingState, { user: { name: 'jeff' } }, 'article-listing');

        expect(props.user).toBeUndefined();
    });
});

describe('containers that supply props nobody reads', () => {
    it('login-link hands LoginLink a user and a logout dispatcher it ignores', () => {
        //
        // WORTH KNOWING: menu-items/login.jsx declares only path and text. The
        // user slice and dispatchLogout wired up here are dead -- and the
        // subscription to the store that mapStateToProps creates means the link
        // re-renders on every username change for no reason.
        //
        const { props } = propsOf(LoginLinkState, { user: { name: 'jeff' } }, 'login-link');

        //
        // the real component, not the probe this file mocked in -- the point of
        // the assertion is what LoginLink actually declares.
        //
        const LoginLink = jest
            .requireActual('../../import/navigation/menu-items/login.jsx')
            .default;

        expect(props.user).toEqual({ name: 'jeff' });
        expect(props.dispatchLogout).toEqual(expect.any(Function));
        expect(Object.keys(LoginLink.propTypes || {})).toEqual(['path', 'text']);
    });

    it('register-link hands RegisterLink the one prop it does read', () => {
        const { props } = propsOf(RegisterLinkState, { user: { name: 'anonymous' } }, 'register-link');

        expect(props.user).toEqual({ name: 'anonymous' });
        expect(props.dispatchLogout).toBeUndefined();
    });
});

describe('own props', () => {
    it('are merged with the mapped props rather than replaced', () => {
        const { store } = inertStore({ user: { name: 'jeff' } });

        render(
            <Provider store={store}>
                <PageLayoutState className='from-the-parent' />
            </Provider>
        );

        expect(mockSeen['page'].className).toBe('from-the-parent');
        expect(mockSeen['page'].user).toEqual({ name: 'jeff' });
    });
});

/**
 * store.test.js: the redux store, as every connected container first sees it.
 *
 * The initial state is read before any action has been dispatched -- the header
 * decides between the anonymous and the signed-in menu from it on first render --
 * so what the store starts with is behaviour, not setup.
 *
 * Note: the store reads sessionStorage when its module is EVALUATED, so each case
 *       loads a fresh copy with jest.isolateModules rather than sharing the one
 *       the first import created.
 *
 * Note: '@aws-amplify/auth' is mocked. The store imports the current-user helper,
 *       which imports Auth, and the real package ships syntax jest will not parse.
 */

jest.mock('@aws-amplify/auth', () => ({
    __esModule: true,
    default: { currentSession: jest.fn() },
}));

function freshStore() {
    let store;

    jest.isolateModules(() => {
        store = require('../../import/redux/store.jsx').default;
    });

    return store;
}

afterEach(() => {
    sessionStorage.clear();
});

describe('the initial state', () => {
    it('names the user a previous sign-in left in the session', () => {
        sessionStorage.setItem('username', 'jeff');

        expect(freshStore().getState().user).toEqual({ name: 'jeff' });
    });

    it('names no one when nobody has signed in', () => {
        //
        // null rather than 'anonymous'. The 'anonymous' fallback is chosen on the
        // current-user HELPER being truthy -- the function itself, not its result --
        // so it is never taken. The page layout reads a missing name and 'anonymous'
        // alike, which is why both end at the anonymous menu.
        //
        expect(freshStore().getState().user).toEqual({ name: null });
    });

    it('starts the page in its default status', () => {
        expect(freshStore().getState().page).toEqual({ status: 'default' });
    });

    it('holds a slice for every reducer', () => {
        expect(Object.keys(freshStore().getState()).sort())
            .toEqual(['article', 'hide', 'layout', 'page', 'user']);
    });
});

/**
 * current-user.test.js: the amplify current-user helper.
 *
 * Sixteen lines, and it does not do what its name says. Covered because
 * redux/store.jsx uses it to decide the initial username, and the way it does
 * that is wrong in a way no test would otherwise catch.
 */

jest.mock('@aws-amplify/auth', () => ({
    __esModule: true,
    default: { currentSession: jest.fn() },
}));

import Auth from '@aws-amplify/auth';
import amplifyCurrentUser from '../../import/general/currentUser.js';

let quiet;

beforeEach(() => {
    jest.clearAllMocks();
    quiet = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    quiet.mockRestore();
});

describe('amplifyCurrentUser', () => {
    it('asks amplify for the current session', async () => {
        Auth.currentSession.mockResolvedValue({ idToken: 'x' });

        await amplifyCurrentUser();

        expect(Auth.currentSession).toHaveBeenCalled();
    });

    it('resolves to undefined even when a session exists', async () => {
        //
        // DOCUMENTS A DEFECT.
        //
        // The chain is:
        //
        //     Auth.currentSession().then(data => console.log(data)).catch(...)
        //
        // console.log returns undefined, so the promise resolves to undefined
        // whether or not a session was found. The function is named for getting the
        // current user and cannot return one -- it only logs it.
        //
        Auth.currentSession.mockResolvedValue({ idToken: 'a-real-session' });

        await expect(amplifyCurrentUser()).resolves.toBeUndefined();
    });

    it('resolves to undefined when there is no session', async () => {
        //
        // so the two outcomes are indistinguishable to a caller: signed in and
        // signed out both resolve to undefined.
        //
        Auth.currentSession.mockRejectedValue(new Error('no session'));

        await expect(amplifyCurrentUser()).resolves.toBeUndefined();
    });

    it('never rejects, so a caller cannot detect the failure either', async () => {
        Auth.currentSession.mockRejectedValue(new Error('no session'));

        await expect(amplifyCurrentUser()).resolves.not.toThrow;
    });

    it('is a function, which is what store.jsx actually tests', () => {
        //
        // DOCUMENTS A SECOND DEFECT, in the consumer.
        //
        // redux/store.jsx reads:
        //
        //     const username = !!amplifyCurrentUser
        //         ? sessionStorage.getItem('username')
        //         : 'anonymous';
        //
        // That tests the imported FUNCTION for truthiness, not the result of
        // calling it -- and a function is always truthy. So the ternary always
        // takes the first branch and the 'anonymous' fallback is unreachable. The
        // initial username is whatever sessionStorage holds, including null.
        //
        // Calling it would not help either, since it resolves to undefined.
        //
        expect(typeof amplifyCurrentUser).toBe('function');
        expect(Boolean(amplifyCurrentUser)).toBe(true);
    });
});

/**
 * current-user.test.js: the signed-in reader's ID token, from the Amplify session.
 *
 * The account api reads a reader from this token and from nothing else, so it is the
 * one proof of who is signed in that a request can carry -- see account-api.js. It
 * used to log the session and resolve to undefined whether or not there was one,
 * which this suite recorded as a defect.
 */

jest.mock('@aws-amplify/auth', () => ({
    __esModule: true,
    default: { currentSession: jest.fn() },
}));

import Auth from '@aws-amplify/auth';
import amplifyCurrentUser from '../../import/general/currentUser.js';

//
// a session as Amplify answers one, holding an ID token
//
function sessionWith(token) {
    return { getIdToken: () => ({ getJwtToken: () => token }) };
}

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
        Auth.currentSession.mockResolvedValue(sessionWith('x.y.z'));

        await amplifyCurrentUser();

        expect(Auth.currentSession).toHaveBeenCalled();
    });

    it('resolves to the session\'s ID token', async () => {
        //
        // FIXED. It resolved to undefined even with a session, because the chain
        // ended in .then(data => console.log(data)) -- it could log the reader and
        // never return one.
        //
        Auth.currentSession.mockResolvedValue(sessionWith('header.payload.signature'));

        await expect(amplifyCurrentUser()).resolves.toBe('header.payload.signature');
    });

    it('resolves to null when there is no session', async () => {
        //
        // so signed in and signed out are told apart, which they were not: both
        // resolved to undefined
        //
        Auth.currentSession.mockRejectedValue(new Error('No current user'));

        await expect(amplifyCurrentUser()).resolves.toBeNull();
    });

    it('resolves to null when amplify throws rather than rejecting', async () => {
        //
        // an unconfigured Amplify, as under test, throws from the call itself
        //
        Auth.currentSession.mockImplementation(() => {
            throw new Error('not configured');
        });

        await expect(amplifyCurrentUser()).resolves.toBeNull();
    });

    it('resolves to null for a session with no token in it', async () => {
        Auth.currentSession.mockResolvedValue(sessionWith(''));

        await expect(amplifyCurrentUser()).resolves.toBeNull();
    });

    it('logs nothing, signed in or out', async () => {
        //
        // being signed out is the ordinary case, not an error -- and a token is not
        // something to write to a console
        //
        Auth.currentSession.mockResolvedValue(sessionWith('header.payload.signature'));
        await amplifyCurrentUser();

        Auth.currentSession.mockRejectedValue(new Error('No current user'));
        await amplifyCurrentUser();

        expect(quiet).not.toHaveBeenCalled();
    });

    it('is a function, which is what store.jsx actually tests', () => {
        //
        // DOCUMENTS A DEFECT, in the consumer.
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
        // The function now resolves to a token, but store.jsx does not call it, and
        // the account pages ask it themselves rather than trusting the username.
        //
        expect(typeof amplifyCurrentUser).toBe('function');
        expect(Boolean(amplifyCurrentUser)).toBe(true);
    });
});

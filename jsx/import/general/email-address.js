/**
 * email-address.js: the reader's email address, as the sign-in keeps it, and
 *                   verifying it.
 *
 *     emailAddress()      { email, verified }, email null for an account that has
 *                         none -- asked of the sign-in itself, not of the token
 *     sendEmailCode()     send a verification code to the address
 *     verifyEmail(code)   verify the address with that code, then refresh the
 *                         session: { refreshed }
 *
 * Alarms go by email, so the account api refuses to subscribe a reader whose
 * address is not verified -- and it reads that from the ID token, as
 * `email_verified` -- see account-api.js. A token issued before the address was
 * verified still says it is not, for the rest of its hour. So a verify is followed
 * by a refresh, and the reader can subscribe at once rather than after signing out
 * and in again.
 *
 * Note: the address is read from the sign-in with its cache bypassed, for the same
 *       reason: what a reader verified a moment ago is what this page has to show.
 *
 * Note: every refusal rejects, carrying the sign-in's own `code` -- a code that is
 *       wrong or has expired is 'CodeMismatchException' or 'ExpiredCodeException',
 *       and asking too often is 'LimitExceededException'. See settings.jsx.
 */

import Auth from '@aws-amplify/auth';

export async function emailAddress() {
    const user = await Auth.currentAuthenticatedUser({ bypassCache: true });

    //
    // a sign-in that read no attributes knows nothing of the address, which is not
    // the same as an account that has none -- the page tells that one it can never
    // add one
    //
    if (!user || !user.attributes) {
        throw new Error('the sign-in read no attributes');
    }

    const { attributes } = user;
    const email = typeof attributes.email === 'string' && attributes.email ? attributes.email : null;

    return { email: email, verified: Boolean(email) && attributes.email_verified === true };
}

export async function sendEmailCode() {
    await Auth.verifyCurrentUserAttribute('email');
}

//
// a new ID token, carrying what the sign-in now holds -- an address it has just
// verified among it. The session's own refresh token asks for it, and the new
// tokens replace the old ones where the session keeps them.
//
async function refreshSession() {
    const user = await Auth.currentAuthenticatedUser();
    const session = await Auth.currentSession();

    await new Promise((resolve, reject) => {
        user.refreshSession(session.getRefreshToken(), (error, refreshed) => (error ? reject(error) : resolve(refreshed)));
    });
}

/**
 * verify the address with the code the reader was sent. A code that is wrong or has
 * expired rejects, and verifies nothing.
 *
 * Note: a verify that succeeded is not undone by a refresh that failed. It resolves
 *       { refreshed: false } instead, and the token in hand says unverified until it
 *       is next refreshed -- which the page says.
 */
export async function verifyEmail(code) {
    await Auth.verifyCurrentUserAttributeSubmit('email', String(code).trim());

    try {
        await refreshSession();
        return { refreshed: true };
    } catch (error) {
        return { refreshed: false };
    }
}

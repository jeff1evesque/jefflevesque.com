/**
 * currentUser.js: the signed-in reader's ID token, or null when no one is signed in.
 *
 * The token is what the account api reads a reader by -- see account-api.js. The page
 * never sends a username or an email address: the username in session storage is only
 * what the page last set there, which is nothing an api can trust.
 *
 * Note: Auth.currentSession refreshes an expired ID token from the refresh token, so a
 *       token handed out here is current. A session that cannot be refreshed, or none
 *       at all, rejects, and is read here as signed out.
 *
 * Note: every failure is null rather than a rejection, and is not logged. Being signed
 *       out is the ordinary case for most readers, not an error -- and an unconfigured
 *       Amplify, as under test, throws rather than rejecting, which lands here too.
 */

import Auth from '@aws-amplify/auth';

async function amplifyCurrentUser() {
    try {
        const session = await Auth.currentSession();
        const token = session.getIdToken().getJwtToken();

        return typeof token === 'string' && token ? token : null;
    } catch (error) {
        return null;
    }
}

export default amplifyCurrentUser;

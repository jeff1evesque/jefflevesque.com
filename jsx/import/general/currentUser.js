/**
 * currentUser.js: get current amplify user.
 *
 */

import Auth from '@aws-amplify/auth';

async function amplifyCurrentUser() {
    let user = Auth.currentSession()
        .then(data => console.log(data))
        .catch(err => console.log(err));

    return user;
}

export default amplifyCurrentUser;

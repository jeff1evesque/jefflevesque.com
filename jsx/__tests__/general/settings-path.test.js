/**
 * settings-path.test.js: where the alarm pages send a reader in Account Settings
 * (#255).
 *
 * The email section, by the name the header's own link uses: the one the sign-in put
 * in session storage, or 'account' where there is none. Settings reads its reader from
 * the session, so the name is only ever the page's address.
 */

import { emailSettingsPath } from '../../import/general/settings-path.js';

afterEach(() => {
    sessionStorage.removeItem('username');
    jest.restoreAllMocks();
});

describe('emailSettingsPath', () => {
    it('is the email section of the reader\'s settings, by the name the sign-in kept', () => {
        sessionStorage.setItem('username', 'reader');

        expect(emailSettingsPath()).toBe('/reader/settings#email');
    });

    it('is the email section of /account/settings with no name kept', () => {
        expect(emailSettingsPath()).toBe('/account/settings#email');
    });

    it('is the same when session storage refuses to be read', () => {
        jest.spyOn(Object.getPrototypeOf(sessionStorage), 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });

        expect(emailSettingsPath()).toBe('/account/settings#email');
    });

    it('encodes a name the address would read otherwise', () => {
        sessionStorage.setItem('username', 'a b/c');

        expect(emailSettingsPath()).toBe('/a%20b%2Fc/settings#email');
    });
});

/**
 * settings-path.js: where a page sends a reader in Account Settings.
 *
 * Both alarm pages link to its email section when a subscribe is refused for an
 * address that is not verified: a stream's, see layout/stream/alarm.jsx, and a
 * model's, see layout/model/model-alarm.jsx (#255).
 */

/**
 * Account Settings' email section, where a reader verifies their address.
 *
 * Settings reads its reader from the session, never from the url, so the name in the
 * path is only the one the header's own link carries -- the username the sign-in put
 * in session storage, see user-menu.jsx -- and 'account' where there is none, as in a
 * tab opened after signing in.
 */
export function emailSettingsPath() {
    let name = null;

    try {
        name = sessionStorage.getItem('username');
    } catch (error) {
        name = null;
    }

    return `/${encodeURIComponent(name || 'account')}/settings#email`;
}

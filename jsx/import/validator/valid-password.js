/**
 * valid-password.js: check provided argument is a valid password:
 *
 *     - at least one lowercase
 *     - at least one uppercase
 *     - at least one number
 *     - at least ten overall characters
 *
 * Note: other variations include:
 *
 *   (?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}
 *
 *     - at least one letter
 *     - at least one number
 *     - at least one special character
 *     - at least eight overall characters
 *
 *   (?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,10}
 *
 *     - at least one lowercase letter
 *     - at least one uppercase letter
 *     - at least one number
 *     - at least one special character
 *     - overall eight to ten characters
 *
 */

function validator(value) {
    var urlregex = new RegExp('^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?).{10,}$');
    return urlregex.test(value);
}

export default function checkValidPassword(value) {
    return validator(value);
}

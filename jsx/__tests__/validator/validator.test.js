/**
 * validator.test.js: the input validators, one describe per module.
 *
 * These run on every form submission and on values arriving from the query
 * string, so what they accept is the boundary between a visitor and the rest of
 * the app. They are also pure functions with no react involved, which makes them
 * the cheapest place in this codebase to hold behaviour still.
 *
 * Several tests below are labelled DEFECT or QUIRK. Those assert what the code
 * does today rather than what it should do -- the intent is that a fix breaks the
 * test loudly and the assertion is then inverted, rather than the behaviour
 * changing unnoticed.
 */

import checkValidArray from '../../import/validator/valid-array.js';
import checkValidBool from '../../import/validator/valid-bool.js';
import checkValidEmail from '../../import/validator/valid-email.js';
import checkValidFile from '../../import/validator/valid-file.js';
import checkValidFloat from '../../import/validator/valid-float.js';
import checkValidInt from '../../import/validator/valid-int.js';
import checkValidObject from '../../import/validator/valid-object.js';
import checkValidPassword from '../../import/validator/valid-password.js';
import checkValidPhoneNumber from '../../import/validator/valid-phone-number.js';
import checkValidString from '../../import/validator/valid-string.js';
import checkValidUrl from '../../import/validator/valid-url.js';

describe('checkValidBool', () => {
    it('accepts only real booleans', () => {
        expect(checkValidBool(true)).toBe(true);
        expect(checkValidBool(false)).toBe(true);
    });

    it('rejects values that merely look boolean', () => {
        expect(checkValidBool('true')).toBe(false);
        expect(checkValidBool(1)).toBe(false);
        expect(checkValidBool(0)).toBe(false);
        expect(checkValidBool(null)).toBe(false);
        expect(checkValidBool(undefined)).toBe(false);
    });
});

describe('checkValidString', () => {
    it('accepts a non-empty string', () => {
        expect(checkValidString('a')).toBe(true);
        expect(checkValidString('hello world')).toBe(true);
    });

    it('rejects an empty string', () => {
        expect(checkValidString('')).toBe(false);
    });

    it('rejects non-string types', () => {
        expect(checkValidString(1)).toBe(false);
        expect(checkValidString(null)).toBe(false);
        expect(checkValidString(undefined)).toBe(false);
        expect(checkValidString(['a'])).toBe(false);
    });

    it('accepts a whitespace-only string', () => {
        //
        // QUIRK: length alone is checked, so '   ' is a valid string. Callers
        // that care trim first -- see trim-object.
        //
        expect(checkValidString('   ')).toBe(true);
    });
});

describe('checkValidInt', () => {
    it('accepts integers as number and as text', () => {
        expect(checkValidInt(5)).toBe(true);
        expect(checkValidInt('5')).toBe(true);
        expect(checkValidInt(-5)).toBe(true);
        expect(checkValidInt(0)).toBe(true);
    });

    it('rejects values that do not begin with a number', () => {
        expect(checkValidInt('abc')).toBe(false);
        expect(checkValidInt('')).toBe(false);
        expect(checkValidInt(null)).toBe(false);
        expect(checkValidInt(undefined)).toBe(false);
    });

    it('accepts a float, having discarded its fraction', () => {
        //
        // QUIRK: the check is parseInt against itself, and parseInt truncates
        // before the comparison, so both sides agree and a float passes as an
        // int. A form relying on this to reject '3.7' does not.
        //
        expect(checkValidInt(3.7)).toBe(true);
        expect(checkValidInt('3.7')).toBe(true);
    });

    it('accepts a number with trailing text', () => {
        //
        // QUIRK: parseInt stops at the first non-digit rather than failing, so
        // '12abc' validates as the integer 12.
        //
        expect(checkValidInt('12abc')).toBe(true);
    });
});

describe('checkValidFloat', () => {
    it('accepts decimals as number and as text', () => {
        expect(checkValidFloat(1.5)).toBe(true);
        expect(checkValidFloat('1.5')).toBe(true);
        expect(checkValidFloat(-1.5)).toBe(true);
        expect(checkValidFloat('0.5')).toBe(true);
    });

    it('accepts whole numbers', () => {
        expect(checkValidFloat(1)).toBe(true);
        expect(checkValidFloat('1')).toBe(true);
    });

    it('accepts exponent notation', () => {
        expect(checkValidFloat('1e+5')).toBe(true);
        expect(checkValidFloat('1e-5')).toBe(true);
    });

    it('rejects negative zero', () => {
        expect(checkValidFloat('-0')).toBe(false);
        expect(checkValidFloat('-0.0')).toBe(false);
    });

    it('rejects non-numeric text', () => {
        expect(checkValidFloat('abc')).toBe(false);
        expect(checkValidFloat('1.2.3')).toBe(false);
        expect(checkValidFloat('')).toBe(false);
        expect(checkValidFloat(null)).toBe(false);
        expect(checkValidFloat(undefined)).toBe(false);
    });

    it('disagrees with itself about zero depending on the type', () => {
        //
        // DEFECT: the guard is a falsiness check, and the NUMBER 0 is falsey
        // while the STRING '0' is not. So the same value validates or not
        // depending only on whether it came through a text input or a state
        // field.
        //
        expect(checkValidFloat(0)).toBe(false);
        expect(checkValidFloat('0')).toBe(true);
    });
});

describe('checkValidEmail', () => {
    it('accepts ordinary addresses', () => {
        expect(checkValidEmail('a@b.com')).toBe(true);
        expect(checkValidEmail('first.last@sub.domain.org')).toBe(true);
        expect(checkValidEmail('user+tag@domain.co.uk')).toBe(true);
    });

    it('rejects malformed addresses', () => {
        expect(checkValidEmail('')).toBe(false);
        expect(checkValidEmail('a@b')).toBe(false);
        expect(checkValidEmail('a@.com')).toBe(false);
        expect(checkValidEmail('@b.com')).toBe(false);
        expect(checkValidEmail('a b@c.com')).toBe(false);
        expect(checkValidEmail('a@b.c')).toBe(false);
    });

    it('requires a two character or longer tld', () => {
        expect(checkValidEmail('a@b.io')).toBe(true);
        expect(checkValidEmail('a@b.x')).toBe(false);
    });
});

describe('checkValidPhoneNumber', () => {
    it('accepts an E164 number', () => {
        expect(checkValidPhoneNumber('+12125550123')).toBe(true);
    });

    it('requires the leading plus', () => {
        expect(checkValidPhoneNumber('12125550123')).toBe(false);
    });

    it('rejects a leading zero on the country code', () => {
        expect(checkValidPhoneNumber('+02125550123')).toBe(false);
    });

    it('enforces the length bounds', () => {
        //
        // the pattern is a leading 1-9 followed by 10 to 14 more digits, so the
        // total after the plus is 11 at the shortest and 15 at the longest.
        //
        expect(checkValidPhoneNumber('+12125550123')).toBe(true);
        expect(checkValidPhoneNumber('+123456789012345')).toBe(true);
        expect(checkValidPhoneNumber('+1212555012')).toBe(false);
        expect(checkValidPhoneNumber('+1234567890123456')).toBe(false);
    });

    it('rejects separators and empty input', () => {
        expect(checkValidPhoneNumber('+1 212 555 0123')).toBe(false);
        expect(checkValidPhoneNumber('+1-212-555-0123')).toBe(false);
        expect(checkValidPhoneNumber('')).toBe(false);
    });
});

describe('checkValidUrl', () => {
    it('accepts http, https and ftp urls', () => {
        expect(checkValidUrl('http://example.com')).toBe(true);
        expect(checkValidUrl('https://example.com')).toBe(true);
        expect(checkValidUrl('ftp://example.com')).toBe(true);
    });

    it('accepts a path, port and query', () => {
        expect(checkValidUrl('https://example.com:8080')).toBe(true);
        expect(checkValidUrl('https://example.com/some/path')).toBe(true);
        expect(checkValidUrl('https://sub.example.com/a?b=c')).toBe(true);
    });

    it('requires a scheme and a known tld', () => {
        expect(checkValidUrl('example.com')).toBe(false);
        expect(checkValidUrl('https://example.zzz')).toBe(false);
        expect(checkValidUrl('')).toBe(false);
        expect(checkValidUrl('not a url')).toBe(false);
    });

    it('accepts an ampersand in the query string', () => {
        //
        // Guards an html-escaping artifact: the pattern source contains the
        // literal text '&amp;' where a bare '&' was meant. Inside a character
        // class that still admits '&' -- along with 'a', 'm', 'p' and ';', which
        // were never intended -- so the behaviour survives by accident. If the
        // pattern is ever cleaned up to a bare '&', this must keep passing.
        //
        expect(checkValidUrl('https://example.com/a?b=c&d=e')).toBe(true);
    });
});

describe('checkValidFile', () => {
    it('accepts the supported extensions', () => {
        expect(checkValidFile('data.csv')).toBe(true);
        expect(checkValidFile('data.xml')).toBe(true);
        expect(checkValidFile('data.json')).toBe(true);
    });

    it('ignores the case of the extension', () => {
        expect(checkValidFile('DATA.CSV')).toBe(true);
        expect(checkValidFile('data.Json')).toBe(true);
    });

    it('reads only the final extension', () => {
        expect(checkValidFile('archive.csv.zip')).toBe(false);
        expect(checkValidFile('archive.zip.csv')).toBe(true);
    });

    it('rejects unsupported and absent extensions', () => {
        expect(checkValidFile('data.txt')).toBe(false);
        expect(checkValidFile('data')).toBe(false);
        expect(checkValidFile('')).toBe(false);
    });

    it('throws on a non-string rather than returning false', () => {
        //
        // DEFECT: '.split' is called before anything is validated, so a null or
        // undefined filename raises a TypeError instead of being reported as
        // invalid. Every other validator here answers false.
        //
        expect(() => checkValidFile(null)).toThrow(TypeError);
        expect(() => checkValidFile(undefined)).toThrow(TypeError);
    });
});

describe('checkValidPassword', () => {
    it('accepts a password meeting every rule', () => {
        expect(checkValidPassword('Abcdefghi1')).toBe(true);
    });

    it('requires ten characters', () => {
        expect(checkValidPassword('Abcdefgh1')).toBe(false);
    });

    it('requires an uppercase, a lowercase and a digit', () => {
        expect(checkValidPassword('abcdefghi1')).toBe(false);
        expect(checkValidPassword('ABCDEFGHI1')).toBe(false);
        expect(checkValidPassword('Abcdefghij')).toBe(false);
    });

    it('accepts extra characters beyond the minimum', () => {
        expect(checkValidPassword('Abcdefghi1!@#$%')).toBe(true);
    });

    it('rejects empty input', () => {
        expect(checkValidPassword('')).toBe(false);
    });
});

describe('checkValidObject', () => {
    it('accepts an object carrying the key with a value', () => {
        expect(checkValidObject('a', { a: 'x' })).toBe(true);
    });

    it('rejects a missing key', () => {
        expect(checkValidObject('b', { a: 'x' })).toBe(false);
    });

    it('rejects a null value at the key', () => {
        expect(checkValidObject('a', { a: null })).toBe(false);
    });

    it('rejects arrays and non-objects', () => {
        expect(checkValidObject('a', ['a'])).toBe(false);
        expect(checkValidObject('a', 'a')).toBe(false);
        expect(checkValidObject('a', null)).toBe(false);
    });

    it('accepts an empty string at the key', () => {
        //
        // DEFECT: the emptiness check reads 'v[k].trim !== ""', comparing the
        // trim METHOD against a string rather than calling it. A function is
        // never equal to '', so the condition is always true and the check does
        // nothing. An empty or whitespace-only value passes as valid.
        //
        // The intent was 'v[k].trim() !== ""'.
        //
        expect(checkValidObject('a', { a: '' })).toBe(true);
        expect(checkValidObject('a', { a: '   ' })).toBe(true);
    });

    it('rejects a genuinely undefined value at the key', () => {
        //
        // FIXED. The guard used to compare against the STRING 'undefined', so a
        // real undefined slipped past it and reached the '.trim' access below,
        // which throws on undefined -- the call raised instead of answering.
        //
        // A key present with an undefined value now reads the same as a key that
        // is not there at all, which is what every caller already assumed.
        //
        expect(checkValidObject('a', { a: undefined })).toBe(false);
        expect(checkValidObject('b', { a: 'x' })).toBe(false);
    });

    it('still answers for a value that has no trim method', () => {
        //
        // the '.trim' clause reads a property rather than calling one, so it is
        // inert for every type -- but it is also an unguarded property access,
        // and the fix above is what keeps anything reaching it that cannot take
        // one.
        //
        expect(checkValidObject('a', { a: 0 })).toBe(true);
        expect(checkValidObject('a', { a: false })).toBe(true);
        expect(checkValidObject('a', { a: { b: 1 } })).toBe(true);
    });
});

describe('checkValidArray', () => {
    it('accepts a non-empty array at a key', () => {
        expect(checkValidArray('a', { a: [1] })).toBe(true);
    });

    it('rejects an empty array at a key', () => {
        expect(checkValidArray('a', { a: [] })).toBe(false);
    });

    it('rejects a non-array value at a key', () => {
        expect(checkValidArray('a', { a: 'x' })).toBe(false);
    });

    it('accepts a bare non-empty array as the first argument', () => {
        //
        // the function is overloaded: called with one argument it validates that
        // argument directly rather than looking a key up in it.
        //
        expect(checkValidArray([1, 2])).toBe(true);
    });

    it('rejects a bare empty array', () => {
        expect(checkValidArray([])).toBe(false);
    });

    it('rejects a missing key and empty input', () => {
        expect(checkValidArray('b', { a: [1] })).toBe(false);
        expect(checkValidArray(null)).toBe(false);
        expect(checkValidArray(undefined)).toBe(false);
        expect(checkValidArray('a')).toBe(false);
    });
});

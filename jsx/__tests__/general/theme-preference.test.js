/**
 * theme-preference.test.js: the theme a reader chose, kept between visits.
 *
 * What is held here is the promise the toggle makes: once a reader has chosen, the
 * next visit is drawn in exactly that choice, whatever the system says -- and until
 * they choose, the page follows the system. And that nothing a browser can do to
 * storage keeps the page from drawing.
 *
 * Note: storage is the shim setup.js gives every suite, emptied before each test;
 *       a storage that refuses is swapped in and put back.
 */

import {
    applyTheme,
    currentTheme,
    readTheme,
    systemTheme,
    writeTheme,
    ATTRIBUTE,
    KEY,
} from '../../import/general/theme-preference.js';

const storage = window.localStorage;

//
// a system that asks for `theme`, the way a MediaQueryList answers
//
function system(theme) {
    window.matchMedia = jest.fn().mockReturnValue({ matches: theme === 'dark' });
}

//
// a storage that throws on every access, as Safari's private mode and blocked
// site data do
//
function refusing() {
    Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: {
            getItem() { throw new Error('denied'); },
            setItem() { throw new Error('denied'); },
            clear() {},
        },
    });
}

beforeEach(() => {
    window.localStorage.clear();
});

afterEach(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    delete window.matchMedia;
    document.documentElement.removeAttribute(ATTRIBUTE);
});

describe('the reader\'s choice', () => {
    it('is nothing until they make one', () => {
        expect(readTheme()).toBeNull();
    });

    it('comes back on the next visit exactly as it was made', () => {
        writeTheme('dark');
        expect(readTheme()).toBe('dark');

        writeTheme('light');
        expect(readTheme()).toBe('light');
    });

    it('is kept under the key the page head reads before it paints', () => {
        //
        // index.html's script reads this key itself, before this module has
        // loaded -- see index-html.test.js, which holds the two together.
        //
        writeTheme('dark');

        expect(window.localStorage.getItem(KEY)).toBe('dark');
        expect(KEY).toBe('jefflevesque.theme');
    });

    it('refuses to keep a value that is not a theme', () => {
        expect(writeTheme('sepia')).toBe(false);
        expect(readTheme()).toBeNull();
    });

    it('reads a stored value that is not a theme as no choice', () => {
        //
        // a string in someone's browser: edited by hand, or written by a version
        // of this that knew other themes
        //
        window.localStorage.setItem(KEY, 'Dark');

        expect(readTheme()).toBeNull();
    });

    it('is no choice at all where storage refuses', () => {
        refusing();

        expect(readTheme()).toBeNull();
        expect(writeTheme('dark')).toBe(false);
    });
});

describe('the system\'s setting', () => {
    it('is dark where the system asks for dark', () => {
        system('dark');

        expect(systemTheme()).toBe('dark');
    });

    it('is light where the system asks for light', () => {
        system('light');

        expect(systemTheme()).toBe('light');
    });

    it('is light where there is no system to ask', () => {
        //
        // jsdom, and an old browser, have no matchMedia
        //
        expect(systemTheme()).toBe('light');
    });

    it('is light where asking throws', () => {
        window.matchMedia = () => { throw new Error('no'); };

        expect(systemTheme()).toBe('light');
    });
});

describe('the theme the page is drawn in', () => {
    it('is the system\'s until the reader chooses', () => {
        system('dark');

        expect(currentTheme()).toBe('dark');
    });

    it('is the reader\'s once they have, whatever the system says', () => {
        system('dark');
        writeTheme('light');

        expect(currentTheme()).toBe('light');
    });

    it('is the system\'s where storage refuses', () => {
        system('dark');
        refusing();

        expect(currentTheme()).toBe('dark');
    });

    it('goes on the root element, where the stylesheet reads it', () => {
        applyTheme('dark');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

        applyTheme('light');
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('goes on as light for a value that is not a theme', () => {
        applyTheme('sepia');

        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
});

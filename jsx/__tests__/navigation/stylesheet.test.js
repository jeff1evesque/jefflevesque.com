/**
 * stylesheet.test.js: what the header's stylesheet promises about the light and
 * dark switch, read out of '_navigation.scss', and about the phone's bar and its
 * menu, out of '_navigation_anonymous.scss' (#173).
 *
 * jsdom lays nothing out, so no suite can measure the room around the switch or
 * see the wash behind it under the pointer. What can be held is the rule that
 * decides them: the switch's size, the padding that makes its target, the margin
 * that keeps it off 'Login in' and off the phone's menu button, and a wash that
 * shows on the page and on the black bars alike.
 *
 * Note: read the way layout/graph/stylesheet.test.js reads '_graph.scss':
 *       comments taken out, and a block found by its header, whole.
 */

import fs from 'fs';
import path from 'path';

//
// a partial's text, its comments taken out
//
function read(file) {
    return fs.readFileSync(path.resolve(__dirname, '../../../scss', file), 'utf8').replace(/\/\/.*$/gm, '');
}

const source = read('_navigation.scss');

//
// the text between the braces of every block opened by `header`, at any depth
//
function blocks(text, header) {
    const found = [];
    const opener = new RegExp(`(^|\\s)${header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`, 'g');
    let match;

    while ((match = opener.exec(text)) !== null) {
        const start = match.index + match[0].length;
        let depth = 1;
        let at = start;

        while (depth > 0 && at < text.length) {
            if (text[at] === '{') depth += 1;
            if (text[at] === '}') depth -= 1;
            at += 1;
        }

        found.push(text.slice(start, at - 1));
    }

    return found;
}

//
// a block's own declarations, the blocks nested in it taken out
//
function own(text) {
    let out = text;
    let last;

    do {
        last = out;
        out = out.replace(/[^{};]*\{[^{}]*\}/g, '');
    } while (out !== last);

    return out;
}

describe('the switch', () => {
    const [toggle] = blocks(source, '.theme-toggle');
    const [hover] = toggle ? blocks(toggle, '&:hover') : [];

    it('is laid out by a rule of its own', () => {
        expect(toggle).toBeDefined();
    });

    it('is drawn at 1.5rem, the size of the site\'s other mui icons', () => {
        expect(toggle).toMatch(/font-size\s*:\s*1\.5rem\s*;/);
    });

    it('takes a 35px target: 0.5rem around 1.5rem, at the 14px root', () => {
        expect(toggle).toMatch(/padding\s*:\s*0\.5rem\s*;/);
    });

    it('keeps 1rem off what follows it, as the menu button keeps off the edge', () => {
        //
        // nearer, beside 'Login in' -- which has no outline of its own -- the
        // moon could pass for Login's icon
        //
        expect(toggle).toMatch(/margin-right\s*:\s*1rem\s*;/);
    });

    it('shows a wash behind it under the pointer, in the page\'s own ink', () => {
        expect(hover).toMatch(/background-color\s*:\s*rgba\(var\(--ink-rgb\),\s*0\.06\)\s*;/);
    });
});

describe('the switch on a black bar', () => {
    const [bar] = blocks(source, '.theme-toggle-bar');
    const [hover] = bar ? blocks(bar, '&:hover') : [];

    it('washes white under the pointer, since the bar is black in either theme', () => {
        //
        // the page's own ink is black by day, and would not show on the bar
        //
        expect(hover).toMatch(/background-color\s*:\s*rgba\(255,\s*255,\s*255,\s*0\.12\)\s*;/);
    });
});

describe('the phone\'s bar (#173)', () => {
    const variables = read('_variables.scss');
    const theme = read('_theme.scss');
    const [bar] = blocks(read('_navigation_anonymous.scss'), '.main-navigation.phone-header');
    const [panel] = bar ? blocks(bar, '.phone-menu') : [];

    it('is a very light gray by day, and a shade darker than the page by night', () => {
        expect(own(bar)).toMatch(/background-color\s*:\s*\$header-bar\s*;/);
        expect(theme).toMatch(/'header-bar'\s*:\s*\(\s*\$header-bar\s*,\s*\$dark-header-bar\s*\)/);
        expect(variables).toMatch(/\$header-bar\s*:\s*#f5f5f5\s*;/);
        expect(variables).toMatch(/\$dark-header-bar\s*:\s*#151515\s*;/);
    });

    it('is black nowhere, and the shared partial paints no bar black', () => {
        //
        // the signed-in header is still a black bar, but its own partial
        // paints it -- see '_navigation_authenticated.scss'
        //
        expect(bar).not.toMatch(/\bblack\b/);
        expect(source).not.toMatch(/background-color\s*:\s*black/);
    });

    it('drops a square menu in its own color, so the two are one surface', () => {
        expect(own(panel)).toMatch(/background-color\s*:\s*\$header-bar\s*;/);
        expect(panel).not.toMatch(/border-radius/);
    });

    it('names the page on screen in the rows\' dark by day and green by night, its arrow green (#175)', () => {
        const [link] = bar ? blocks(bar, '.phone-menu-link') : [];
        const [active] = link ? blocks(link, '&.active') : [];
        const [night] = active ? blocks(active, '@include dark') : [];
        const [arrow] = bar ? blocks(bar, '.phone-menu-link.active .phone-menu-arrow') : [];

        expect(own(active)).toMatch(/background-color\s*:\s*\$green-bar\s*;/);
        expect(own(active)).toMatch(/(^|[\s;{])color\s*:\s*\$gray-8\s*;/);
        expect(night).toMatch(/(^|[\s;{])color\s*:\s*\$green-6\s*;/);
        expect(arrow).toMatch(/(^|[\s;{])color\s*:\s*\$green-6\s*;/);
    });

});

describe('the phone\'s pinned header (#177)', () => {
    const anonymous = read('_navigation_anonymous.scss');
    const [pinned] = blocks(anonymous, '> .menu-container:has(.phone-header)');
    const [views] = blocks(anonymous, '.cube-rows');

    it('stays at the top of the screen, over every layer a page draws', () => {
        expect(pinned).toMatch(/position\s*:\s*sticky\s*;/);
        expect(pinned).toMatch(/(^|[\s;{])top\s*:\s*0\s*;/);
        expect(pinned).toMatch(/z-index\s*:\s*1020\s*;/);
    });

    it('is the phone\'s header alone: no other header a phone shows is pinned', () => {
        expect(anonymous.match(/position\s*:\s*sticky/g)).toHaveLength(1);
    });

    it('stops the views that scroll themselves into sight below it, not under it, the phone\'s rows too (#188)', () => {
        expect(anonymous).toMatch(/\.stream-layout,\s*\.data-listing,\s*\.cube-rows\s*\{/);
        expect(views).toMatch(/scroll-margin-top\s*:\s*calc\(57px \+ 1\.5rem\)\s*;/);
    });

    it('holds nothing else under it: the sunburst\'s column names went with it (#188)', () => {
        expect(anonymous).not.toMatch(/sunburst/);
    });
});

describe('the Login gray by night (#175, #177)', () => {
    const anonymous = read('_navigation_anonymous.scss');
    const variables = read('_variables.scss');
    const [mixin] = blocks(anonymous, '@mixin login-night');
    const rules = [
        ['the phone menu\'s Login', blocks(anonymous, '.btn:not(.btn-primary)')[0]],
        ['the headers\' Login in', blocks(anonymous, '.menu-container a.btn.mn-2')[0]],
    ];

    it('is one gray: a #444 fill and a #5a5a5a border, with no gradient', () => {
        expect(own(mixin)).toMatch(/background-color\s*:\s*\$dark-gray-3\s*;/);
        expect(own(mixin)).toMatch(/background-image\s*:\s*none\s*;/);
        expect(own(mixin)).toMatch(/border-color\s*:\s*\$dark-gray-5\s*;/);
        expect(variables).toMatch(/\$dark-gray-3\s*:\s*#444\s*;/);
        expect(variables).toMatch(/\$dark-gray-5\s*:\s*#5a5a5a\s*;/);
    });

    it.each(rules)('is worn by %s, by night only', (name, rule) => {
        const [night] = blocks(rule, '@include dark');

        expect(night).toMatch(/@include login-night\s*;/);
        expect(own(rule)).not.toMatch(/login-night/);
    });
});

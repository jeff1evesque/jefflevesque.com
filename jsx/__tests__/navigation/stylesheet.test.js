/**
 * stylesheet.test.js: what the header's stylesheet promises about the light and
 * dark switch, read out of '_navigation.scss'.
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

const SCSS = path.resolve(__dirname, '../../../scss/_navigation.scss');

const source = fs.readFileSync(SCSS, 'utf8').replace(/\/\/.*$/gm, '');

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

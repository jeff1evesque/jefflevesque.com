/**
 * stylesheet.test.js: what the forms' stylesheet promises about a text box and
 * the panel it sits in, read out of '_webform.scss' and '_variables.scss'.
 *
 * jsdom draws no form controls, so no suite can see the color a browser fills a
 * text box with. What can be held is the rule that decides it: a text box on the
 * sign-in, reset and register forms is filled with the page's own color in either
 * theme, rather than left to the browser. Left to it, a text box on a dark page
 * was a mid gray in Chrome on a desktop, and black in Safari on an iPhone.
 *
 * And the panel around it, which by night stood half as far off the page as by
 * day, so a text box on it read as little more than its border.
 *
 * Note: read the way navigation/stylesheet.test.js reads '_navigation.scss':
 *       comments taken out, and a block found by its header, whole.
 */

import fs from 'fs';
import path from 'path';

const SCSS = path.resolve(__dirname, '../../../scss/_webform.scss');
const VARIABLES = path.resolve(__dirname, '../../../scss/_variables.scss');

const source = fs.readFileSync(SCSS, 'utf8').replace(/\/\/.*$/gm, '');
const variables = fs.readFileSync(VARIABLES, 'utf8');

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
// a color '_variables.scss' names, as '#rgb' or '#rrggbb'
//
const value = (name) => (variables.match(new RegExp(`^\\$${name}\\s*:\\s*(#[0-9a-f]{3,6})\\s*;`, 'im')) || [])[1];

//
// the WCAG relative luminance of '#rgb' or '#rrggbb', and the ratio of two
//
const luminance = (hex) => {
    const digits = hex.slice(1);
    const full = digits.length === 3 ? digits.replace(/./g, '$&$&') : digits;
    const [r, g, b] = [0, 2, 4].map((at) => {
        const c = parseInt(full.slice(at, at + 2), 16) / 255;

        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);

    return (light + 0.05) / (dark + 0.05);
};

describe('a text box', () => {
    const [form] = blocks(source, 'form');
    const [box] = form ? blocks(form, '.input-block') : [];

    it('is drawn by a rule of its own', () => {
        expect(box).toBeDefined();
    });

    it('is filled with the page\'s own color, in either theme', () => {
        //
        // '$white-1' is the page by day and by night -- see '_theme.scss' -- and
        // what '.form-control' and /graph's filter are filled with on a dark page
        //
        expect(box).toMatch(/background-color\s*:\s*\$white-1\s*;/);
    });
});

describe('the panel a text box sits in', () => {
    //
    // '.form-highlight' heads three blocks: this one, a margin shared with
    // '.form-body', and the register form's padding
    //
    const panel = blocks(source, '.form-highlight').find((block) => /background-color/.test(block));
    const [night] = panel ? blocks(panel, '@include dark') : [];

    it('is tinted by name, by day and by night', () => {
        expect(panel).toMatch(/background-color\s*:\s*\$form-panel\s*!important\s*;/);
        expect(night).toMatch(/background-color\s*:\s*\$dark-form-panel\s*!important\s*;/);
    });

    it('keeps its tint by day', () => {
        expect(value('form-panel')).toBe('#f7f5f7');
    });

    it('stands as far off the page by night as by day, and so the text box off it', () => {
        //
        // about 1.09:1 in either theme. '$white-2', the panel before, stood
        // 1.05:1 off the page by night
        //
        const day = contrast(value('white-1'), value('form-panel'));
        const night = contrast(value('dark-white-1'), value('dark-form-panel'));

        expect(night).toBeCloseTo(day, 2);
    });
});

/**
 * stylesheet.test.js: what /stream's stylesheet promises about a stream on its
 * own (#206), read out of '_stream.scss'.
 *
 * jsdom lays nothing out and resolves no stylesheet, so no suite can see where
 * the figures stand or the color a value is drawn in. What can be held is the
 * rule that decides them: the figures' line starting at the left, the color of
 * each tone stream-focus.jsx gives a value, and the info icon after each name.
 *
 * Note: read the way navigation/stylesheet.test.js reads '_navigation.scss':
 *       comments taken out, and a block found by its header, whole.
 */

import fs from 'fs';
import path from 'path';

//
// a partial's text, its comments taken out
//
function read(file) {
    return fs.readFileSync(path.resolve(__dirname, '../../../../scss', file), 'utf8').replace(/\/\/.*$/gm, '');
}

const source = read('_stream.scss');

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

describe('the figures of a stream on its own (#206)', () => {
    const [wide, phone] = blocks(source, '.stream-focus-figures');

    it('start at the left, in line with the title and its schedule', () => {
        //
        // centered on the page, they lined up with nothing: the title over them
        // starts at the left, and the rate's buttons are centered on another
        // point
        //
        expect(own(wide)).toMatch(/justify-content\s*:\s*flex-start\s*;/);
        expect(own(wide)).not.toMatch(/justify-content\s*:\s*center\s*;/);
    });

    it('split a phone\'s line in three even columns, under the graph, with room between them', () => {
        expect(own(phone)).toMatch(/display\s*:\s*grid\s*;/);
        expect(own(phone)).toMatch(/grid-template-columns\s*:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)\s*;/);
        expect(own(phone)).toMatch(/gap\s*:\s*0\.75rem\s*;/);
    });

    it('keep the wide screen\'s box on a phone, name and value centered in it', () => {
        //
        // the phone's rule takes away only the wide screen's width and its wide
        // sides: the box, its corners and its centering are the wide screen's
        //
        const [box, phoneBox] = blocks(source, '.stream-focus-figure');

        expect(own(box)).toMatch(/align-items\s*:\s*center\s*;/);
        expect(own(box)).toMatch(/background-color\s*:\s*\$white-2\s*;/);
        expect(own(box)).toMatch(/border\s*:\s*1px solid \$gray-2\s*;/);
        expect(own(phoneBox)).toMatch(/min-width\s*:\s*0\s*;/);
        expect(own(box)).toMatch(/padding\s*:\s*0\.6rem 1\.5rem\s*;/);
        expect(own(phoneBox)).toMatch(/padding\s*:\s*0\.6rem 0\.25rem\s*;/);
        expect(own(phoneBox)).not.toMatch(/align-items|background|border/);
    });
});

describe('the color a value is drawn in (#206)', () => {
    const tone = (name) => own(blocks(source, `.stream-focus-figure-${name}`)[0] || '');

    it('is the site\'s green for a figure at 95% or more', () => {
        expect(tone('good')).toMatch(/color\s*:\s*\$green-6\s*;/);
    });

    it('is the bars\' own red for a Health under it', () => {
        expect(tone('bad')).toMatch(/color\s*:\s*var\(--stream-missed\)\s*;/);
    });

    it('is the bars\' darkest blue for Total Records, which is the bars added up', () => {
        expect(tone('total')).toMatch(/color\s*:\s*var\(--stream-shade-0\)\s*;/);
    });

    it('has a night color of its own for each, so the dark page draws them lighter', () => {
        const [day] = blocks(source, ':root');
        const [night] = blocks(source, ':root[data-theme=\'dark\']');
        const theme = read('_theme.scss');

        expect(day).toMatch(/--stream-missed\s*:\s*#d03b3b\s*;/);
        expect(day).toMatch(/--stream-shade-0\s*:\s*#1c5cab\s*;/);
        expect(night).toMatch(/--stream-missed\s*:\s*#e66767\s*;/);
        expect(night).toMatch(/--stream-shade-0\s*:\s*#86b6ef\s*;/);
        expect(theme).toMatch(/'green-6'\s*:\s*\(\s*\$green-6\s*,\s*\$dark-green-6\s*\)/);
    });
});

describe('the info icon after a figure\'s name (#206)', () => {
    const [noted] = blocks(source, '.stream-focus .stream-focus-noted');
    const [icon] = noted ? blocks(noted, 'svg') : [];

    it('stays on the name\'s line', () => {
        expect(own(noted)).toMatch(/white-space\s*:\s*nowrap\s*;/);
    });

    it('is the name\'s size, a little off it, and sits on its line as /graph\'s does', () => {
        expect(icon).toMatch(/font-size\s*:\s*1em\s*;/);
        expect(icon).toMatch(/margin-left\s*:\s*0\.2em\s*;/);
        expect(icon).toMatch(/vertical-align\s*:\s*-0\.125em\s*;/);
    });

    it('takes no color of its own, so it is the name\'s gray', () => {
        expect(icon).not.toMatch(/(^|[^-])color\s*:/);
    });
});

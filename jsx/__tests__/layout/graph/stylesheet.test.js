/**
 * stylesheet.test.js: what the graph page's stylesheet promises about the legend
 * and the reference columns, read out of '_graph.scss'.
 *
 * jsdom lays nothing out, so no suite can see a name run past the edge of its
 * column. What can be held is the rule that decides it: a namespace's name wraps
 * at its hyphen when its column is too narrow, rather than being clipped. The
 * legend showed 'noaa-cap-mode' and 'market-enrichm' cut off at the edge of the
 * side column when every namespace began to name its source -- see the note above
 * '.graph-legend-namespaces'.
 *
 * Note: read the way breath.test.js reads '_animation.scss': comments taken out,
 *       and a block found by its header, whole.
 */

import fs from 'fs';
import path from 'path';

const SCSS = path.resolve(__dirname, '../../../../scss/_graph.scss');

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

describe('a namespace in the legend', () => {
    const [namespaces] = blocks(source, '.graph-legend-namespaces');
    const [entry] = namespaces ? blocks(namespaces, '.graph-legend-entry') : [];

    it('is laid out by a rule of its own', () => {
        expect(entry).toBeDefined();
    });

    it('is never clipped at the edge of its column', () => {
        expect(entry).not.toMatch(/text-overflow\s*:/);
        expect(entry).not.toMatch(/overflow\s*:\s*hidden/);
        expect(entry).not.toMatch(/white-space\s*:\s*nowrap/);
    });

    it('wraps a name too long for its column, with its swatch beside it', () => {
        expect(entry).toMatch(/overflow-wrap\s*:\s*anywhere\s*;/);
        expect(entry).toMatch(/flex-wrap\s*:\s*nowrap\s*;/);
    });
});

describe('the namespaces, laid out', () => {
    const [namespaces] = blocks(source, '.graph-legend-namespaces');
    const [row] = namespaces ? blocks(namespaces, 'li') : [];
    const [entry] = namespaces ? blocks(namespaces, '.graph-legend-entry') : [];
    const [swatch] = entry ? blocks(entry, '.graph-legend-swatch') : [];

    it('fill their columns top to bottom, so a wrapped name lengthens only its own', () => {
        //
        // a grid fills row by row, and one wrapped name made its whole row two
        // lines tall, over a blank line under the name beside it
        //
        expect(namespaces).toMatch(/columns\s*:\s*8\.5rem\s*;/);
        expect(namespaces).not.toMatch(/display\s*:\s*grid/);
    });

    it('keep each entry whole, and carry no margin over into the next column', () => {
        expect(row).toMatch(/break-inside\s*:\s*avoid\s*;/);
        expect(row).toMatch(/margin-bottom\s*:\s*0\s*;/);
        expect(row).toMatch(/padding-bottom\s*:\s*0\.15rem\s*;/);
    });

    it('sit each swatch level with the first line of its name', () => {
        expect(entry).toMatch(/align-items\s*:\s*flex-start\s*;/);
        expect(swatch).toMatch(/margin-top\s*:\s*calc\(\(1\.5em - 0\.75rem\) \/ 2\)\s*;/);
    });
});

describe('the reference columns beside the graph', () => {
    //
    // the three-column layout, where they ARE side columns. Below it they are
    // bands stacked over the graph, and carry no tint.
    //
    const [wide] = blocks(source, '@media (min-width: $graph-columns)');
    const [panel] = wide ? blocks(wide, '.graph-panel') : [];
    const tinted = wide ? blocks(wide, '.graph-panel-open').find((block) => /background-color/.test(block)) : undefined;
    const tint = tinted ? blocks(tinted, '@include dark').find((block) => /background-color/.test(block)) : undefined;
    const [label] = tinted ? blocks(tinted, '.graph-legend-note') : [];
    const [night] = label ? blocks(label, '@include dark') : [];
    const [hover] = tinted ? blocks(tinted, ".graph-legend-entry:not([aria-pressed='true']):hover") : [];

    it('are tinted a step off the page, in either theme', () => {
        expect(tinted).toMatch(/background-color\s*:\s*\$graph-panel\s*;/);
        expect(tint).toMatch(/background-color\s*:\s*\$dark-graph-panel\s*;/);
    });

    it('run the full height of the row, which is the graph\'s', () => {
        expect(tinted).toMatch(/align-self\s*:\s*stretch\s*;/);
    });

    it('take no padding at the foot, where measureColumns could not see it', () => {
        expect(tinted).not.toMatch(/padding-bottom/);
        expect(tinted).not.toMatch(/padding\s*:/);
    });

    it('take their labels a shade darker by day, and the theme\'s own gray by night', () => {
        expect(label).toMatch(/color\s*:\s*\$graph-panel-label\s*;/);
        expect(night).toMatch(/color\s*:\s*\$gray-6\s*;/);
    });

    it('show a legend row under the pointer a step darker, and leave a held one green', () => {
        expect(hover).toMatch(/background-color\s*:\s*\$gray-2\s*;/);
    });

    it('add the outer padding to their width, so the body keeps $graph-side', () => {
        expect(panel).toMatch(/calc\(#\{\$graph-side\} \+ #\{\$graph-rail-pad\} \+ #\{\$graph-panel-pad\}\)/);
    });
});

describe('the tint, against the labels on it', () => {
    //
    // small text wants 4.5:1. The page's own '$gray-6' falls short of it on the
    // day's tint, which is the reason the labels change at all.
    //
    const VARIABLES = path.resolve(__dirname, '../../../../scss/_variables.scss');
    const variables = fs.readFileSync(VARIABLES, 'utf8');

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

    it('holds the day\'s labels at 4.5:1 or better', () => {
        expect(contrast(value('graph-panel-label'), value('graph-panel'))).toBeGreaterThanOrEqual(4.5);
    });

    it('holds the night\'s labels at 4.5:1 or better, in the theme\'s own gray', () => {
        expect(contrast(value('dark-gray-6'), value('dark-graph-panel'))).toBeGreaterThanOrEqual(4.5);
    });

    it('is where the page\'s own gray falls short by day', () => {
        expect(contrast(value('gray-6'), value('graph-panel'))).toBeLessThan(4.5);
    });
});

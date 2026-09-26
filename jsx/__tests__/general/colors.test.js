/**
 * colors.test.js: the shared color scheme.
 *
 * Two claims in this module are checkable rather than decorative, and both are
 * checked here instead of trusted:
 *
 *   1. "this file should coincide with '_variables.scss'". It has already drifted
 *      once -- the module's own comment records 'green-6' having been '#2ca02c'
 *      while the stylesheet said something else. So the scss is parsed at test
 *      time and every shared name compared, which is the only way that note can
 *      hold on its own.
 *
 *   2. the categorical palette is documented as separating by "dE 9.1 under
 *      simulated colorblindness and 19.6 under normal vision (OKLab x100; the
 *      gates are 8 and 15)". OKLab and a deuteranopia simulation are implemented
 *      below so adding, removing or reordering a color cannot quietly break
 *      that.
 *
 * Note on the deutan figure: this file uses the Vienot 1999 simulation, which
 *       reads the worst adjacent pair at dE 8.00 where the module's comment says
 *       9.1 -- the comment was produced with a different (more forgiving) model.
 *       The assertion below is therefore against the documented GATE of 8, not
 *       against 9.1, and the true margin under this model is essentially zero.
 *       That is worth knowing before adding a ninth color.
 */

import fs from 'fs';
import path from 'path';

import {
    color_other,
    color_tail,
    colors,
    colors_categorical,
    colors_dark,
    ink,
    themeColors,
    toRGB,
    translucent
} from '../../import/general/colors.js';

const VARIABLES_SCSS = path.resolve(__dirname, '../../../scss/_variables.scss');
const THEME_SCSS = path.resolve(__dirname, '../../../scss/_theme.scss');

//
// OKLab, per Bjorn Ottosson's reference conversion. Distance is plain euclidean
// in OKLab, scaled by 100 to match the units the module's comment uses.
//
function srgbToLinear(c) {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function hexToLinear(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => srgbToLinear(v / 255));
}

function linearToOklab([r, g, b]) {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

    return [
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    ];
}

//
// Vienot 1999 deuteranopia, applied in linear rgb. Deutan is the most common
// confusion type, and red/green adjacency is the pair the previous palette got
// wrong.
//
function deutan([r, g, b]) {
    return [
        0.625 * r + 0.375 * g,
        0.700 * r + 0.300 * g,
        0.300 * g + 0.700 * b,
    ];
}

function dE(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100;
}

function worstAdjacent(palette, transform = v => v) {
    let worst = Infinity;

    for (let i = 0; i < palette.length - 1; i++) {
        const d = dE(
            linearToOklab(transform(hexToLinear(palette[i]))),
            linearToOklab(transform(hexToLinear(palette[i + 1])))
        );
        worst = Math.min(worst, d);
    }

    return worst;
}

describe('colors, against _variables.scss', () => {
    const scss = fs.readFileSync(VARIABLES_SCSS, 'utf8');

    it('the stylesheet is where the test expects it', () => {
        expect(scss.length).toBeGreaterThan(0);
    });

    it('every color matches its scss variable', () => {
        //
        // the guard against the drift the module already suffered. A name present
        // here and absent there is reported rather than skipped, since a color
        // with no stylesheet counterpart is the other half of the same problem.
        //
        const mismatched = [];

        Object.keys(colors).forEach(name => {
            const found = scss.match(new RegExp(`^\\$${name}:\\s*([^;]+);`, 'm'));

            if (!found) {
                mismatched.push(`${name}: absent from _variables.scss`);
            } else if (found[1].trim().toLowerCase() !== colors[name].toLowerCase()) {
                mismatched.push(`${name}: js ${colors[name]} vs scss ${found[1].trim()}`);
            }
        });

        expect(mismatched).toEqual([]);
    });

    it('pins green-6, which had drifted before', () => {
        expect(colors['green-6']).toBe('#237616');
    });
});

describe('colors_categorical', () => {
    it('holds eight colors', () => {
        expect(colors_categorical).toHaveLength(8);
    });

    it('holds no duplicates', () => {
        expect(new Set(colors_categorical).size).toBe(colors_categorical.length);
    });

    it('is all six-digit hex, which the OKLab math assumes', () => {
        colors_categorical.forEach(c => expect(c).toMatch(/^#[0-9a-f]{6}$/i));
    });

    it('separates adjacent pairs by at least the normal-vision gate of 15', () => {
        //
        // adjacent pairs specifically: series are assigned in this fixed order, so
        // neighbors are the ones a reader compares side by side in a legend.
        //
        expect(worstAdjacent(colors_categorical)).toBeGreaterThanOrEqual(15);
    });

    it('separates adjacent pairs by at least the deutan gate of 8', () => {
        //
        // see the file header: this reads 8.00 under Vienot 1999 where the module
        // documents 9.1 under another model. It clears the gate, but with no room
        // to spare -- treat any change to this palette as needing a fresh check
        // rather than assuming headroom.
        //
        expect(worstAdjacent(colors_categorical, deutan)).toBeGreaterThanOrEqual(8);
    });

    it('keeps red and green apart, the pair the previous set got wrong', () => {
        //
        // the module records the old five-color set putting '#dc3545' red next to
        // '#198754' green at dE 7.4 deutan. Neither color survives, and the two
        // that replaced them are not neighbors.
        //
        expect(colors_categorical).not.toContain('#dc3545');
        expect(colors_categorical).not.toContain('#198754');

        const red = colors_categorical.indexOf('#e34948');
        const green = colors_categorical.indexOf('#008300');
        expect(Math.abs(red - green)).toBeGreaterThan(1);
    });
});

describe('color_other', () => {
    it('is the documented neutral', () => {
        expect(color_other).toBe('#d3d3ce');
    });

    it('is light and desaturated, so it recedes rather than competing', () => {
        //
        // it stands for an absence of identity, not another category. A mid gray
        // read as the loudest segment whenever the tail was large.
        //
        const [r, g, b] = hexToLinear(color_other);
        const [lightness] = linearToOklab([r, g, b]);
        const chroma = Math.hypot(...linearToOklab([r, g, b]).slice(1));

        expect(lightness).toBeGreaterThan(0.8);
        expect(chroma).toBeLessThan(0.03);
    });

    it('is not one of the categorical colors', () => {
        expect(colors_categorical).not.toContain(color_other);
    });
});

describe('color_tail', () => {
    it('returns an hsl string on the documented hue and saturation', () => {
        expect(color_tail(0, 4)).toMatch(/^hsl\(210, 12%, [\d.]+%\)$/);
    });

    it('runs dark to light, so the tail fades outward from the named series', () => {
        const first = Number(color_tail(0, 5).match(/([\d.]+)%\)/)[1]);
        const last = Number(color_tail(4, 5).match(/([\d.]+)%\)/)[1]);

        expect(first).toBeLessThan(last);
    });

    it('spans exactly the documented lightness range', () => {
        expect(color_tail(0, 5)).toContain('55.0%');
        expect(color_tail(4, 5)).toContain('87.0%');
    });

    it('centers a single member rather than pinning it to the dark end', () => {
        //
        // count of 1 would divide by zero in the interpolation, so it is special
        // cased to the midpoint -- a lone tail member should not read as the
        // darkest possible shade.
        //
        expect(color_tail(0, 1)).toContain('71.0%');
    });

    it('gives every member of a group a distinct lightness', () => {
        const shades = [0, 1, 2, 3, 4, 5].map(i => color_tail(i, 6));

        expect(new Set(shades).size).toBe(6);
    });

    it('shares one hue across the group, so it reads as a single band', () => {
        const hues = [0, 1, 2, 3].map(i => color_tail(i, 4).match(/hsl\((\d+)/)[1]);

        expect(new Set(hues).size).toBe(1);
    });
});

describe('color_tail on a dark page', () => {
    const lightness = (shade) => Number(shade.match(/([\d.]+)%\)/)[1]);

    it('runs light to dark, so the tail still fades toward the page', () => {
        expect(lightness(color_tail(0, 5, 'dark'))).toBeGreaterThan(lightness(color_tail(4, 5, 'dark')));
    });

    it('keeps each shade as far from the dark page as its twin keeps from white', () => {
        //
        // the dark page is '#1e1e1e', 11.8% lightness. The light tail runs from
        // 45 points below white to 13 below it; the dark one from 45 above the
        // page to 13 above it.
        //
        expect(color_tail(0, 5, 'dark')).toContain('57.0%');
        expect(color_tail(4, 5, 'dark')).toContain('25.0%');
    });

    it('keeps the hue and saturation that make it one band', () => {
        expect(color_tail(2, 5, 'dark')).toMatch(/^hsl\(210, 12%, [\d.]+%\)$/);
    });

    it('is the light tail for a theme that is not dark', () => {
        expect(color_tail(1, 5, 'sepia')).toBe(color_tail(1, 5));
    });
});

describe('colors_dark, against _variables.scss', () => {
    const scss = fs.readFileSync(VARIABLES_SCSS, 'utf8');

    it('matches every dark color to its scss variable', () => {
        //
        // the same guard as the light names get, for the same drift: the script
        // that draws a dark graph and the stylesheet that draws a dark page have
        // to agree about what 'gray-5' is on it.
        //
        const mismatched = [];

        Object.keys(colors_dark).forEach(name => {
            const found = scss.match(new RegExp(`^\\$dark-${name}:\\s*([^;]+);`, 'm'));

            if (!found) {
                mismatched.push(`${name}: absent from _variables.scss as $dark-${name}`);
            } else if (found[1].trim().toLowerCase() !== colors_dark[name].toLowerCase()) {
                mismatched.push(`${name}: js ${colors_dark[name]} vs scss ${found[1].trim()}`);
            }
        });

        expect(mismatched).toEqual([]);
    });

    it('darkens only names the light theme has', () => {
        Object.keys(colors_dark).forEach(name => expect(colors).toHaveProperty(name));
    });

    it('is a name the theme partial switches, for every one of them', () => {
        //
        // a dark value the stylesheet never puts in place is a color the script
        // draws that the page around it does not
        //
        const theme = fs.readFileSync(THEME_SCSS, 'utf8');

        Object.keys(colors_dark).forEach(name => {
            expect(theme).toMatch(new RegExp(`'${name}':\\s*\\(\\$${name},\\s*\\$dark-${name}\\)`));
        });
    });
});

describe('themeColors', () => {
    it('is the light colors for the light theme, and for anything else', () => {
        expect(themeColors('light')).toBe(colors);
        expect(themeColors(undefined)).toBe(colors);
        expect(themeColors('sepia')).toBe(colors);
    });

    it('is the dark colors where there are dark ones, and the light elsewhere', () => {
        const dark = themeColors('dark');

        expect(dark['gray-5']).toBe(colors_dark['gray-5']);
        expect(dark['green-3']).toBe(colors['green-3']);
    });

    it('keeps the ramp in order: further from the dark page as the numeral rises', () => {
        //
        // the order the partials rely on, so a rule written for the light theme
        // draws the dark one: '$gray-6' is muted text and '$gray-1' a hairline in
        // either theme
        //
        const six = (hex) => (hex.length === 4 ? `#${hex.slice(1).split('').map(d => d + d).join('')}` : hex);
        const lightness = (hex) => linearToOklab(hexToLinear(six(hex)))[0];
        const ramp = ['white-1', 'gray-1', 'gray-2', 'gray-4', 'gray-3', 'gray-5', 'gray-6', 'gray-7', 'gray-8']
            .map(name => lightness(colors_dark[name]));

        ramp.slice(1).forEach((value, index) => expect(value).toBeGreaterThan(ramp[index]));
    });
});

describe('the dark page, read', () => {
    //
    // WCAG 2 contrast, from relative luminance
    //
    function contrast(a, b) {
        const luminance = (hex) => {
            const [r, g, b] = hexToLinear(hex);
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);

        return (hi + 0.05) / (lo + 0.05);
    }

    const page = () => colors_dark['white-1'];

    it('reads muted text at better than the 4.5:1 body text needs', () => {
        //
        // '#777' manages 4.48:1 on white, just short; the dark twin clears it
        //
        expect(contrast(colors_dark['gray-6'], page())).toBeGreaterThanOrEqual(4.5);
    });

    it('reads labels and text at better than 7:1', () => {
        expect(contrast(colors_dark['gray-7'], page())).toBeGreaterThanOrEqual(7);
        expect(contrast(colors_dark['gray-8'], page())).toBeGreaterThanOrEqual(7);
    });

    it('reads the lit green at better than 4.5:1', () => {
        expect(contrast(colors_dark['green-6'], page())).toBeGreaterThanOrEqual(4.5);
    });

    it('is a dark gray rather than black', () => {
        expect(page()).not.toBe('#000');
        expect(contrast(page(), '#000000')).toBeGreaterThan(1.1);
    });
});

describe('ink', () => {
    it('is black on a light page and white on a dark one', () => {
        expect(ink('light')).toBe('#000');
        expect(ink('dark')).toBe('#fff');
    });
});

describe('translucent', () => {
    it('writes a six-digit color at an opacity as css', () => {
        expect(translucent('#1e1e1e', 0.92)).toBe('rgba(30, 30, 30, 0.92)');
    });

    it('reads a three-digit color as the six-digit one', () => {
        expect(translucent('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
    });
});

describe('toRGB', () => {
    it('converts hex to an rgb string', () => {
        expect(toRGB('#ffffff')).toBe('rgb(255, 255, 255)');
        expect(toRGB('#000000')).toBe('rgb(0, 0, 0)');
    });

    it('accepts a named color, though jsdom does not normalize it', () => {
        //
        // ENVIRONMENT DIFFERENCE, not a defect. A real browser resolves
        // style.color = 'red' to 'rgb(255, 0, 0)'; jsdom's css parser accepts the
        // keyword and hands it back unchanged. Hex converts identically in both,
        // which is what every caller here passes -- the colors map and the
        // categorical palette are hex throughout.
        //
        // So this asserts only that a keyword survives, not what it becomes. A
        // caller depending on rgb() output for a keyword would behave differently
        // in the browser than under test.
        //
        expect(toRGB('red')).toBeTruthy();
    });

    it('converts every categorical color without failing', () => {
        colors_categorical.forEach(c => {
            expect(toRGB(c)).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
        });
    });

    it('returns empty for something that is not a color', () => {
        //
        // it works by assigning to a detached element's style, and the css parser
        // simply refuses an invalid value -- so the result is '' rather than a
        // throw.
        //
        expect(toRGB('not-a-color')).toBe('');
    });
});

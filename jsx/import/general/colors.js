/**
 * colors.js: define consistent color scheme.
 *
 * Note: this file should coincide with '_variables.scss'.
 *
 * Note: `colors` is the light theme's, and `colors_dark` the dark theme's
 *       values for the names that change -- as '$dark-<name>' in
 *       '_variables.scss'. A drawing that computes its colors in script reads
 *       them through themeColors, for the theme ThemeModeContext says is
 *       showing. See theme-mode.jsx.
 */

const toRGB = (color) => {
     const { style } = new Option();
     style.color = color;
     return style.color;
}

const colors = {
    'white-1': '#fff',
    'gray-8': '#1a1a1a',
    'gray-7': '#333',
    'gray-6': '#777',
    'gray-5': '#bebebe',
    'gray-4': '#d5d5d5',
    'gray-3': '#ccc',
    'gray-2': '#ddd',
    'gray-1': '#eee',
    'green-7': '#4a993e',
    // was '#2ca02c', which did not match '$green-6' in '_variables.scss'
    // despite the note above -- realigned so the selected-row border and
    // anything keyed off this name render the same green
    'green-6': '#237616',
    'green-5': '#569e3d',
    'green-4': '#60b044',
    'green-3': '#5ca941',
    'green-2': '#79d858',
    'green-1': '#8add6d',
    'blue': '#1f77b4',
    'orange': '#ff7f0e'
}

/**
 * the dark theme's values for the names that change in it.
 *
 * The ramp keeps its order rather than its values: a higher numeral is further
 * from the page and nearer the text, in either theme. So 'gray-8' is the text a
 * label is written in and 'white-1' is the page, whichever way round the page
 * is, and a drawing that asks for them draws either theme. See the notes on the
 * same names in '_variables.scss'.
 *
 * Note: every other name -- the greens but one, blue and orange -- is the same
 *       color in both themes.
 */
const colors_dark = {
    'white-1': '#1e1e1e',
    'gray-8': '#e6e6e6',
    'gray-7': '#d0d0d0',
    'gray-6': '#a0a0a0',
    'gray-5': '#5a5a5a',
    'gray-4': '#3c3c3c',
    'gray-3': '#444',
    'gray-2': '#363636',
    'gray-1': '#2a2a2a',
    'green-6': '#6cc259'
};

const THEME_COLORS = {
    light: colors,
    dark: { ...colors, ...colors_dark },
};

/**
 * every named color, as `theme` draws it -- the light theme's for anything that
 * is not 'dark'.
 */
function themeColors(theme) {
    return THEME_COLORS[theme] || colors;
}

/**
 * the ink a shade laid over the page is mixed from: black on a light page, and
 * white on a dark one, where a black shade could not be seen. The stylesheet's
 * '--ink-rgb' is the same pair.
 */
function ink(theme) {
    return theme === 'dark' ? '#fff' : '#000';
}

/**
 * a color given as '#rgb' or '#rrggbb', at `alpha` opacity, as css.
 *
 * Note: for an inline style, where the stylesheet's custom properties would
 *       serve -- 'var(--white-1)' -- but the test suite's dom drops them, and a
 *       color a suite cannot read is one it cannot hold to anything.
 */
function translucent(hex, alpha) {
    const digits = hex.replace('#', '');
    const full = digits.length === 3 ? digits.split('').map((d) => d + d).join('') : digits;
    const [r, g, b] = [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16));

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * categorical series colors, assigned in this fixed order and never cycled.
 *
 * validated as a set against the chart surface: worst adjacent pair separates
 * by dE 9.1 under simulated colorblindness and 19.6 under normal vision (OKLab
 * x100; the gates are 8 and 15). the previous five-color set put '#dc3545' red
 * adjacent to '#198754' green at dE 7.4 deutan, the most common confusion pair.
 *
 * three of these sit below 3:1 contrast on a light surface, which is acceptable
 * only because every series is also named in the legend and the click-through
 * sheet -- identity is never carried by color alone.
 */
const colors_categorical = [
    '#2a78d6', // blue
    '#eb6834', // orange
    '#1baf7a', // aqua
    '#eda100', // yellow
    '#e87ba4', // magenta
    '#008300', // green
    '#4a3aa7', // violet
    '#e34948'  // red
];

/**
 * the rolled-up remainder beyond the categorical slots.
 *
 * deliberately neutral and light: it is an absence of identity rather than
 * another category, so it should recede behind the named series instead of
 * competing with them. a mid gray read as the loudest segment whenever the
 * tail was large.
 */
const color_other = '#d3d3ce';

/**
 * shades for the series past the categorical slots.
 *
 * rather than collapsing the tail into one 'Other' block, each member keeps its
 * own segment and its own hover, but they all share a single desaturated hue and
 * differ only in lightness. the group reads as one band -- 'the long tail' --
 * while every part of it stays individually identifiable, which a single lump
 * cannot do.
 *
 * lightness runs dark to light so the tail fades outward from the named series.
 *
 * on a dark page it runs the other way, light to dark, for the same reason: the
 * tail fades toward the page. each shade keeps the distance from the page its
 * light twin keeps from white -- 55% is 45 points from white, and 57% is 45 from
 * the dark page's 12 -- so the band recedes as far in either theme.
 */
const COLOR_TAIL_HUE = 210;
const COLOR_TAIL_SATURATION = 12;
const COLOR_TAIL_LIGHTNESS = { from: 55, to: 87 };
const COLOR_TAIL_LIGHTNESS_DARK = { from: 57, to: 25 };

function color_tail(index, count, theme = 'light') {
    const { from, to } = theme === 'dark' ? COLOR_TAIL_LIGHTNESS_DARK : COLOR_TAIL_LIGHTNESS;

    const lightness = count > 1
        ? from + ((to - from) * (index / (count - 1)))
        : (from + to) / 2;

    return `hsl(${COLOR_TAIL_HUE}, ${COLOR_TAIL_SATURATION}%, ${lightness.toFixed(1)}%)`;
}

export { toRGB, colors, colors_dark, themeColors, ink, translucent, colors_categorical, color_other, color_tail };

/**
 * colors.js: define consistent color scheme.
 *
 * Note: this file should coincide with '_variables.scss'.
 */

const toRGB = (color) => {
     const { style } = new Option();
     style.color = color;
     return style.color;
}

const colors = {
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
 * competing with them. a mid grey read as the loudest segment whenever the
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
 */
const COLOR_TAIL_HUE = 210;
const COLOR_TAIL_SATURATION = 12;
const COLOR_TAIL_LIGHTNESS = { min: 55, max: 87 };

function color_tail(index, count) {
    const { min, max } = COLOR_TAIL_LIGHTNESS;

    const lightness = count > 1
        ? min + ((max - min) * (index / (count - 1)))
        : (min + max) / 2;

    return `hsl(${COLOR_TAIL_HUE}, ${COLOR_TAIL_SATURATION}%, ${lightness.toFixed(1)}%)`;
}

export { toRGB, colors, colors_categorical, color_other, color_tail };

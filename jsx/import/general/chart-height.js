/**
 * chart-height.js: one height for every top-of-page chart.
 *
 * the distribution barchart on '/data' and the stacked area chart on '/stream'
 * occupy the same slot -- chart above, article listing below -- so they have to
 * resolve to the same pixel height at any given viewport, or the listing starts
 * at a different place on each page and the layout jumps when moving between
 * them.
 *
 * the height is derived from the VIEWPORT width rather than the chart's own
 * container: the mobile barchart renders inside a horizontally scrolling div
 * that is deliberately wider than the screen (one fixed-width slot per bar), so
 * a container-relative rule (recharts' 'aspect') would make that chart tall in
 * proportion to its bar count while the area chart stayed short.
 *
 * the ratio keeps the chart shrinking with the browser, and the clamps stop the
 * two failure modes at the ends: a chart too short to read a stacked bar on a
 * phone, and a pancake-flat band on an ultrawide monitor that also pushes the
 * listing off the fold.
 *
 * Note: this file should coincide with '_variables.scss'.
 */

const CHART_HEIGHT_MIN = 300;
const CHART_HEIGHT_MAX = 420;
const CHART_HEIGHT_RATIO = 0.28;

/**
 * room reserved below the plot for the x-axis labels.
 *
 * matching the container height is not enough on its own: whatever the axis
 * takes is subtracted from the plotted band, so two charts of the same height
 * still draw different sized graphs if one reserves more. the barchart needs
 * the larger figure -- its categories are angled full words like the gics
 * sector names, where the time ticks on the area chart would fit in a third of
 * it -- so both charts reserve the larger, and the area chart carries the
 * remainder as whitespace under its labels.
 *
 * the mobile barchart is excluded: its reservation is computed per stream from
 * the longest category label, and is a scrolling axis rather than a fixed one.
 */
const CHART_X_AXIS_HEIGHT = 80;
const CHART_X_AXIS_HEIGHT_MOBILE = 26;

/**
 * angle of the x-axis labels, shared so both charts read the same way.
 *
 * the barchart angles out of necessity -- its categories are long enough to
 * collide when horizontal. the area chart's time ticks have no such problem, so
 * angling them is a consistency choice rather than a fitting one, with the side
 * effect of pushing the labels down into the reserved band and shrinking the
 * whitespace beneath them.
 *
 * mobile stays horizontal on both: at 9px there is no room to descend into.
 */
const CHART_X_AXIS_ANGLE = -35;
const CHART_X_AXIS_ANCHOR = 'end';

/**
 * resolve the shared chart height for a viewport width.
 *
 * the width argument is optional so callers can pass an explicit value in a
 * test; it falls back to the current window, and to the minimum when there is
 * no window at all.
 */
export default function chartHeight(viewport_width) {
    const width = typeof viewport_width === 'number' && viewport_width > 0
        ? viewport_width
        : (typeof window !== 'undefined' ? window.innerWidth : 0);

    if (! width) {
        return CHART_HEIGHT_MIN;
    }

    return Math.round(
        Math.min(CHART_HEIGHT_MAX, Math.max(CHART_HEIGHT_MIN, width * CHART_HEIGHT_RATIO))
    );
}

export {
    CHART_HEIGHT_MIN,
    CHART_HEIGHT_MAX,
    CHART_HEIGHT_RATIO,
    CHART_X_AXIS_HEIGHT,
    CHART_X_AXIS_HEIGHT_MOBILE,
    CHART_X_AXIS_ANGLE,
    CHART_X_AXIS_ANCHOR
};

/**
 * chart-height.test.js: the shared chart height and x-axis metrics.
 *
 * Every chart on the page reads these, so a change reflows all of them at once.
 * The height is clamped rather than purely proportional, which is the part worth
 * pinning: without the clamp a narrow phone gets a chart too short to read and a
 * wide desktop gets one that pushes the legend off screen.
 */

import chartHeight, {
    CHART_HEIGHT_MAX,
    CHART_HEIGHT_MIN,
    CHART_HEIGHT_RATIO,
    CHART_X_AXIS_ANCHOR,
    CHART_X_AXIS_ANGLE,
    CHART_X_AXIS_HEIGHT,
    CHART_X_AXIS_HEIGHT_MOBILE
} from '../../import/general/chart-height.js';

describe('the constants', () => {
    it('are the documented values', () => {
        expect(CHART_HEIGHT_MIN).toBe(300);
        expect(CHART_HEIGHT_MAX).toBe(420);
        expect(CHART_HEIGHT_RATIO).toBe(0.28);
    });

    it('leave the clamp the right way round', () => {
        expect(CHART_HEIGHT_MIN).toBeLessThan(CHART_HEIGHT_MAX);
    });

    it('reserve less x-axis room on mobile', () => {
        //
        // the desktop axis carries angled labels and needs the height; the mobile
        // one does not render them, so reserving 80px there would waste a third of
        // a phone screen.
        //
        expect(CHART_X_AXIS_HEIGHT).toBe(80);
        expect(CHART_X_AXIS_HEIGHT_MOBILE).toBe(26);
        expect(CHART_X_AXIS_HEIGHT_MOBILE).toBeLessThan(CHART_X_AXIS_HEIGHT);
    });

    it('angle the labels negatively and anchor them at the end', () => {
        //
        // the two go together: a negative angle rotates counter-clockwise, so the
        // label has to hang from its end to stay under its tick rather than
        // drifting left of it.
        //
        expect(CHART_X_AXIS_ANGLE).toBe(-35);
        expect(CHART_X_AXIS_ANCHOR).toBe('end');
    });
});

describe('chartHeight', () => {
    it('scales with the viewport between the bounds', () => {
        expect(chartHeight(1300)).toBe(364);   // 1300 * 0.28
    });

    it('clamps to the minimum on a narrow viewport', () => {
        expect(chartHeight(320)).toBe(CHART_HEIGHT_MIN);
        expect(chartHeight(1)).toBe(CHART_HEIGHT_MIN);
    });

    it('clamps to the maximum on a wide viewport', () => {
        expect(chartHeight(4000)).toBe(CHART_HEIGHT_MAX);
    });

    it('returns a whole number of pixels', () => {
        [700, 1101, 1234, 1499].forEach(w => {
            expect(Number.isInteger(chartHeight(w))).toBe(true);
        });
    });

    it('never leaves the bounds, for any width', () => {
        for (let w = 100; w <= 3000; w += 137) {
            const h = chartHeight(w);
            expect(h).toBeGreaterThanOrEqual(CHART_HEIGHT_MIN);
            expect(h).toBeLessThanOrEqual(CHART_HEIGHT_MAX);
        }
    });

    it('never shrinks as the viewport grows', () => {
        let previous = 0;

        for (let w = 200; w <= 2600; w += 100) {
            const h = chartHeight(w);
            expect(h).toBeGreaterThanOrEqual(previous);
            previous = h;
        }
    });

    it('falls back to the window when given no width', () => {
        //
        // the argument exists so a caller (or a test) can pass an explicit value;
        // the normal path reads the live viewport.
        //
        window.innerWidth = 1200;

        expect(chartHeight()).toBe(336);   // 1200 * 0.28
    });

    it('falls back to the minimum for a width that is not a positive number', () => {
        window.innerWidth = 0;

        expect(chartHeight(0)).toBe(CHART_HEIGHT_MIN);
        expect(chartHeight(-500)).toBe(CHART_HEIGHT_MIN);
        expect(chartHeight('1200')).toBe(CHART_HEIGHT_MIN);
        expect(chartHeight(null)).toBe(CHART_HEIGHT_MIN);
        expect(chartHeight(NaN)).toBe(CHART_HEIGHT_MIN);
    });
});

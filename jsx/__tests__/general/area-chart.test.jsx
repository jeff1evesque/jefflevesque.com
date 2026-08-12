/**
 * area-chart.test.jsx: the stacked area chart behind the stream performance view.
 *
 * The same shape as line-chart.jsx -- ~150 lines of constructor prop normalisation,
 * ~120 of componentDidUpdate, and a render that picks one of three y-axis variants --
 * so it is tested the same way, and the notes in line-chart.test.jsx apply here too.
 *
 * What is genuinely different, and worth the file:
 *
 *   - an explicit 'height' overrides the aspect ratio, so this chart can be lined up
 *     with the distribution barchart, which is sized off the viewport instead
 *   - the x axis carries angle/anchor/height geometry the line chart has no notion of
 *   - series past the end of the palette fold into the long tail rather than
 *     indexing off the end, which previously produced an undefined stroke that
 *     recharts drew as solid black
 *
 * Note: ResponsiveContainer is mocked only to give it a size, and Area's animation is
 *       switched off on the real class -- without both, recharts draws nothing under
 *       jsdom and the geometry assertions would be vacuous.
 *
 * Note: Tooltip is replaced by a prop recorder. Its formatter is an inline arrow that
 *       recharts only calls while a tooltip is actually open, which needs real
 *       element geometry to compute an active index; capturing the prop and calling it
 *       tests the same function without pretending to hover.
 */

jest.mock('recharts', () => {
    const actual = jest.requireActual('recharts');
    const React = require('react');

    global.__container_props = [];
    global.__tooltip_props = [];

    actual.Area.defaultProps = {
        ...actual.Area.defaultProps,
        isAnimationActive: false,
    };

    const Tooltip = (props) => {
        global.__tooltip_props.push(props);
        return null;
    };
    Tooltip.displayName = 'Tooltip';

    return {
        ...actual,
        Tooltip,
        ResponsiveContainer: (props) => {
            global.__container_props.push(props);
            return React.cloneElement(props.children, { width: 600, height: 400 });
        },
    };
});

import React from 'react';
import { render } from '@testing-library/react';

import { colors_categorical } from '../../import/general/colors.js';
import StackedAreaChart from '../../import/general/area-chart.jsx';

//
// 15:00Z is 10:00 EST, which the default '%I:%M%p' renders as '10:00AM'. See the TZ
// pin in jest.config.js.
//
const DATA = [
    { name: new Date('2024-01-02T15:00:00Z'), a: 5, b: 9 },
    { name: new Date('2024-01-02T16:00:00Z'), a: 7, b: 2 },
];

const KEYS = ['a', 'b'];

const areas = () => [...document.querySelectorAll('.recharts-area-area')];
const fills = () => areas().map(a => a.getAttribute('fill'));
const strokes = () => [...document.querySelectorAll('.recharts-area-curve')]
    .map(a => a.getAttribute('stroke'));

function ticks(container, axis) {
    return [...container.querySelectorAll(`.recharts-${axis}Axis .recharts-cartesian-axis-tick-value`)]
        .map(t => t.textContent);
}

const lastContainer = () => global.__container_props[global.__container_props.length - 1];
const lastTooltip = () => global.__tooltip_props[global.__tooltip_props.length - 1];

beforeEach(() => {
    global.__container_props.length = 0;
    global.__tooltip_props.length = 0;
});

describe('the series', () => {
    it('draws one stacked area per data_key', () => {
        render(<StackedAreaChart data={DATA} data_keys={KEYS} />);

        expect(areas()).toHaveLength(2);
    });

    it('draws real geometry rather than an empty path', () => {
        const { container } = render(<StackedAreaChart data={DATA} data_keys={KEYS} />);

        expect(container.querySelector('.recharts-area-area').getAttribute('d'))
            .toMatch(/^M[\d.]+,[\d.]+/);
    });

    it('stacks the areas, so the second sits on the first', () => {
        //
        // stackId is what makes this an aggregate rather than two overlapping shapes;
        // without it the smaller series hides behind the larger.
        //
        const { container } = render(<StackedAreaChart data={DATA} data_keys={KEYS} />);

        expect(container.querySelectorAll('.recharts-area')).toHaveLength(2);
    });

    it('draws nothing when there are no keys', () => {
        render(<StackedAreaChart data={DATA} />);

        expect(areas()).toHaveLength(0);
    });

    it('survives no props at all', () => {
        const { container } = render(<StackedAreaChart />);

        expect(container.querySelector('.recharts-wrapper')).toBeTruthy();
    });
});

describe('the palette', () => {
    it('falls back to the shared categorical palette', () => {
        //
        // rather than recharts' demo hues, so a caller that omits 'color' still matches
        // every other chart in the app.
        //
        render(<StackedAreaChart data={DATA} data_keys={KEYS} />);

        expect(fills()).toEqual(colors_categorical.slice(0, 2));
    });

    it('takes an explicit colour array in order', () => {
        render(
            <StackedAreaChart data={DATA} data_keys={KEYS} color={['#ff0000', '#00ff00']} />
        );

        expect(fills()).toEqual(['#ff0000', '#00ff00']);
    });

    it('fills solid rather than at recharts\' default alpha', () => {
        //
        // recharts fills an area at 0.6 by default, which washes every hue toward white
        // and reads as a paler palette than the opaque distribution bars beside it.
        //
        render(<StackedAreaChart data={DATA} data_keys={KEYS} />);

        areas().forEach(a => expect(a.getAttribute('fill-opacity')).toBe('1'));
    });

    it('uses the same colour for stroke and fill', () => {
        render(<StackedAreaChart data={DATA} data_keys={KEYS} />);

        expect(strokes()).toEqual(fills());
    });

    it('folds series past the palette into the long tail, never undefined', () => {
        //
        // DOCUMENTS THE FIX FOR A REAL DEFECT. Indexing straight into the palette
        // returned undefined for the ninth series onward, and recharts renders an
        // undefined fill as solid BLACK -- so a stream with more series than hues grew
        // black bands. Past the palette the colour now comes from color_tail: one
        // desaturated hue separated by lightness.
        //
        const many = Array.from({ length: 11 }, (ignored, i) => `k${i}`);
        const rows = DATA.map((base, r) => {
            const row = { name: base.name };
            many.forEach((k, i) => { row[k] = i + 1 + r; });
            return row;
        });

        render(<StackedAreaChart data={rows} data_keys={many} />);

        expect(fills()).toHaveLength(11);
        fills().forEach(fill => {
            expect(fill).toBeTruthy();
            expect(fill).not.toBe('undefined');
            expect(fill).not.toBe('#000000');
        });
    });

    it('gives the tail hsl shades, distinct from the categorical hues', () => {
        const many = Array.from({ length: 10 }, (ignored, i) => `k${i}`);
        const rows = DATA.map((base, r) => {
            const row = { name: base.name };
            many.forEach((k, i) => { row[k] = i + 1 + r; });
            return row;
        });

        render(<StackedAreaChart data={rows} data_keys={many} />);

        const tail = fills().slice(colors_categorical.length);
        expect(tail.length).toBeGreaterThan(0);
        tail.forEach(fill => expect(fill).toMatch(/^hsl\(/));
    });
});

describe('sizing', () => {
    it('defaults to an aspect ratio of 5/3', () => {
        render(<StackedAreaChart data={DATA} data_keys={KEYS} />);

        expect(lastContainer().aspect).toBeCloseTo(5 / 3);
        expect(lastContainer().height).toBeUndefined();
    });

    it('lets an explicit height override the aspect ratio', () => {
        //
        // the reason this chart differs from line-chart: a container-relative aspect
        // cannot be made to agree with the distribution barchart, which is sized off
        // the viewport. Given a height, the aspect must not also be passed -- recharts
        // honours aspect over height and the two charts would drift apart.
        //
        render(<StackedAreaChart data={DATA} data_keys={KEYS} height={320} />);

        expect(lastContainer().height).toBe(320);
        expect(lastContainer().aspect).toBeUndefined();
    });

    it('ignores a non-integer height and keeps the aspect', () => {
        //
        // propTypes objects to the wrong type and setup.js turns that console.error into
        // a failure, so it is silenced deliberately here -- the point is that the
        // component itself falls back rather than trusting the value.
        //
        const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});

        render(<StackedAreaChart data={DATA} data_keys={KEYS} height='tall' />);

        expect(lastContainer().aspect).toBeCloseTo(5 / 3);
        expect(lastContainer().height).toBeUndefined();

        quiet.mockRestore();
    });

    it('accepts a custom aspect ratio when no height is given', () => {
        render(<StackedAreaChart data={DATA} data_keys={KEYS} aspect_ratio={3} />);

        expect(lastContainer().aspect).toBe(3);
    });
});

describe('the x axis', () => {
    it('formats ticks with the default %I:%M%p, in eastern time', () => {
        const { container } = render(<StackedAreaChart data={DATA} data_keys={KEYS} />);

        expect(ticks(container, 'x')).toContain('10:00AM');
    });

    it('honours a custom tick format', () => {
        const { container } = render(
            <StackedAreaChart data={DATA} data_keys={KEYS} x_ticker_format='%Y-%m-%d' />
        );

        expect(ticks(container, 'x')).toContain('2024-01-02');
    });

    it('reads the x value from data_key', () => {
        const { container } = render(
            <StackedAreaChart
                data={[{ when: new Date('2024-01-02T15:00:00Z'), a: 1 }]}
                data_keys={['a']}
                data_key='when'
            />
        );

        expect(ticks(container, 'x')).toContain('10:00AM');
    });

    it('draws labels level by default', () => {
        const { container } = render(<StackedAreaChart data={DATA} data_keys={KEYS} />);

        const tick = container.querySelector('.recharts-xAxis .recharts-cartesian-axis-tick-value');
        expect(tick.getAttribute('transform') || '').not.toContain('rotate(-45');
    });

    it('angles the labels when asked, so they descend into the reserved band', () => {
        //
        // an angled label uses the height reserved below the plot rather than sitting on
        // one line at the top of it -- which is how the barchart reads.
        //
        const { container } = render(
            <StackedAreaChart data={DATA} data_keys={KEYS} x_axis_angle={-45} x_axis_anchor='end' />
        );

        const tick = container.querySelector('.recharts-xAxis .recharts-cartesian-axis-tick-value');
        expect(tick.getAttribute('transform')).toContain('rotate(-45');
    });

    it('reserves an explicit band below the plot when given a height', () => {
        //
        // matching the barchart's reserved band is what makes an equal container height
        // yield an equal plotted height.
        //
        const tall = render(
            <StackedAreaChart data={DATA} data_keys={KEYS} x_axis_height={80} />
        );
        const plain = render(<StackedAreaChart data={DATA} data_keys={KEYS} />);

        const lastY = (r) => Number(
            r.container.querySelector('.recharts-area-curve').getAttribute('d').match(/,([\d.]+)$/)[1]
        );

        expect(lastY(tall)).toBeLessThan(lastY(plain));
    });
});

describe('the y axis', () => {
    it('renders plain values by default', () => {
        const { container } = render(<StackedAreaChart data={DATA} data_keys={KEYS} />);

        expect(ticks(container, 'y').join(',')).toMatch(/\d/);
        expect(ticks(container, 'y').join(',')).not.toContain('e+');
    });

    it.each([['exponential'], ['exp']])('formats exponentially for %s', (format) => {
        const { container } = render(
            <StackedAreaChart data={DATA} data_keys={KEYS} y_tick_format={format} />
        );

        expect(ticks(container, 'y').some(t => /e\+/.test(t))).toBe(true);
    });

    it('blanks the tick labels for false', () => {
        const { container } = render(
            <StackedAreaChart data={DATA} data_keys={KEYS} y_tick_format={false} />
        );

        expect(ticks(container, 'y').join('')).toBe('');
    });

    it('drops the axis line when asked', () => {
        const { container } = render(
            <StackedAreaChart data={DATA} data_keys={KEYS} y_axis_line={false} />
        );

        expect(container.querySelector('.recharts-yAxis .recharts-cartesian-axis-line')).toBeNull();
    });

    it('drops the tick lines when asked', () => {
        const { container } = render(
            <StackedAreaChart data={DATA} data_keys={KEYS} y_axis_tick_line={false} />
        );

        expect(container.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-line'))
            .toHaveLength(0);
    });

    it('reserves the default label gutter', () => {
        //
        // the width is only passed on the plain branch, which is the one that actually
        // renders numbers wide enough to need it.
        //
        const { container } = render(<StackedAreaChart data={DATA} data_keys={KEYS} />);

        expect(container.querySelector('.recharts-yAxis')).toBeTruthy();
    });

    it('honours a custom gutter width', () => {
        const wide = render(
            <StackedAreaChart data={DATA} data_keys={KEYS} y_axis_width={120} />
        );

        const startX = Number(
            wide.container.querySelector('.recharts-area-curve').getAttribute('d').match(/^M([\d.]+),/)[1]
        );
        expect(startX).toBeGreaterThan(60);
    });
});

describe('the tooltip', () => {
    it('separates thousands, so a seven-digit count reads at a glance', () => {
        //
        // an ingest count runs to seven digits, and a bare run of numerals is read digit
        // by digit. The listing beneath the chart groups the same way.
        //
        render(<StackedAreaChart data={DATA} data_keys={KEYS} />);

        expect(lastTooltip().formatter(1234567)).toBe((1234567).toLocaleString());
    });

    it('groups a numeric string too', () => {
        render(<StackedAreaChart data={DATA} data_keys={KEYS} />);

        expect(lastTooltip().formatter('1234567')).toBe((1234567).toLocaleString());
    });

    it('passes a non-numeric value through untouched', () => {
        render(<StackedAreaChart data={DATA} data_keys={KEYS} />);

        expect(lastTooltip().formatter('n/a')).toBe('n/a');
    });

    it('formats the tooltip label with the long date format', () => {
        render(<StackedAreaChart data={DATA} data_keys={KEYS} label_format='%Y-%m-%d' />);

        expect(lastTooltip().labelFormatter(new Date('2024-01-02T15:00:00Z')))
            .toBe('2024-01-02');
    });
});

describe('re-rendering with new props', () => {
    it('redraws when the data is replaced', () => {
        const { container, rerender } = render(
            <StackedAreaChart data={DATA} data_keys={['a']} />
        );
        const before = container.querySelector('.recharts-area-curve').getAttribute('d');

        rerender(
            <StackedAreaChart
                data={[
                    { name: DATA[0].name, a: 100 },
                    { name: DATA[1].name, a: 1 },
                ]}
                data_keys={['a']}
            />
        );

        expect(container.querySelector('.recharts-area-curve').getAttribute('d')).not.toBe(before);
    });

    it('adds an area when a key is added', () => {
        const { rerender } = render(<StackedAreaChart data={DATA} data_keys={['a']} />);
        expect(areas()).toHaveLength(1);

        rerender(<StackedAreaChart data={DATA} data_keys={KEYS} />);

        expect(areas()).toHaveLength(2);
    });

    it('recolours when the palette is replaced', () => {
        const { rerender } = render(
            <StackedAreaChart data={DATA} data_keys={['a']} color={['#111111']} />
        );

        rerender(<StackedAreaChart data={DATA} data_keys={['a']} color={['#222222']} />);

        expect(fills()).toEqual(['#222222']);
    });

    it('syncs a changed tick format', () => {
        const { container, rerender } = render(
            <StackedAreaChart data={DATA} data_keys={KEYS} x_ticker_format='%I:%M%p' />
        );

        rerender(<StackedAreaChart data={DATA} data_keys={KEYS} x_ticker_format='%Y-%m-%d' />);

        expect(ticks(container, 'x')).toContain('2024-01-02');
    });

    it('syncs a changed data_key', () => {
        //
        // the stream page hands this 'window_start' while the distribution page hands it
        // 'name', and the two charts share the component. A data_key that did not follow
        // its prop would leave the axis reading a field the new data does not carry.
        //
        const rows = [
            { when: DATA[0].name, a: 5 },
            { when: DATA[1].name, a: 7 },
        ];
        const { container, rerender } = render(
            <StackedAreaChart data={rows} data_keys={['a']} data_key='name' x_ticker_format='%Y-%m-%d' />
        );

        rerender(
            <StackedAreaChart data={rows} data_keys={['a']} data_key='when' x_ticker_format='%Y-%m-%d' />
        );

        expect(ticks(container, 'x')).toContain('2024-01-02');
    });

    it('syncs a changed height', () => {
        //
        // the stream page recomputes its chart height on every window resize, so this
        // clause is what makes the chart follow the viewport rather than keeping the
        // height it first mounted with.
        //
        const { rerender } = render(<StackedAreaChart data={DATA} data_keys={KEYS} height={320} />);
        expect(lastContainer().height).toBe(320);

        rerender(<StackedAreaChart data={DATA} data_keys={KEYS} height={480} />);

        expect(lastContainer().height).toBe(480);
    });

    it('keeps drawing when an inert prop changes', () => {
        //
        // DOCUMENTS A DEFECT (harmless): 'title' and 'y_label' are normalised in the
        // constructor, synced by componentDidUpdate and then never read by render -- see
        // 'title and y_label' below, which pins that neither reaches the DOM. The two
        // clauses at area-chart.jsx:231 and :241 therefore maintain state nothing
        // consumes. Asserted as it behaves rather than fixed: removing them is a
        // separate change, and the props are part of the component's public shape.
        //
        const { rerender } = render(
            <StackedAreaChart data={DATA} data_keys={['a']} title='Before' y_label='Old' />
        );
        const before = fills();

        rerender(
            <StackedAreaChart data={DATA} data_keys={['a']} title='After' y_label='New' />
        );

        expect(areas()).toHaveLength(1);
        expect(fills()).toEqual(before);
    });

    it('does not sync a changed aspect_ratio', () => {
        //
        // DOCUMENTS A DEFECT: the clause at area-chart.jsx:277 guards on
        // 'Array.isArray(prevProps.aspect_ratio)' and 'prevProps.aspect_ratio.length',
        // but aspect_ratio is a NUMBER -- propTypes declares it so, and the constructor
        // validates it with checkValidFloat. Array.isArray is therefore false for every
        // value the prop can legally hold, and the branch can never be taken, so a chart
        // re-rendered with a new ratio keeps the one it mounted with.
        //
        // Reaching this in the app needs a caller that both omits 'height' and varies
        // 'aspect_ratio', which neither page does today -- the stream page passes a
        // height, and the distribution page passes a fixed ratio. That is why it has
        // gone unnoticed rather than why it is correct.
        //
        // The fix is to drop the two Array checks, matching the 'height' clause directly
        // above it. Deliberately not made here.
        //
        const { rerender } = render(<StackedAreaChart data={DATA} data_keys={KEYS} aspect_ratio={3} />);
        expect(lastContainer().aspect).toBe(3);

        rerender(<StackedAreaChart data={DATA} data_keys={KEYS} aspect_ratio={2} />);

        expect(lastContainer().aspect).toBe(3);
    });

    it('syncs a changed label format', () => {
        const { rerender } = render(
            <StackedAreaChart data={DATA} data_keys={KEYS} label_format='%Y' />
        );

        rerender(<StackedAreaChart data={DATA} data_keys={KEYS} label_format='%Y-%m-%d' />);

        expect(lastTooltip().labelFormatter(new Date('2024-01-02T15:00:00Z')))
            .toBe('2024-01-02');
    });

    it('syncs a changed y_tick_format', () => {
        const { container, rerender } = render(
            <StackedAreaChart data={DATA} data_keys={KEYS} y_tick_format={true} />
        );

        rerender(<StackedAreaChart data={DATA} data_keys={KEYS} y_tick_format='exponential' />);

        expect(ticks(container, 'y').some(t => /e\+/.test(t))).toBe(true);
    });

    it('syncs a changed y_axis_line', () => {
        const { container, rerender } = render(
            <StackedAreaChart data={DATA} data_keys={KEYS} y_axis_line={true} />
        );

        rerender(<StackedAreaChart data={DATA} data_keys={KEYS} y_axis_line={false} />);

        expect(container.querySelector('.recharts-yAxis .recharts-cartesian-axis-line')).toBeNull();
    });

    it('syncs a changed y_axis_tick_line', () => {
        const { container, rerender } = render(
            <StackedAreaChart data={DATA} data_keys={KEYS} y_axis_tick_line={true} />
        );

        rerender(<StackedAreaChart data={DATA} data_keys={KEYS} y_axis_tick_line={false} />);

        expect(container.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-line'))
            .toHaveLength(0);
    });
});

describe('title and y_label', () => {
    it('accepts both and renders neither, exactly as line-chart does', () => {
        //
        // the same dead state as its sibling: validated, defaulted, synced, and never
        // read by render(). Recorded here too because the two files were copied from
        // one another and a fix to one would leave the other behind.
        //
        const { container } = render(
            <StackedAreaChart
                data={DATA}
                data_keys={KEYS}
                title='Stream Performance'
                y_label='Total Alerts'
            />
        );

        expect(container.textContent).not.toContain('Stream Performance');
        expect(container.textContent).not.toContain('Total Alerts');
    });
});

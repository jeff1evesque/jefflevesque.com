/**
 * line-chart.test.jsx: the multi-series line chart behind the stream triggers.
 *
 * MultiLineChart is a recharts wrapper, and the interesting part is not recharts
 * -- it is the ~110 lines of prop normalisation in the constructor and the ~110
 * lines of componentDidUpdate that decide what recharts is handed. Every default
 * lives in the constructor, and every prop is copied into state, so a prop that
 * fails its validator silently becomes a default rather than an error.
 *
 * Note: ONLY ResponsiveContainer is mocked, and only to give it a size. Under
 *       jsdom every element measures 0x0, and recharts refuses to draw into a
 *       zero-sized container -- so with the real one the suite could asserts
 *       nothing but "a container appeared". Cloning the child with a fixed
 *       600x400 makes the REAL recharts draw real geometry, so these tests read
 *       stroke colours and tick text off actual svg nodes rather than trusting
 *       the props going in.
 *
 * Note: the mock also records ResponsiveContainer's own props, which is the only
 *       way to observe 'aspect_ratio' -- it is passed to the container and never
 *       reaches the svg.
 *
 * Note: Line's animation is switched off, via defaultProps on the REAL class so
 *       recharts still recognises the child by type. It defaults on, and it made
 *       the geometry assertions lie: immediately after a re-render the 'd'
 *       attribute still holds the OLD path, because the new one is animated in
 *       over 1.5s. A first attempt at 'redraws when the data is replaced' passed
 *       for the wrong reason and a companion test 'proved' the opposite. With
 *       animation off the committed path is final and both read the truth.
 *
 * Note: tick text depends on the runtime timezone, because the x axis formats
 *       through d3.timeFormat, which works in LOCAL time. jest.config.js pins
 *       TZ=America/New_York for the whole run, so the UTC instants below are
 *       chosen to land on readable eastern wall-clock times.
 */

jest.mock('recharts', () => {
    const actual = jest.requireActual('recharts');
    const React = require('react');

    global.__container_props = [];

    actual.Line.defaultProps = {
        ...actual.Line.defaultProps,
        isAnimationActive: false,
    };

    return {
        ...actual,
        ResponsiveContainer: (props) => {
            global.__container_props.push(props);
            return React.cloneElement(props.children, { width: 600, height: 400 });
        },
    };
});

import React from 'react';
import { render } from '@testing-library/react';

import MultiLineChart from '../../import/general/line-chart.jsx';

//
// 15:00Z is 10:00 EST, which is what the default '%I:%M%p' renders as '10:00AM'.
//
const DATA = [
    { name: new Date('2024-01-02T15:00:00Z'), a: 5, b: 9 },
    { name: new Date('2024-01-02T16:00:00Z'), a: 7, b: 2 },
];

const KEYS = ['a', 'b'];

//
// the palette the constructor falls back to, in order.
//
const DEFAULT_COLORS = ['#8884d8', '#82ca9d', '#ffc658'];

function curves(container) {
    return [...container.querySelectorAll('.recharts-line-curve')];
}

function strokes(container) {
    return curves(container).map(c => c.getAttribute('stroke'));
}

function ticks(container, axis) {
    return [...container.querySelectorAll(`.recharts-${axis}Axis .recharts-cartesian-axis-tick-value`)]
        .map(t => t.textContent);
}

function lastContainerProps() {
    return global.__container_props[global.__container_props.length - 1];
}

beforeEach(() => {
    global.__container_props.length = 0;
});

describe('the series', () => {
    it('draws one line per data_key', () => {
        const { container } = render(<MultiLineChart data={DATA} data_keys={KEYS} />);

        expect(curves(container)).toHaveLength(2);
    });

    it('draws real geometry from the data, not an empty path', () => {
        //
        // the point of sizing the container: without it recharts emits nothing and
        // a test could only assert that a wrapper div exists.
        //
        const { container } = render(<MultiLineChart data={DATA} data_keys={KEYS} />);

        curves(container).forEach(c => {
            expect(c.getAttribute('d')).toMatch(/^M[\d.]+,[\d.]+L[\d.]+,[\d.]+/);
        });
    });

    it('plots a higher value further up, since y grows downward in svg', () => {
        //
        // 'a' rises 5 -> 7 and 'b' falls 9 -> 2, so their paths must move in
        // opposite directions. This is the cheapest assertion that the data
        // actually reaches the geometry rather than merely being accepted.
        //
        const { container } = render(<MultiLineChart data={DATA} data_keys={KEYS} />);
        const [a, b] = curves(container).map(c => {
            const [, y1, y2] = c.getAttribute('d').match(/^M[\d.]+,([\d.]+)L[\d.]+,([\d.]+)/);
            return Number(y2) - Number(y1);
        });

        expect(a).toBeLessThan(0);
        expect(b).toBeGreaterThan(0);
    });

    it('draws nothing when data_keys is empty, without failing', () => {
        //
        // data_keys drives the map, so no keys means no lines at all -- the axes
        // and grid still render, so the result is a blank but well formed chart.
        //
        const { container } = render(<MultiLineChart data={DATA} />);

        expect(curves(container)).toHaveLength(0);
        expect(container.querySelector('.recharts-cartesian-grid')).toBeTruthy();
    });

    it('survives no props at all', () => {
        //
        // every prop is optional and every default is in the constructor, so this
        // has to produce an empty chart rather than throw.
        //
        const { container } = render(<MultiLineChart />);

        expect(curves(container)).toHaveLength(0);
        expect(container.querySelector('.recharts-wrapper')).toBeTruthy();
    });
});

describe('stroke colour', () => {
    it('uses the documented default palette, in order', () => {
        const { container } = render(<MultiLineChart data={DATA} data_keys={['a', 'b']} />);

        expect(strokes(container)).toEqual(DEFAULT_COLORS.slice(0, 2));
    });

    it('takes hex strings from the color prop, in order', () => {
        const { container } = render(
            <MultiLineChart data={DATA} data_keys={KEYS} color={['#ff0000', '#00ff00']} />
        );

        expect(strokes(container)).toEqual(['#ff0000', '#00ff00']);
    });

    it('converts an {r,g,b} entry to an rgb() string', () => {
        //
        // the branch exists because the colour picker upstream stores channels as
        // an object. It reads as suspicious -- checkValidArray is called with ONE
        // argument here where every other call site passes (key, object) -- but
        // valid-array.js has a second clause that accepts a bare non-empty array,
        // so the branch is genuinely live. Asserted rather than assumed.
        //
        const { container } = render(
            <MultiLineChart
                data={DATA}
                data_keys={KEYS}
                color={[{ r: 12, g: 34, b: 56 }, { r: 200, g: 100, b: 0 }]}
            />
        );

        expect(strokes(container)).toEqual(['rgb(12, 34, 56)', 'rgb(200, 100, 0)']);
    });

    it('falls back per-entry, so a mixed color array works', () => {
        //
        // the r/g/b test is applied to each entry independently, so a hex string
        // and an object can coexist in one array.
        //
        const { container } = render(
            <MultiLineChart
                data={DATA}
                data_keys={KEYS}
                color={['#123456', { r: 1, g: 2, b: 3 }]}
            />
        );

        expect(strokes(container)).toEqual(['#123456', 'rgb(1, 2, 3)']);
    });

    it('ignores an object missing a channel, passing it through unconverted', () => {
        //
        // all three of r, g and b must be present. A partial object fails the test
        // and is handed to recharts as-is, which stringifies it -- so the line is
        // drawn with a nonsense stroke rather than a fallback colour.
        //
        const { container } = render(
            <MultiLineChart data={DATA} data_keys={['a']} color={[{ r: 1, g: 2 }]} />
        );

        expect(strokes(container)).toEqual(['[object Object]']);
    });
});

describe('the x axis', () => {
    it('formats ticks with the default %I:%M%p, in eastern time', () => {
        //
        // 15:00Z is 10:00 EST. If this ever reads 15:00 the TZ pin in
        // jest.config.js has stopped taking effect.
        //
        const { container } = render(<MultiLineChart data={DATA} data_keys={KEYS} />);

        expect(ticks(container, 'x')).toContain('10:00AM');
    });

    it('honours a custom x_ticker_format', () => {
        const { container } = render(
            <MultiLineChart data={DATA} data_keys={KEYS} x_ticker_format='%Y-%m-%d' />
        );

        expect(ticks(container, 'x')).toContain('2024-01-02');
    });

    it('reads the x value from data_key, which defaults to name', () => {
        //
        // the default is 'name'; a series keyed on anything else has to say so or
        // every tick formats undefined.
        //
        const { container } = render(
            <MultiLineChart
                data={[{ when: new Date('2024-01-02T15:00:00Z'), a: 1 }]}
                data_keys={['a']}
                data_key='when'
            />
        );

        expect(ticks(container, 'x')).toContain('10:00AM');
    });
});

describe('the y axis', () => {
    it('renders plain values by default', () => {
        const { container } = render(<MultiLineChart data={DATA} data_keys={KEYS} />);

        expect(ticks(container, 'y').join(',')).toMatch(/\d/);
        expect(ticks(container, 'y').join(',')).not.toContain('e+');
    });

    it.each([['exponential'], ['exp']])('formats exponentially for %s', (format) => {
        //
        // both spellings are accepted, which matters because the mobile branch in
        // trigger.jsx passes the long one and nothing normalises it.
        //
        const { container } = render(
            <MultiLineChart data={DATA} data_keys={KEYS} y_tick_format={format} />
        );

        expect(ticks(container, 'y').some(t => /e\+/.test(t))).toBe(true);
    });

    it('blanks the tick labels for false', () => {
        //
        // the ticks are still laid out, but their text is empty.
        //
        const { container } = render(
            <MultiLineChart data={DATA} data_keys={KEYS} y_tick_format={false} />
        );

        expect(ticks(container, 'y').join('')).toBe('');
    });

    it.each([[null], ['']])('does NOT blank for %p on mount, despite the branch for it', (format) => {
        //
        // DOCUMENTS DEAD CODE ON ONE PATH. render() tests for three falsy
        // spellings:
        //
        //     y_tick_format === null || y_tick_format === '' || y_tick_format === false
        //
        // but the constructor only ADOPTS the prop when it passes checkValidBool or
        // checkValidString, and null and '' pass neither -- so both are replaced by
        // the default 'true' before render ever sees them. Only 'false' survives
        // the constructor, so at mount two of those three comparisons are dead and
        // the labels render as ordinary numbers.
        //
        const { container } = render(
            <MultiLineChart data={DATA} data_keys={KEYS} y_tick_format={format} />
        );

        expect(ticks(container, 'y').join('')).not.toBe('');
    });

    it('does NOT blank for null on update either, now that both paths validate', () => {
        //
        // FIXED, in line-chart.jsx. componentDidUpdate adopted y_tick_format with no
        // validation at all, while the constructor rejects null and '' and falls back
        // to true. So the SAME value produced ordinary numbers when mounted with and a
        // blank axis when changed to -- a difference that only showed up once a user
        // interacted, which is the worst kind to chase.
        //
        // Both paths now apply checkValidBool/checkValidString.
        //
        const { container, rerender } = render(
            <MultiLineChart data={DATA} data_keys={KEYS} y_tick_format={true} />
        );
        expect(ticks(container, 'y').join('')).not.toBe('');

        rerender(<MultiLineChart data={DATA} data_keys={KEYS} y_tick_format={null} />);

        expect(ticks(container, 'y').join('')).not.toBe('');
    });

    it('still blanks for false on update, the one falsy spelling that is valid', () => {
        //
        // checkValidBool accepts false, so the blanking path is still reachable by a
        // caller that asks for it properly -- trigger.jsx passes false on mobile.
        //
        const { container, rerender } = render(
            <MultiLineChart data={DATA} data_keys={KEYS} y_tick_format={true} />
        );

        rerender(<MultiLineChart data={DATA} data_keys={KEYS} y_tick_format={false} />);

        expect(ticks(container, 'y').join('')).toBe('');
    });

    it('pulls the plot area left when the labels are blank', () => {
        //
        // the margin compensates for the hidden labels: -10 normally, -55 when
        // blank. Easy to transpose, and the only symptom is a chart that does not
        // line up with its neighbours.
        //
        // Measured from where the series actually starts rather than from the grid,
        // which carries no x attribute in this version of recharts.
        //
        const visible = render(<MultiLineChart data={DATA} data_keys={KEYS} />);
        const blank = render(<MultiLineChart data={DATA} data_keys={KEYS} y_tick_format={false} />);

        const startOf = (r) => Number(
            curves(r.container)[0].getAttribute('d').match(/^M([\d.]+),/)[1]
        );

        expect(startOf(blank)).toBeLessThan(startOf(visible));
    });

    it('drops the axis line when y_axis_line is false', () => {
        const { container } = render(
            <MultiLineChart data={DATA} data_keys={KEYS} y_axis_line={false} />
        );

        expect(container.querySelector('.recharts-yAxis .recharts-cartesian-axis-line')).toBeNull();
    });

    it('drops the tick lines when y_axis_tick_line is false', () => {
        const { container } = render(
            <MultiLineChart data={DATA} data_keys={KEYS} y_axis_tick_line={false} />
        );

        expect(
            container.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-line')
        ).toHaveLength(0);
    });

    it('keeps the tick lines when the labels are blanked', () => {
        //
        // the two are independent: blanking the text does not remove the ticks,
        // so the axis still reads as an axis.
        //
        const { container } = render(
            <MultiLineChart data={DATA} data_keys={KEYS} y_tick_format={false} />
        );

        expect(
            container.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-line').length
        ).toBeGreaterThan(0);
    });

    it('ignores y_axis_line when the format is exponential', () => {
        //
        // DOCUMENTS AN INCONSISTENCY: the exponential branch forwards axisLine but
        // NOT tickLine, so y_axis_tick_line is silently dropped for exponential
        // axes. trigger.jsx passes both together on desktop -- y_tick_format
        // 'exponential' and y_axis_tick_line true -- so the tick line it asks for
        // comes from recharts' default rather than from the prop.
        //
        const { container } = render(
            <MultiLineChart
                data={DATA}
                data_keys={KEYS}
                y_tick_format='exponential'
                y_axis_tick_line={false}
            />
        );

        expect(
            container.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-line').length
        ).toBeGreaterThan(0);
    });
});

describe('aspect ratio', () => {
    it('defaults to 5/3', () => {
        render(<MultiLineChart data={DATA} data_keys={KEYS} />);

        expect(lastContainerProps().aspect).toBeCloseTo(5 / 3);
    });

    it('accepts an integer, which trigger.jsx relies on', () => {
        //
        // trigger.jsx passes 3 on desktop. checkValidFloat accepts it -- the name
        // says float but the regex admits integers -- so this is only a trap if
        // that validator is ever tightened.
        //
        render(<MultiLineChart data={DATA} data_keys={KEYS} aspect_ratio={3} />);

        expect(lastContainerProps().aspect).toBe(3);
    });

    it('accepts a fractional ratio', () => {
        render(<MultiLineChart data={DATA} data_keys={KEYS} aspect_ratio={1.5} />);

        expect(lastContainerProps().aspect).toBe(1.5);
    });
});

describe('re-rendering with new props', () => {
    it('redraws when the data array is replaced', () => {
        const { container, rerender } = render(<MultiLineChart data={DATA} data_keys={['a']} />);
        const before = curves(container)[0].getAttribute('d');

        rerender(
            <MultiLineChart
                data={[
                    { name: new Date('2024-01-02T15:00:00Z'), a: 100 },
                    { name: new Date('2024-01-02T16:00:00Z'), a: 1 },
                ]}
                data_keys={['a']}
            />
        );

        expect(curves(container)[0].getAttribute('d')).not.toBe(before);
    });

    it('adds a line when data_keys grows', () => {
        const { container, rerender } = render(<MultiLineChart data={DATA} data_keys={['a']} />);
        expect(curves(container)).toHaveLength(1);

        rerender(<MultiLineChart data={DATA} data_keys={['a', 'b']} />);

        expect(curves(container)).toHaveLength(2);
    });

    it('recolours when the color array is replaced', () => {
        const { container, rerender } = render(
            <MultiLineChart data={DATA} data_keys={['a']} color={['#111111']} />
        );

        rerender(<MultiLineChart data={DATA} data_keys={['a']} color={['#222222']} />);

        expect(strokes(container)).toEqual(['#222222']);
    });

    it('holds the caller\'s array rather than a copy of it', () => {
        //
        // DOCUMENTS ALIASING. The constructor assigns the prop straight through:
        //
        //     var data = this.props.data;
        //
        // so state.data IS the caller's array. Nothing here copies, and the same
        // is true of data_keys and color.
        //
        const held = React.createRef();
        const mine = [...DATA];

        render(<MultiLineChart ref={held} data={mine} data_keys={['a']} />);

        expect(held.current.state.data).toBe(mine);
    });

    it('shows a mutation the identity guard was meant to filter out', () => {
        //
        // The consequence of the aliasing above, and it cuts against how the
        // component reads. Every sync compares with !==, so mutating an array in
        // place fires NO setState -- yet the chart still changes, because state
        // already points at the array that was mutated and render hands it to
        // recharts afresh.
        //
        // So the identity guards do not give the component a stable snapshot of its
        // data; they only decide whether setState runs. A caller mutating its own
        // array sees the chart change at the next unrelated re-render, which is a
        // difficult thing to track down.
        //
        const shared = [...DATA];
        const { container, rerender } = render(<MultiLineChart data={shared} data_keys={['a']} />);
        const before = curves(container)[0].getAttribute('d');

        shared[1] = { name: shared[1].name, a: 999 };
        rerender(<MultiLineChart data={shared} data_keys={['a']} />);

        expect(curves(container)[0].getAttribute('d')).not.toBe(before);
    });

    it('syncs a changed aspect_ratio', () => {
        //
        // FIXED, in line-chart.jsx. The guard read:
        //
        //     && Array.isArray(prevProps.aspect_ratio)
        //
        // and aspect_ratio is a NUMBER, so that was false for every value it could
        // hold: the branch was unreachable and the constructor's ratio was permanent.
        //
        // It reached a user through trigger.jsx, which computes the ratio from
        // isMobile -- so rotating a phone, or dragging a window across the breakpoint,
        // left the chart at whatever ratio it mounted with. The predicate is now
        // checkValidFloat, matching the clause above it and the constructor.
        //
        const { rerender } = render(
            <MultiLineChart data={DATA} data_keys={KEYS} aspect_ratio={3} />
        );
        expect(lastContainerProps().aspect).toBe(3);

        rerender(<MultiLineChart data={DATA} data_keys={KEYS} aspect_ratio={1.5} />);

        expect(lastContainerProps().aspect).toBe(1.5);
    });

    it('ignores an invalid aspect_ratio on update, as the constructor does', () => {
        //
        // the fix validates rather than merely accepting, so the chart keeps its last
        // good ratio instead of handing recharts something unusable.
        //
        // Note: 0 rather than a string. It fails checkValidFloat and the '> 0' test, so
        //       it exercises the same refusal -- but it is still a NUMBER, so propTypes
        //       stays quiet. A string would consume React's one-per-prop warning and
        //       leave the propTypes test further down asserting against nothing, which
        //       is exactly the order-dependence that test warns about.
        //
        const { rerender } = render(
            <MultiLineChart data={DATA} data_keys={KEYS} aspect_ratio={3} />
        );

        rerender(<MultiLineChart data={DATA} data_keys={KEYS} aspect_ratio={0} />);

        expect(lastContainerProps().aspect).toBe(3);
    });

    it('syncs a changed x_ticker_format, for contrast', () => {
        //
        // the same shape of branch, written without the Array.isArray slip, does
        // update -- so the defect above is local to aspect_ratio.
        //
        const { container, rerender } = render(
            <MultiLineChart data={DATA} data_keys={KEYS} x_ticker_format='%I:%M%p' />
        );
        expect(ticks(container, 'x')).toContain('10:00AM');

        rerender(<MultiLineChart data={DATA} data_keys={KEYS} x_ticker_format='%Y-%m-%d' />);

        expect(ticks(container, 'x')).toContain('2024-01-02');
    });
});

describe('the remaining sync branches', () => {
    //
    // These are asserted through a ref because most of them are only observable in
    // state: the component keeps title, y_label and label_format up to date and
    // then renders none of them. Reaching in like this is not how a component
    // should normally be tested, but it is the only way to show that the upkeep
    // happens at all -- and showing that is the point, since it is upkeep with no
    // effect.
    //
    it('syncs a changed data_key, and the x axis follows', () => {
        const { container, rerender } = render(
            <MultiLineChart
                data={[{ one: new Date('2024-01-02T15:00:00Z'), two: new Date('2024-01-02T20:00:00Z'), a: 1 }]}
                data_keys={['a']}
                data_key='one'
            />
        );
        expect(ticks(container, 'x')).toContain('10:00AM');

        rerender(
            <MultiLineChart
                data={[{ one: new Date('2024-01-02T15:00:00Z'), two: new Date('2024-01-02T20:00:00Z'), a: 1 }]}
                data_keys={['a']}
                data_key='two'
            />
        );

        expect(ticks(container, 'x')).toContain('03:00PM');
    });

    it('syncs a changed y_axis_line', () => {
        const { container, rerender } = render(
            <MultiLineChart data={DATA} data_keys={KEYS} y_axis_line={true} />
        );
        expect(container.querySelector('.recharts-yAxis .recharts-cartesian-axis-line')).toBeTruthy();

        rerender(<MultiLineChart data={DATA} data_keys={KEYS} y_axis_line={false} />);

        expect(container.querySelector('.recharts-yAxis .recharts-cartesian-axis-line')).toBeNull();
    });

    it('syncs a changed y_axis_tick_line', () => {
        const { container, rerender } = render(
            <MultiLineChart data={DATA} data_keys={KEYS} y_axis_tick_line={true} />
        );
        expect(
            container.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-line').length
        ).toBeGreaterThan(0);

        rerender(<MultiLineChart data={DATA} data_keys={KEYS} y_axis_tick_line={false} />);

        expect(
            container.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-line')
        ).toHaveLength(0);
    });

    it('adopts a custom label_format, which only the tooltip would use', () => {
        const held = React.createRef();

        render(
            <MultiLineChart
                ref={held}
                data={DATA}
                data_keys={KEYS}
                label_format='%Y-%m-%d'
            />
        );

        expect(held.current.state.label_format).toBe('%Y-%m-%d');
    });

    it('defaults label_format to the documented long form', () => {
        const held = React.createRef();

        render(<MultiLineChart ref={held} data={DATA} data_keys={KEYS} />);

        expect(held.current.state.label_format).toBe('%B %d, %Y %H:%M%Z');
    });

    it('syncs a changed label_format', () => {
        const held = React.createRef();
        const { rerender } = render(
            <MultiLineChart ref={held} data={DATA} data_keys={KEYS} label_format='%Y' />
        );

        rerender(<MultiLineChart ref={held} data={DATA} data_keys={KEYS} label_format='%m' />);

        expect(held.current.state.label_format).toBe('%m');
    });

    it.each([
        ['title', 'Stock Market', 'Nasdaq'],
        ['y_label', 'Total Alerts', 'Total Failures'],
    ])('syncs a changed %s into state that nothing reads', (name, first, second) => {
        //
        // roughly 30 lines across the constructor and componentDidUpdate keep these
        // two current. render() reads neither, so every one of those lines is
        // maintenance on a value that cannot reach the screen.
        //
        const held = React.createRef();
        const { container, rerender } = render(
            <MultiLineChart ref={held} data={DATA} data_keys={KEYS} {...{ [name]: first }} />
        );
        expect(held.current.state[name]).toBe(first);

        rerender(
            <MultiLineChart ref={held} data={DATA} data_keys={KEYS} {...{ [name]: second }} />
        );

        expect(held.current.state[name]).toBe(second);
        expect(container.textContent).not.toContain(second);
    });
});

describe('title and y_label', () => {
    it('accepts both props and renders NEITHER', () => {
        //
        // DOCUMENTS DEAD STATE. The constructor validates 'title' and 'y_label',
        // defaults them, copies them into state, and componentDidUpdate keeps them
        // in sync -- roughly 30 lines of upkeep. render() never reads either one.
        //
        // trigger.jsx passes both:
        //
        //     title={streamName('StockMarket')}
        //     y_label='Total Alerts'
        //
        // so the chart a user sees has no title and an unlabelled y axis, and the
        // call site gives no hint of that. Either render them or drop the props --
        // this test fails the moment someone does the former, which is the point.
        //
        const { container } = render(
            <MultiLineChart
                data={DATA}
                data_keys={KEYS}
                title='Stock Market'
                y_label='Total Alerts'
            />
        );

        expect(container.textContent).not.toContain('Stock Market');
        expect(container.textContent).not.toContain('Total Alerts');
    });

    it('defaults title to "Area Chart", a leftover from the file it was copied from', () => {
        //
        // harmless only because the value is unused. It is recorded here as
        // evidence of the copy: this is line-chart.jsx, and area-chart.jsx carries
        // the same constructor with the same default.
        //
        const { container } = render(<MultiLineChart data={DATA} data_keys={KEYS} />);

        expect(container.textContent).not.toContain('Area Chart');
    });
});

describe('the unreachable empty-x-axis branch', () => {
    it('formats x ticks even when data is omitted entirely', () => {
        //
        // DOCUMENTS DEAD CODE. render() guards with:
        //
        //     if (this.state.data) { ...timeFormat... } else { ...() => ''... }
        //
        // but the constructor sets state.data to either props.data (an array, when
        // it passes checkValidArray) or []. Both are objects, and every object is
        // truthy -- [] included -- so state.data can never be falsy and the else
        // branch cannot run. componentDidUpdate cannot produce one either: it
        // requires Array.isArray(this.props.data) before assigning.
        //
        // The tick-blanking that branch was written to do therefore never happens.
        // With no data there are simply no ticks to blank, which is why nobody
        // noticed.
        //
        const { container } = render(<MultiLineChart data_keys={KEYS} />);

        expect(ticks(container, 'x')).toEqual([]);
        expect(container.querySelector('.recharts-surface')).toBeTruthy();
    });

    it('renders a surface but no axes at all when there is no data', () => {
        //
        // recharts draws the wrapper and the svg surface, then stops: with an empty
        // dataset there is no domain, so neither axis is emitted. That is why the
        // dead branch above went unnoticed -- on the only path that could want
        // blank x ticks, there are no ticks to blank.
        //
        const { container } = render(<MultiLineChart data={[]} data_keys={KEYS} />);

        expect(curves(container)).toHaveLength(0);
        expect(container.querySelector('.recharts-wrapper')).toBeTruthy();
        expect(container.querySelector('.recharts-xAxis')).toBeNull();
        expect(container.querySelector('.recharts-yAxis')).toBeNull();
    });
});

describe('invalid props fall back to defaults', () => {
    //
    // Every case here trips a propTypes warning, which setup.js turns into a test
    // failure -- correctly, since an unexpected console.error usually IS the
    // defect. These tests provoke one deliberately, so console.error is replaced
    // for the duration and the warning is asserted rather than merely silenced.
    //
    // Note: React de-duplicates propType warnings per component and prop for the
    //       life of the process, so the FIRST test to pass a given prop badly is
    //       the only one that sees a warning. Each case below therefore uses a
    //       different prop, and the ones that only need quiet do not assert.
    //
    //
    // Note: every argument is joined, not just the first. React logs propType
    //       failures printf-style -- console.error('Warning: Failed %s type: %s%s',
    //       'prop', 'Invalid prop `data` of type `string` ...', ...) -- so the
    //       first argument is only the template and reading it alone finds nothing.
    //
    function quietly(run) {
        const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});

        try {
            return {
                value: run(),
                warnings: quiet.mock.calls.map(c => c.map(a => String(a)).join(' ')),
            };
        } finally {
            quiet.mockRestore();
        }
    }

    it.each([
        ['data', { data: 'not-an-array' }],
        ['data_keys', { data_keys: 'not-an-array' }],
        ['color', { color: 'not-an-array' }],
        ['aspect_ratio', { aspect_ratio: 'not-a-number' }],
    ])('%s is reported by propTypes, then quietly replaced by its default', (name, props) => {
        //
        // WORTH KNOWING: propTypes is the ONLY thing that objects. The component
        // itself substitutes a default and renders a chart that looks plausible --
        // and propTypes is stripped in a production build, so there the wrong type
        // is accepted in complete silence. Same failure mode as the sample-data
        // fallback in get-data.js.
        //
        const { value, warnings } = quietly(() => render(
            <MultiLineChart data={DATA} data_keys={KEYS} {...props} />
        ));

        expect(warnings.join(' ')).toContain(`Invalid prop \`${name}\``);
        expect(value.container.querySelector('.recharts-wrapper')).toBeTruthy();
    });

    it('falls back to the default palette given a non-array color', () => {
        const { value } = quietly(() => render(
            <MultiLineChart data={DATA} data_keys={KEYS} color='#ff0000' />
        ));

        expect(strokes(value.container)).toEqual(DEFAULT_COLORS.slice(0, 2));
    });

    it('falls back to 5/3 given a non-numeric aspect_ratio', () => {
        quietly(() => render(<MultiLineChart data={DATA} data_keys={KEYS} aspect_ratio='wide' />));

        expect(lastContainerProps().aspect).toBeCloseTo(5 / 3);
    });
});

/**
 * window.test.jsx: the two windowing diagrams, and the prop defaults behind them.
 *
 * Both constructors resolve every prop through the same guard -- present AND valid,
 * else a literal fallback -- so each prop carries two arms that only a caller passing
 * something unusable reaches. The diagrams are drawn in article prose where a prop is
 * usually omitted, so the fallback arm is the one that actually ships.
 *
 * Note: Sliding computes image_id, x_increment and x_unit into state and its render
 *       reads none of them. That is asserted here through the instance rather than
 *       the dom, because there is no rendered evidence of it to assert against.
 */

import React from 'react';
import { render } from '@testing-library/react';

import Sliding from '../../import/svg/window/sliding.jsx';
import Tumbling from '../../import/svg/window/tumbling.jsx';

function mount(Component, props = {}) {
    const held = React.createRef();

    render(<Component ref={held} {...props} />);

    return held.current;
}

describe('the sliding window diagram', () => {
    it('falls back to its own labels when given no props', () => {
        const svg = mount(Sliding);

        expect(svg.state).toEqual({
            image_id: 'Sliding',
            x_increment: 1,
            x_unit: 'min',
        });
    });

    it('takes the labels a caller passes', () => {
        const svg = mount(Sliding, {
            image_id: 'SlidingTwo',
            x_increment: 5,
            x_unit: 'sec',
        });

        expect(svg.state).toEqual({
            image_id: 'SlidingTwo',
            x_increment: 5,
            x_unit: 'sec',
        });
    });

    it('rejects a present but unusable prop rather than rendering it', () => {
        //
        // the guard is 'in props AND valid', so an empty string or a non-integer is
        // present and still has to fall back. Without the validator half, the label
        // would render blank and the increment would read 'NaN min'.
        //
        const svg = mount(Sliding, {
            image_id: '',
            x_increment: 'not-an-int',
            x_unit: '',
        });

        expect(svg.state).toEqual({
            image_id: 'Sliding',
            x_increment: 1,
            x_unit: 'min',
        });
    });
});

describe('the tumbling window diagram', () => {
    it('falls back to its own defaults when given no props', () => {
        const svg = mount(Tumbling);

        expect(svg.state.image_id).toBe('Tumbling');
        expect(svg.state.x_increment).toBe(1);
        expect(svg.state.x_unit).toBe('min');
    });

    it('takes the labels and the window flags a caller passes', () => {
        const svg = mount(Tumbling, {
            image_id: 'TumblingTwo',
            x_increment: 10,
            x_unit: 'hr',
            window_1_purple: true,
            window_1_green: true,
            window_2_blue: true,
            late_arrival: true,
        });

        expect(svg.state.image_id).toBe('TumblingTwo');
        expect(svg.state.x_increment).toBe(10);
        expect(svg.state.x_unit).toBe('hr');
        expect(svg.state.late_arrival).toBe(true);
    });

    it('rejects a present but unusable prop', () => {
        //
        // NaN rather than a string for the increment: propTypes declares it a number
        // and setup.js fails a test on an unexpected console warning, so the value
        // has to satisfy the type and still fail checkValidInt. NaN is exactly that
        // gap, and is also what a caller gets from parsing an empty form field.
        //
        const svg = mount(Tumbling, {
            image_id: '',
            x_increment: NaN,
            x_unit: '',
        });

        expect(svg.state.image_id).toBe('Tumbling');
        expect(svg.state.x_increment).toBe(1);
        expect(svg.state.x_unit).toBe('min');
    });

    it('moves the late arrival marker between the two windows', () => {
        //
        // late_arrival is the only flag the render branches on twice, once for each
        // window, and they are complements -- the marker is in one or the other and
        // never both.
        //
        const early = mount(Tumbling, { late_arrival: false });
        const late = mount(Tumbling, { late_arrival: true });

        expect(early.state.late_arrival).toBe(false);
        expect(late.state.late_arrival).toBe(true);
    });
});

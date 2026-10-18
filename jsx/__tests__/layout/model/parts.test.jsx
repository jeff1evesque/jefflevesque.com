/**
 * parts.test.jsx: what both model pages draw alike (#243): the score picker, a
 * model's status, a legend's marks, a panel's day and how it is chosen, and a
 * chart's table.
 */

import React from 'react';
import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
    Legend,
    Mark,
    NoBox,
    Numbers,
    Readout,
    ScorePicker,
    StatusPill,
    TipBox,
    axisStyle,
    isPhone,
    usePanelDay,
    usePhone,
} from '../../../import/layout/model/parts.jsx';
import { modelOf, phoneScreen, wideScreen } from '../../../test-support/model-fixtures.js';

describe('ScorePicker', () => {
    it('offers the four scores as buttons, the one shown pressed', () => {
        render(<ScorePicker score='auc_beats' onScore={() => {}} />);

        const buttons = within(screen.getByRole('group', { name: 'Score' })).getAllByRole('button');

        expect(buttons.map((button) => button.textContent)).toEqual(['Loss', 'Up/down AUC', 'Beat-the-average AUC', 'Up/down accuracy']);
        expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true', 'false']);
    });

    it('hands up the score a button picks', async () => {
        const onScore = jest.fn();

        render(<ScorePicker score='loss' onScore={onScore} />);
        await userEvent.click(screen.getByRole('button', { name: 'Up/down accuracy' }));

        expect(onScore).toHaveBeenCalledWith('acc_up');
    });

    it('offers them as a menu too, for a phone, which hands up the same', async () => {
        const onScore = jest.fn();

        render(<ScorePicker score='loss' onScore={onScore} />);

        const menu = screen.getByRole('combobox', { name: 'Score' });

        expect(menu).toHaveValue('loss');
        await userEvent.selectOptions(menu, 'auc_up');
        expect(onScore).toHaveBeenCalledWith('auc_up');
    });
});

describe('StatusPill', () => {
    it.each([
        [modelOf(), 'Live', 'model-pill-live'],
        [modelOf({ scored_days: 4 }), 'New · 4 days', 'model-pill-new'],
        [modelOf({ retired: '2026-10-01' }), 'Retired', 'model-pill-retired'],
    ])('says a model\'s status', (model, said, kind) => {
        render(<StatusPill model={model} />);

        expect(screen.getByText(said)).toHaveClass('model-pill', kind);
    });
});

describe('Mark', () => {
    it.each([
        ['line', 'line'],
        ['dashed', 'line'],
        ['dot', 'circle'],
        ['ring', 'circle'],
        ['diamond', 'polygon'],
        ['hollow', 'polygon'],
        ['faint', 'circle'],
        ['bar', 'rect'],
        ['fade', 'rect'],
        ['stack', 'rect'],
        ['tick', 'line'],
    ])('draws a %s as a %s, hidden from a screen reader', (kind, shape) => {
        const { container } = render(<Mark kind={kind} color='#123456' />);

        expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
        expect(container.querySelector(shape)).toBeInTheDocument();
    });

    it('fills a dot and only rings a ring', () => {
        const dot = render(<Mark kind='dot' color='#123456' />).container.querySelector('circle');
        const ring = render(<Mark kind='ring' color='#123456' />).container.querySelector('circle');

        expect(dot).toHaveAttribute('fill', '#123456');
        expect(ring).toHaveAttribute('fill', 'none');
        expect(ring).toHaveAttribute('stroke', '#123456');
    });

    it('fills a diamond and only outlines a hollow one, as the attempts chart draws them (#251)', () => {
        const diamond = render(<Mark kind='diamond' color='#123456' />).container.querySelector('polygon');
        const hollow = render(<Mark kind='hollow' color='#123456' />).container.querySelector('polygon');

        expect(diamond).toHaveAttribute('fill', '#123456');
        expect(diamond).toHaveAttribute('points', '8,-0.5 14.5,6 8,12.5 1.5,6');
        expect(hollow).toHaveAttribute('fill', 'none');
        expect(hollow).toHaveAttribute('stroke', '#123456');
        expect(hollow).toHaveAttribute('points', '8,0.5 13.5,6 8,11.5 2.5,6');
    });

    it('dashes the baseline\'s line as the charts dash it', () => {
        const dashed = render(<Mark kind='dashed' color='#123456' />).container.querySelector('line');

        expect(dashed).toHaveAttribute('stroke-dasharray', '5 4');
        expect(dashed).toHaveAttribute('stroke-width', '2');
    });

    it('draws scoring as a lighter bar, and a whole attempt as training under its lighter scoring', () => {
        const fade = render(<Mark kind='fade' color='#123456' />).container.querySelector('rect');
        const [scoring, training] = render(<Mark kind='stack' color='#123456' />).container.querySelectorAll('rect');

        expect(fade).toHaveAttribute('fill-opacity', '0.4');
        expect(scoring).toHaveAttribute('fill-opacity', '0.4');
        expect(training).not.toHaveAttribute('fill-opacity');
        expect(Number(training.getAttribute('y'))).toBeGreaterThan(Number(scoring.getAttribute('y')));
    });
});

describe('Legend', () => {
    it('lists each mark beside its words, the words in the page\'s own text', () => {
        render(
            <Legend
                items={[
                    { key: 'a', kind: 'line', color: '#ff0000', label: 'Live version' },
                    { key: 'b', kind: 'dot', color: '#00ff00', label: 'Went live' },
                ]}
            />
        );

        const items = within(screen.getByRole('list', { name: 'Legend' })).getAllByRole('listitem');

        expect(items.map((item) => item.textContent)).toEqual(['Live version', 'Went live']);
        expect(items[0].querySelector('span')).not.toHaveAttribute('style');
    });

    it('can be named for a screen reader', () => {
        render(<Legend label='Legend, bars' items={[]} />);

        expect(screen.getByRole('list', { name: 'Legend, bars' })).toBeInTheDocument();
    });
});

describe('TipBox', () => {
    it('names the day, a line per value with its mark, and a note under them', () => {
        const { container } = render(
            <TipBox
                title='Wed, Oct 14, 2026'
                rows={[{ key: 'a', mark: <Mark kind='line' color='#000' />, name: 'Live version', value: '1.600' }]}
                foot='Went live'
            />
        );

        expect(container.querySelector('.model-tip-title')).toHaveTextContent('Wed, Oct 14, 2026');
        expect(container.querySelector('.model-tip-row')).toHaveTextContent('Live version1.600');
        expect(container.querySelector('.model-tip-row svg')).toBeInTheDocument();
        expect(container.querySelector('.model-tip-foot')).toHaveTextContent('Went live');
    });

    it('has no note where there is none', () => {
        const { container } = render(<TipBox title='x' rows={[]} />);

        expect(container.querySelector('.model-tip-foot')).toBeNull();
    });
});

describe('Readout (#251)', () => {
    const tip = { title: 'Wed, Oct 14, 2026', rows: [{ key: 'a', name: 'Live version', value: '1.600' }], foot: 'Went live' };

    it('draws nothing without a day', () => {
        const { container } = render(<Readout tip={null} />);

        expect(container).toBeEmptyDOMElement();
    });

    it('holds a day\'s numbers in a panel of rows, for a phone', () => {
        const { container } = render(<Readout tip={tip} />);
        const panel = container.querySelector('.model-readout');

        expect(panel).not.toHaveClass('model-readout-line');
        expect(within(panel).getByText('Live version')).toBeInTheDocument();
        expect(panel.querySelector('.model-tip-foot')).toHaveTextContent('Went live');
    });

    it('lays them on one slim line for a wide screen', () => {
        const { container } = render(<Readout tip={tip} line />);

        expect(container.querySelector('.model-readout')).toHaveClass('model-readout-line');
    });
});

describe('NoBox', () => {
    it('draws nothing, so a chart\'s tooltip leaves only its band', () => {
        const { container } = render(<NoBox active label='2026-10-14' />);

        expect(container).toBeEmptyDOMElement();
    });
});

describe('the phone layout (#251)', () => {
    afterEach(wideScreen);

    it('is a wide screen where there is no matchMedia, as under jsdom', () => {
        expect(isPhone()).toBe(false);
        expect(renderHook(() => usePhone()).result.current).toBe(false);
    });

    it('is a phone below the page\'s width', () => {
        phoneScreen();

        expect(isPhone()).toBe(true);
        expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767.98px)');
        expect(renderHook(() => usePhone()).result.current).toBe(true);
    });

    it('follows the window as it is turned across the width, and stops listening once it is gone', () => {
        const screenWidth = phoneScreen(false);
        const { result, unmount } = renderHook(() => usePhone());

        expect(result.current).toBe(false);
        act(() => screenWidth.turn(true));
        expect(result.current).toBe(true);
        act(() => screenWidth.turn(false));
        expect(result.current).toBe(false);

        unmount();

        expect(screenWidth.listeners).toHaveLength(0);
    });
});

describe('usePanelDay (#251)', () => {
    afterEach(wideScreen);

    it('shows the latest day on a wide screen until the reader points at another, and keeps it', () => {
        const { result } = renderHook(() => usePanelDay('2026-10-16'));

        expect(result.current.phone).toBe(false);
        expect(result.current.dayFor()).toBe('2026-10-16');
        expect(result.current.events()).not.toHaveProperty('onClick');

        act(() => result.current.events().onMouseMove({ activeLabel: '2026-10-14' }));
        expect(result.current.dayFor()).toBe('2026-10-14');

        act(() => result.current.events().onMouseMove({}));
        act(() => result.current.events().onMouseMove(null));
        expect(result.current.dayFor()).toBe('2026-10-14');
    });

    it('follows one day on every chart that shares the hook, pointed at on any of them', () => {
        const { result } = renderHook(() => usePanelDay('2026-10-16'));

        act(() => result.current.events('gap').onMouseMove({ activeLabel: '2026-10-13' }));

        expect(['attempts', 'gap', 'took'].map((chart) => result.current.dayFor(chart))).toEqual(['2026-10-13', '2026-10-13', '2026-10-13']);
    });

    it('shows no day on a phone until one is tapped, and closes it on a second tap', () => {
        phoneScreen();

        const { result } = renderHook(() => usePanelDay('2026-10-16'));

        expect(result.current.phone).toBe(true);
        expect(result.current.dayFor()).toBeNull();
        expect(result.current.events()).not.toHaveProperty('onMouseMove');

        act(() => result.current.events().onClick({ activeLabel: '2026-10-14' }));
        expect(result.current.dayFor()).toBe('2026-10-14');

        act(() => result.current.events().onClick({ activeLabel: '2026-10-15' }));
        expect(result.current.dayFor()).toBe('2026-10-15');

        act(() => result.current.events().onClick({ activeLabel: '2026-10-15' }));
        expect(result.current.dayFor()).toBeNull();

        act(() => result.current.events().onClick({}));
        expect(result.current.dayFor()).toBeNull();
    });

    it('opens on a phone only the panel of the chart tapped, and moves it to the next chart tapped', () => {
        phoneScreen();

        const { result } = renderHook(() => usePanelDay('2026-10-16'));

        act(() => result.current.events('took').onClick({ activeLabel: '2026-10-15' }));

        expect(result.current.dayFor('took')).toBe('2026-10-15');
        expect(result.current.dayFor('attempts')).toBeNull();

        act(() => result.current.events('attempts').onClick({ activeLabel: '2026-10-15' }));

        expect(result.current.dayFor('attempts')).toBe('2026-10-15');
        expect(result.current.dayFor('took')).toBeNull();
    });
});

describe('Numbers', () => {
    const columns = [{ key: 'day', label: 'Day', text: true }, { key: 'value', label: 'Value' }];
    const rows = [{ key: '2', day: 'Oct 2', value: '1.6' }, { key: '1', day: 'Oct 1', value: '1.7' }];

    it('is folded under a button until it is asked for', async () => {
        render(<Numbers label='Loss' columns={columns} rows={rows} />);

        const toggle = screen.getByRole('button', { name: 'Show the numbers' });

        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('table')).toBeNull();

        await userEvent.click(toggle);

        expect(screen.getByRole('button', { name: 'Hide the numbers' })).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('table', { name: 'Loss' })).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Hide the numbers' }));

        expect(screen.queryByRole('table')).toBeNull();
    });

    it('holds every row, a column of words read from the left', async () => {
        render(<Numbers label='Loss' columns={columns} rows={rows} />);
        await userEvent.click(screen.getByRole('button', { name: 'Show the numbers' }));

        const headers = screen.getAllByRole('columnheader');
        const cells = screen.getAllByRole('cell');

        expect(headers.map((cell) => cell.textContent)).toEqual(['Day', 'Value']);
        expect(headers[0]).toHaveClass('model-numbers-text');
        expect(headers[1]).not.toHaveClass('model-numbers-text');
        expect(cells.map((cell) => cell.textContent)).toEqual(['Oct 2', '1.6', 'Oct 1', '1.7']);
        expect(cells[0]).toHaveClass('model-numbers-text');
    });
});

describe('axisStyle', () => {
    it('draws an axis in the page\'s grid and muted gray, with no ticks standing off it', () => {
        expect(axisStyle({ grid: '#eee', muted: '#888' })).toEqual({
            stroke: '#eee',
            tick: { fill: '#888', fontSize: 12 },
            tickLine: false,
        });
    });
});

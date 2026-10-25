/**
 * parts.test.jsx: what both model pages draw alike (#243): the score picker, a
 * model's status and its bell (#255), a legend's marks and the note on which way
 * its axis runs (#300), how a part of loss stands, a panel's day and how it is
 * chosen, a chart's popup and which chart shows it (#300), a chart's values'
 * axis (#300), a chart's table, and a chart's title that folds it, with the
 * folds it keeps.
 */

import React from 'react';
import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import {
    AlarmBell,
    FAINT_OPACITY,
    FoldTitle,
    HoldPicker,
    Legend,
    Mark,
    NoBox,
    Numbers,
    Readout,
    ScorePicker,
    StatusPill,
    TipBox,
    axisNote,
    axisStyle,
    gapWords,
    isPhone,
    partGap,
    popupOf,
    tickGap,
    modelsHeld,
    useFolds,
    usePanelDay,
    usePhone,
    usePopup,
    valueAxis,
} from '../../../import/layout/model/parts.jsx';
import { readLayout, writeLayout } from '../../../import/general/layout-preference.js';
import { downModelOf, modelOf, phoneScreen, wideScreen } from '../../../test-support/model-fixtures.js';

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

    it('offers a task\'s own scores, in its order, as buttons and as a menu (#279)', async () => {
        const onScore = jest.fn();

        render(<ScorePicker score='top10_gain' onScore={onScore} offered={['loss', 'profit_auc', 'top10_gain', 'top10_wins']} />);

        const buttons = within(screen.getByRole('group', { name: 'Score' })).getAllByRole('button');
        const menu = screen.getByRole('combobox', { name: 'Score' });

        expect(buttons.map((button) => button.textContent)).toEqual(['Loss', 'Profit AUC', 'Top 10 gain', 'Top 10 wins']);
        expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true', 'false']);
        expect(within(menu).getAllByRole('option').map((option) => option.textContent)).toEqual(['Loss', 'Profit AUC', 'Top 10 gain', 'Top 10 wins']);

        await userEvent.click(screen.getByRole('button', { name: 'Top 10 wins' }));

        expect(onScore).toHaveBeenCalledWith('top10_wins');
    });
});

describe('ScorePicker\'s scores a hold has none of (#300)', () => {
    it('offers them disabled, as buttons and in the phone\'s menu, and hands none of them up', async () => {
        const onScore = jest.fn();

        render(<ScorePicker score='loss' onScore={onScore} offered={['loss', 'top10_gain', 'top10_wins']} disabled={['top10_gain', 'top10_wins']} />);

        const buttons = within(screen.getByRole('group', { name: 'Score' })).getAllByRole('button');
        const options = within(screen.getByRole('combobox', { name: 'Score' })).getAllByRole('option');

        expect(buttons.map((button) => button.disabled)).toEqual([false, true, true]);
        expect(options.map((option) => option.disabled)).toEqual([false, true, true]);

        await userEvent.click(screen.getByRole('button', { name: 'Top 10 gain' }));

        expect(onScore).not.toHaveBeenCalled();
    });

    it('disables none where it is handed none', () => {
        render(<ScorePicker score='loss' onScore={() => {}} />);

        expect(within(screen.getByRole('group', { name: 'Score' })).getAllByRole('button').some((button) => button.disabled)).toBe(false);
    });
});

describe('HoldPicker (#279)', () => {
    it('offers the three holds as buttons, the one shown pressed', () => {
        render(<HoldPicker hold={5} onHold={() => {}} />);

        const buttons = within(screen.getByRole('group', { name: 'Hold' })).getAllByRole('button');

        expect(buttons.map((button) => button.textContent)).toEqual(['1 day', '5 days', '20 days']);
        expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
        expect(document.querySelector('.model-holds')).toHaveClass('model-scores');
    });

    it('grays out the holds it is handed as having no result yet, in its buttons and a phone\'s menu (#300)', () => {
        render(<HoldPicker hold={1} onHold={() => {}} disabled={[5, 20]} />);

        const buttons = within(screen.getByRole('group', { name: 'Hold' })).getAllByRole('button');
        const options = [...document.querySelectorAll('.model-score-menu option')];

        expect(buttons.map((button) => button.disabled)).toEqual([false, true, true]);
        expect(options.map((option) => option.disabled)).toEqual([false, true, true]);
    });

    it('grays out nothing where it is handed no hold without a result', () => {
        render(<HoldPicker hold={1} onHold={() => {}} />);

        expect(within(screen.getByRole('group', { name: 'Hold' })).getAllByRole('button').some((button) => button.disabled)).toBe(false);
    });

    it('hands up the hold picked, as its days, from a button or a phone\'s menu', async () => {
        const onHold = jest.fn();

        render(<HoldPicker hold={1} onHold={onHold} />);

        await userEvent.click(screen.getByRole('button', { name: '20 days' }));
        expect(onHold).toHaveBeenLastCalledWith(20);

        expect(screen.getByRole('combobox', { name: 'Hold' })).toHaveValue('1');
        await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Hold' }), '5');
        expect(onHold).toHaveBeenLastCalledWith(5);
    });

    it('offers only the holds it is handed', () => {
        render(<HoldPicker hold={1} onHold={() => {}} holds={[{ days: 1, label: '1 day' }, { days: 5, label: '5 days' }]} />);

        expect(within(screen.getByRole('group', { name: 'Hold' })).getAllByRole('button').map((button) => button.textContent))
            .toEqual(['1 day', '5 days']);
    });

    describe('Combined, a stock model\'s holds averaged (#300)', () => {
        const ALL = [
            { days: 1, label: '1 day' },
            { days: 5, label: '5 days' },
            { days: 20, label: '20 days' },
            { days: 'combined', label: 'Combined' },
        ];

        it('is a button after the three, pressed while it is the hold shown', () => {
            render(<HoldPicker hold='combined' onHold={() => {}} holds={ALL} />);

            const buttons = within(screen.getByRole('group', { name: 'Hold' })).getAllByRole('button');

            expect(buttons.map((button) => button.textContent)).toEqual(['1 day', '5 days', '20 days', 'Combined']);
            expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false', 'true']);
        });

        it('is handed up by its name, from its button or the phone\'s menu, as the holds are by their days', async () => {
            const onHold = jest.fn();

            render(<HoldPicker hold={1} onHold={onHold} holds={ALL} />);

            await userEvent.click(screen.getByRole('button', { name: 'Combined' }));
            expect(onHold).toHaveBeenLastCalledWith('combined');

            expect(within(screen.getByRole('combobox', { name: 'Hold' })).getAllByRole('option').map((option) => option.textContent))
                .toEqual(['1 day', '5 days', '20 days', 'Combined']);
            await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Hold' }), 'combined');
            expect(onHold).toHaveBeenLastCalledWith('combined');
            await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Hold' }), '20');
            expect(onHold).toHaveBeenLastCalledWith(20);
        });
    });
});

describe('gapWords (#274, #300)', () => {
    const words = (...args) => render(<span className='holder'>{gapWords(...args)}</span>).container.querySelector('.holder');

    it('puts the arrow before how far a score is from the baseline\'s, and which way', () => {
        expect(words(0.034, 'loss')).toHaveTextContent(/^▲ 0\.034 better than baseline$/);
        expect(words(-0.013, 'loss').querySelector('.model-gap-arrow')).toHaveTextContent('▼');
        expect(words(-0.013, 'loss')).toHaveTextContent(/^▼ 0\.013 worse than baseline$/);
    });

    it('leaves off what follows the word where gaps stand side by side, and says level as it is handed', () => {
        expect(words(0.012, 'loss', '', 'level')).toHaveTextContent(/^▲ 0\.012 better$/);
        expect(words(0.0001, 'loss', '', 'level')).toHaveTextContent(/^level$/);
        expect(words(0.0001, 'loss')).toHaveTextContent(/^level with baseline$/);
        expect(words(0.0001, 'loss').querySelector('.model-gap-arrow')).toBeNull();
    });

    it('says nothing where there is no gap', () => {
        expect(words(null, 'loss')).toBeEmptyDOMElement();
    });
});

describe('partGap (#300)', () => {
    const gap = (part) => render(<span className='holder'>{partGap(part)}</span>).container.querySelector('.holder');

    it('says how far a part of loss stands from the baseline\'s, in the fewest words, after the arrow', () => {
        expect(gap({ value: 0.723, baseline: 0.713 })).toHaveTextContent(/^▼ 0\.010 worse$/);
        expect(gap({ value: 0.41, baseline: 0.414 })).toHaveTextContent(/^▲ 0\.004 better$/);
        expect(gap({ value: 0.41, baseline: 0.414 }).querySelector('.model-gap-arrow')).toHaveTextContent('▲');
    });

    it('compares the two as they are printed: a hair apart is level, and two printed apart are not', () => {
        expect(gap({ value: 0.7231, baseline: 0.7229 })).toHaveTextContent(/^level$/);
        expect(gap({ value: 0.26018, baseline: 0.26065 })).toHaveTextContent(/^▲ 0\.001 better$/);
    });
});

describe('axisNote (#300)', () => {
    it('says a score where lower is better has its axis flipped, so better is up', () => {
        expect(axisNote('loss')).toBe('Lower is better, so the axis is flipped: better is up.');
    });

    it('says a score where higher is better is the right way up', () => {
        expect(axisNote('auc_up')).toBe('Higher is better.');
        expect(axisNote('top10_gain')).toBe('Higher is better.');
    });
});

describe('tickGap (#300)', () => {
    it('stands a phone\'s days further apart, so a narrow chart names fewer', () => {
        expect(tickGap(false)).toBe(24);
        expect(tickGap(true)).toBe(40);
    });
});

describe('valueAxis (#300)', () => {
    const colors = { grid: '#eee', muted: '#888', page: '#fff' };

    it('keeps a wide screen\'s values in a 56px gutter at the chart\'s left, in the axes\' own style', () => {
        expect(valueAxis(false, colors)).toEqual({ width: 56, stroke: '#eee', tick: { fill: '#888', fontSize: 12 }, tickLine: false });
    });

    it('draws a phone\'s values inside the plot, each on a halo of the page\'s color, so the chart has its card\'s whole width', () => {
        expect(valueAxis(true, colors)).toEqual({
            stroke: '#eee',
            tickLine: false,
            width: 56,
            mirror: true,
            tickMargin: 2,
            tick: { fill: '#888', fontSize: 11, stroke: '#fff', strokeWidth: 3, paintOrder: 'stroke' },
        });
    });
});

describe('StatusPill', () => {
    it.each([
        [modelOf(), 'Live', 'model-pill-live'],
        [modelOf({ scored_days: 4 }), 'New · day 4 of 20', 'model-pill-new'],
        [modelOf({ scored_days: 0 }), 'New', 'model-pill-new'],
        [modelOf({ scored_days: 25, average_days: 30 }), 'New · day 25 of 30', 'model-pill-new'],
        [modelOf({ scored_days: 25, average_days: 20 }), 'Live', 'model-pill-live'],
        [modelOf({ retired: '2026-10-01' }), 'Retired', 'model-pill-retired'],
        [downModelOf(), 'Behind baseline', 'model-pill-down'],
        [downModelOf({ retired: '2026-10-20' }), 'Retired', 'model-pill-retired'],
    ])('says a model\'s status', (model, said, kind) => {
        render(<StatusPill model={model} />);

        expect(screen.getByText(said)).toHaveClass('model-pill', kind);
    });
});

describe('modelsHeld (#255)', () => {
    const SINCE = { since: '2026-10-18T12:00:00Z', terms: '2026-10' };

    it('names each model whose alarm the reader holds', () => {
        expect(modelsHeld([
            { model: 'pt-gnn', alarm: 'live', ...SINCE },
            { model: 'tables-gnn', alarm: 'live', ...SINCE },
        ])).toEqual(['pt-gnn', 'tables-gnn']);
    });

    it('passes over a stream\'s subscription, even one sharing a model\'s name', () => {
        expect(modelsHeld([
            { stream: 'pt-gnn', alarm: 'ingest', ...SINCE },
            { model: 'tables-gnn', alarm: 'live', ...SINCE },
        ])).toEqual(['tables-gnn']);
    });

    it('names none signed out, or for an answer that is no list', () => {
        expect(modelsHeld(null)).toEqual([]);
        expect(modelsHeld(undefined)).toEqual([]);
        expect(modelsHeld([null])).toEqual([]);
    });
});

describe('AlarmBell (#255)', () => {
    function bell(props) {
        return render(
            <MemoryRouter>
                <AlarmBell model={modelOf()} {...props} />
            </MemoryRouter>
        );
    }

    it('leads to the model\'s alarm page, as a plain bell for a reader who holds nothing', () => {
        const { container } = bell();
        const link = screen.getByRole('link', { name: 'Alarm for pt-gnn' });

        expect(link).toHaveAttribute('href', '/model/pt-gnn/alarm');
        expect(link).toHaveClass('control-button');
        expect(container.querySelector('svg')).toHaveAttribute('data-testid', 'NotificationsIcon');
        expect(container.querySelector('svg')).not.toHaveClass('subscribed');
    });

    it('rings in green for a reader who holds the alarm, saying so under the pointer', async () => {
        const { container } = bell({ held: true });
        const icon = container.querySelector('svg');

        expect(screen.getByRole('link', { name: 'Alarm for pt-gnn: subscribed' })).toHaveAttribute('href', '/model/pt-gnn/alarm');
        expect(icon).toHaveAttribute('data-testid', 'NotificationsActiveIcon');
        expect(icon).toHaveClass('control-icon', 'notification', 'subscribed');

        await userEvent.hover(icon);

        expect(await screen.findByRole('tooltip')).toHaveTextContent('Subscribed');
    });

    it('is drawn with the stream bell\'s classes, so it takes their grays and greens', () => {
        const { container } = bell();

        expect(container.querySelector('.control-tray .border-circle-radius.control-button .control-icon.notification'))
            .not.toBeNull();
    });

    it('is not drawn for a retired model, which can\'t go live again', () => {
        const { container } = bell({ model: modelOf({ retired: '2026-10-02' }), held: true });

        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByRole('link')).toBeNull();
    });

    it('is drawn for a new model, which can still go live', () => {
        bell({ model: modelOf({ scored_days: 4 }) });

        expect(screen.getByRole('link', { name: 'Alarm for pt-gnn' })).toBeInTheDocument();
    });

    it('escapes a name the address would read otherwise', () => {
        bell({ model: modelOf({ name: 'a b/c' }) });

        expect(screen.getByRole('link', { name: 'Alarm for a b/c' })).toHaveAttribute('href', '/model/a%20b%2Fc/alarm');
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

    it('draws scoring as a lighter bar, half its color, and a whole attempt as training under its lighter scoring (#300)', () => {
        const fade = render(<Mark kind='fade' color='#123456' />).container.querySelector('rect');
        const [scoring, training] = render(<Mark kind='stack' color='#123456' />).container.querySelectorAll('rect');

        expect(fade).toHaveAttribute('fill-opacity', '0.5');
        expect(scoring).toHaveAttribute('fill-opacity', '0.5');
        expect(training).not.toHaveAttribute('fill-opacity');
        expect(Number(training.getAttribute('y'))).toBeGreaterThan(Number(scoring.getAttribute('y')));
    });

    it('draws a single day as a faint dot, as light as a track record draws its days (#300)', () => {
        const faint = render(<Mark kind='faint' color='#123456' />).container.querySelector('circle');

        expect(FAINT_OPACITY).toBe(0.45);
        expect(faint).toHaveAttribute('fill', '#123456');
        expect(faint).toHaveAttribute('fill-opacity', '0.45');
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

    it('says last, with no mark, which way the axis runs, where it is handed a note (#300)', () => {
        render(<Legend items={[{ key: 'a', kind: 'line', color: '#ff0000', label: 'Live version' }]} note={axisNote('loss')} />);

        const items = within(screen.getByRole('list', { name: 'Legend' })).getAllByRole('listitem');

        expect(items).toHaveLength(2);
        expect(items[1]).toHaveClass('model-legend-note');
        expect(items[1]).toHaveTextContent('Lower is better, so the axis is flipped: better is up.');
        expect(items[1].querySelector('svg')).toBeNull();
    });

    it('has no note where it is handed none', () => {
        const { container } = render(<Legend items={[{ key: 'a', kind: 'line', color: '#ff0000', label: 'Live version' }]} />);

        expect(container.querySelector('.model-legend-note')).toBeNull();
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

    it('takes a class beside its own, as a chart\'s popup does (#300), and none where it is handed none', () => {
        const { container, rerender } = render(<TipBox title='x' rows={[]} className='model-chart-tip' />);

        expect(container.firstChild).toHaveClass('model-tip', 'model-chart-tip');

        rerender(<TipBox title='x' rows={[]} />);

        expect(container.firstChild).toHaveAttribute('class', 'model-tip');
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

describe('usePopup (#300)', () => {
    afterEach(wideScreen);

    it('shows a wide screen\'s popup on the chart under the pointer alone, for the day recharts hands it', () => {
        const { result } = renderHook(() => usePopup());

        expect(result.current.phone).toBe(false);
        expect(result.current.tooltip('attempts')).toEqual({});
        expect(result.current.events('attempts')).not.toHaveProperty('onClick');
        expect(result.current.dayFor('attempts', '2026-10-14')).toBeNull();

        act(() => result.current.events('attempts').onMouseMove());

        expect(result.current.dayFor('attempts', '2026-10-14')).toBe('2026-10-14');
        expect(result.current.dayFor('attempts', undefined)).toBeNull();
        expect(result.current.dayFor('gap', '2026-10-14')).toBeNull();

        act(() => result.current.events('attempts').onMouseMove());
        act(() => result.current.events('gap').onMouseMove());

        expect(result.current.dayFor('gap', '2026-10-13')).toBe('2026-10-13');
        expect(result.current.dayFor('attempts', '2026-10-13')).toBeNull();
    });

    it('takes a wide screen\'s popup away once the pointer leaves, and has nothing for a tap off a chart to close', () => {
        const { result } = renderHook(() => usePopup());

        act(() => result.current.events('track').onMouseMove());
        act(() => result.current.away('track')());

        expect(result.current.dayFor('track', '2026-10-14')).toBe('2026-10-14');

        act(() => result.current.events('track').onMouseLeave());

        expect(result.current.dayFor('track', '2026-10-14')).toBeNull();
    });

    it('opens a phone\'s popup on the chart and the day tapped, and closes it on a second tap on the day', () => {
        phoneScreen();

        const { result } = renderHook(() => usePopup());

        expect(result.current.phone).toBe(true);
        expect(result.current.events('track')).not.toHaveProperty('onMouseMove');
        expect(result.current.tooltip('track')).toEqual({ trigger: 'click', active: false });
        expect(result.current.dayFor('track', '2026-10-16')).toBeNull();

        act(() => result.current.events('track').onClick({ activeLabel: '2026-10-14' }));

        expect(result.current.tooltip('track')).toEqual({ trigger: 'click', active: true });
        expect(result.current.dayFor('track', '2026-10-16')).toBe('2026-10-14');

        act(() => result.current.events('track').onClick({ activeLabel: '2026-10-15' }));
        expect(result.current.dayFor('track')).toBe('2026-10-15');

        act(() => result.current.events('track').onClick({ activeLabel: '2026-10-15' }));
        expect(result.current.dayFor('track')).toBeNull();

        act(() => result.current.events('track').onClick({}));
        act(() => result.current.events('track').onClick(null));
        expect(result.current.dayFor('track')).toBeNull();
    });

    it('moves a phone\'s popup to the chart tapped next, and closes it at a tap off its own chart alone', () => {
        phoneScreen();

        const { result } = renderHook(() => usePopup());

        act(() => result.current.events('took').onClick({ activeLabel: '2026-10-15' }));
        act(() => result.current.events('attempts').onClick({ activeLabel: '2026-10-15' }));

        expect(result.current.dayFor('attempts')).toBe('2026-10-15');
        expect(result.current.dayFor('took')).toBeNull();
        expect(result.current.tooltip('took')).toEqual({ trigger: 'click', active: false });

        act(() => result.current.away('took')());

        expect(result.current.dayFor('attempts')).toBe('2026-10-15');

        act(() => result.current.away('attempts')());

        expect(result.current.dayFor('attempts')).toBeNull();
    });

    it('keeps a phone\'s popup a tap on another chart opens, though the first chart hears the same tap as one off it', () => {
        phoneScreen();

        const { result } = renderHook(() => usePopup());

        act(() => result.current.events('took').onClick({ activeLabel: '2026-10-15' }));

        //
        // one click: the attempts' chart opens its popup, and the time chart's
        // listener, which holds the tap from before, hears it as off its chart
        //
        const before = result.current;

        act(() => {
            before.events('attempts').onClick({ activeLabel: '2026-10-14' });
            before.away('took')();
        });

        expect(result.current.dayFor('attempts')).toBe('2026-10-14');
        expect(result.current.dayFor('took')).toBeNull();
    });
});

describe('popupOf (#300)', () => {
    const tip = (day) => (day ? { title: day, rows: [{ key: 'a', name: 'This day', value: '1.600' }], foot: 'Went live' } : null);
    const wide = { phone: false, dayFor: (chart, day) => (chart === 'track' ? day : null) };

    it('draws the day\'s numbers in a popup box on the chart its popup is on, while recharts says it is active', () => {
        const Popup = popupOf(wide, 'track', tip);
        const { container } = render(<Popup active label='2026-10-14' />);

        expect(container.firstChild).toHaveClass('model-tip', 'model-chart-tip');
        expect(container.querySelector('.model-tip-title')).toHaveTextContent('2026-10-14');
        expect(container.querySelector('.model-tip-foot')).toHaveTextContent('Went live');
    });

    it('draws nothing while recharts says it is not, on another chart, or for a day the chart does not have', () => {
        const Popup = popupOf(wide, 'track', tip);
        const Other = popupOf(wide, 'gap', tip);

        expect(render(<Popup active={false} label='2026-10-14' />).container).toBeEmptyDOMElement();
        expect(render(<Other active label='2026-10-14' />).container).toBeEmptyDOMElement();
        expect(render(<Popup active label={undefined} />).container).toBeEmptyDOMElement();
    });

    it('draws a phone\'s for the day tapped, whatever recharts says', () => {
        const Popup = popupOf({ phone: true, dayFor: () => '2026-10-15' }, 'track', tip);
        const { container } = render(<Popup active={false} label='2026-10-14' />);

        expect(container.querySelector('.model-tip-title')).toHaveTextContent('2026-10-15');
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

describe('FoldTitle (#253)', () => {
    it('is a heading holding a button in the heading\'s words, which says the chart is open', () => {
        render(<FoldTitle as='h5' id='model-track-title' title='Track record' folded={false} onFold={() => {}} />);

        const heading = screen.getByRole('heading', { level: 5, name: 'Track record' });

        expect(heading).toHaveAttribute('id', 'model-track-title');
        expect(heading).toHaveClass('model-fold-title');
        expect(within(heading).getByRole('button', { name: 'Track record' })).toHaveAttribute('aria-expanded', 'true');
    });

    it('is a small heading by default, wearing the class it is given, and says when the chart is folded', () => {
        render(<FoldTitle className='model-card-minor' title='How long each attempt took' folded onFold={() => {}} />);

        const heading = screen.getByRole('heading', { level: 6 });

        expect(heading.className).toBe('model-fold-title model-card-minor');
        expect(within(heading).getByRole('button')).toHaveAttribute('aria-expanded', 'false');
    });

    it('hands up a click, and a key on it', async () => {
        const onFold = jest.fn();

        render(<FoldTitle title='Track record' folded={false} onFold={onFold} />);

        await userEvent.click(screen.getByRole('button', { name: 'Track record' }));
        await userEvent.keyboard('{Enter}');

        expect(onFold).toHaveBeenCalledTimes(2);
    });
});

describe('useFolds (#253)', () => {
    beforeEach(() => window.localStorage.clear());
    afterEach(wideScreen);

    const fold = (hook, name) => act(() => hook.result.current[1](name));

    it('folds nothing on a first visit', () => {
        expect(renderHook(() => useFolds('model-page')).result.current[0]).toEqual({});
    });

    it('folds a chart and opens it again, keeping each for the next visit', () => {
        const hook = renderHook(() => useFolds('model-page'));

        fold(hook, 'took');

        expect(hook.result.current[0]).toEqual({ took: true });
        expect(readLayout('model-page', 'wide').fold).toEqual({ took: true });
        expect(renderHook(() => useFolds('model-page')).result.current[0]).toEqual({ took: true });

        fold(hook, 'took');

        expect(hook.result.current[0]).toEqual({ took: false });
        expect(readLayout('model-page', 'wide').fold).toEqual({ took: false });
    });

    it('keeps a phone\'s folds apart from a wide screen\'s', () => {
        phoneScreen();

        fold(renderHook(() => useFolds('model-page')), 'gap');

        expect(readLayout('model-page', 'narrow').fold).toEqual({ gap: true });
        expect(readLayout('model-page', 'wide').fold).toEqual({});
    });

    it('leaves the folds another card keeps under the same name, and the sizes beside them, as they were', () => {
        writeLayout('model-page', 'wide', { fold: {}, size: { notes: 200 } });

        const attempts = renderHook(() => useFolds('model-page'));
        const track = renderHook(() => useFolds('model-page'));

        fold(attempts, 'attempts');
        fold(track, 'track');

        expect(readLayout('model-page', 'wide')).toEqual({ fold: { attempts: true, track: true }, size: { notes: 200 } });
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

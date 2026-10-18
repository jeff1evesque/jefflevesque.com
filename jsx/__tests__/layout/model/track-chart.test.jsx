/**
 * track-chart.test.jsx: a model's track record, on its own page (#243), and
 * another model of its task drawn beside it from a menu.
 *
 * Note: recharts is drawn for real, in a container given a size -- see
 *       sizedRecharts in test-support/model-fixtures.js.
 */

jest.mock('recharts', () => require('../../../test-support/model-fixtures.js').sizedRecharts());

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TrackChart, { DayDot, WentLiveTick, trackPoints } from '../../../import/layout/model/track-chart.jsx';
import { chartColors } from '../../../import/layout/model/scores.js';
import { ThemeModeContext } from '../../../import/general/theme-mode.jsx';
import { COMPARE_COLORS } from '../../../import/layout/model/scores.js';
import { phoneScreen, pointAt, tapAt, trackOf, wideScreen } from '../../../test-support/model-fixtures.js';

function draw(props = {}) {
    const onOther = props.onOther || jest.fn();

    const view = render(
        <ThemeModeContext.Provider value={{ theme: 'light' }}>
            <TrackChart
                name='pt-gnn'
                rows={trackOf()}
                score='loss'
                others={['fresh', 'tables']}
                other={null}
                otherRows={undefined}
                {...props}
                onOther={onOther}
            />
        </ThemeModeContext.Provider>
    );

    return { ...view, onOther };
}

function yTicks(container) {
    return [...container.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick')].map((tick) => ({
        y: Number(tick.querySelector('line, text').getAttribute('y')),
        value: Number(tick.textContent),
    }));
}

describe('trackPoints', () => {
    it('holds each day\'s score and 20-day average, and the baseline\'s average', () => {
        const rows = trackOf(2);
        const points = trackPoints('pt-gnn', rows, null, undefined, 'loss');

        expect(points).toHaveLength(2);
        expect(points[1]).toMatchObject({
            day: rows[1].day,
            single: rows[1].score.loss,
            average: rows[1].average.loss,
            days: 2,
            other: null,
        });
        expect(points[1].baseline).toBeCloseTo(1.66);
    });

    it('lines the other model up by day, and leaves this one out of a day only the other was scored on', () => {
        const mine = trackOf(3, '2026-09-02');
        const theirs = trackOf(3, '2026-09-01');
        const points = trackPoints('pt-gnn', mine, 'tables', theirs, 'loss');

        expect(points.map((point) => point.day)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']);
        expect(points[0]).toMatchObject({ single: null, average: null, days: null });
        expect(points[0].other).toBeCloseTo(theirs[0].average.loss);
        expect(points[3].other).toBeNull();
    });

    it('lines nothing up for an other model whose record is not in', () => {
        const points = trackPoints('pt-gnn', trackOf(2), 'tables', null, 'loss');

        expect(points.every((point) => point.other === null)).toBe(true);
    });
});

describe('DayDot', () => {
    it('draws a day\'s score as a faint dot', () => {
        const { container } = render(<svg><DayDot cx={4} cy={5} payload={{ single: 1.6 }} color='#000' /></svg>);

        expect(container.querySelector('circle')).toHaveAttribute('fill-opacity', '0.25');
    });

    it('draws nothing on a day with no score', () => {
        const { container } = render(
            <svg>
                <DayDot cx={4} cy={5} payload={{ single: null }} color='#000' />
                <DayDot cx={4} cy={5} color='#000' />
                <DayDot cx={4} cy={NaN} payload={{ single: 1 }} color='#000' />
            </svg>
        );

        expect(container.querySelector('circle')).toBeNull();
    });
});

describe('the chart', () => {
    it('draws a dot for every day, and lines for the average and the baseline', () => {
        const { container } = draw({ rows: trackOf(6) });

        expect(container.querySelectorAll('.model-day-dot')).toHaveLength(6);
        expect(container.querySelectorAll('.recharts-line')).toHaveLength(2);
    });

    it('draws this model in the live version\'s green, and the baseline dashed in amber (#251)', () => {
        const { container } = draw({ rows: trackOf(6) });
        const colors = chartColors('light');
        const [baseline, average] = container.querySelectorAll('.recharts-line-curve');

        expect(average).toHaveAttribute('stroke', colors.live);
        expect(baseline).toHaveAttribute('stroke', colors.baseline);
        expect(baseline).toHaveAttribute('stroke-dasharray', '5 4');
        expect(container.querySelector('.model-day-dot')).toHaveAttribute('fill', colors.live);

        const legend = within(screen.getByRole('list', { name: 'Legend' })).getAllByRole('listitem');

        expect(legend[0].querySelector('line')).toHaveAttribute('stroke', colors.live);
        expect(legend[2].querySelector('line')).toHaveAttribute('stroke-dasharray', '5 4');
    });

    it('flips the loss axis, and says so', () => {
        const { container } = draw();
        const ticks = yTicks(container);
        const top = ticks.reduce((a, b) => (a.y < b.y ? a : b));
        const bottom = ticks.reduce((a, b) => (a.y > b.y ? a : b));

        expect(top.value).toBeLessThan(bottom.value);
        expect(screen.getByText(/the loss axis is flipped/)).toBeInTheDocument();
    });

    it('leaves another score\'s axis the right way up', () => {
        const { container } = draw({ score: 'auc_beats' });
        const ticks = yTicks(container);
        const top = ticks.reduce((a, b) => (a.y < b.y ? a : b));
        const bottom = ticks.reduce((a, b) => (a.y > b.y ? a : b));

        expect(top.value).toBeGreaterThan(bottom.value);
        expect(screen.queryByText(/flipped/)).toBeNull();
    });
});

describe('another model of the task', () => {
    it('is offered from a menu of the task\'s other models, none picked to start', () => {
        draw();

        const menu = screen.getByRole('combobox', { name: 'Compare with' });

        expect(within(menu).getAllByRole('option').map((option) => option.textContent))
            .toEqual(['No other model', 'fresh', 'tables']);
        expect(menu).toHaveValue('');
    });

    it('is asked for when picked, and let go when none is', async () => {
        const { onOther, rerender } = draw();

        await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Compare with' }), 'tables');
        expect(onOther).toHaveBeenLastCalledWith('tables');

        rerender(
            <ThemeModeContext.Provider value={{ theme: 'light' }}>
                <TrackChart name='pt-gnn' rows={trackOf()} score='loss' others={['tables']} other='tables' otherRows={trackOf()} onOther={onOther} />
            </ThemeModeContext.Provider>
        );
        await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Compare with' }), '');
        expect(onOther).toHaveBeenLastCalledWith(null);
    });

    it('is drawn as a third line in the first compared color, and named in the legend in the page\'s text', () => {
        const { container } = draw({ other: 'tables', otherRows: trackOf() });

        const lines = [...container.querySelectorAll('.recharts-line-curve')].map((line) => line.getAttribute('stroke'));

        expect(lines).toContain(COMPARE_COLORS[0]);
        expect(within(screen.getByRole('list', { name: 'Legend' })).getByText('tables')).toHaveClass('model-legend-name');
    });

    it('says so while its record is on its way, and draws no line for it yet', () => {
        const { container } = draw({ other: 'tables', otherRows: undefined });

        expect(screen.getByText('Loading tables’s track record…')).toBeInTheDocument();
        expect(container.querySelectorAll('.recharts-line')).toHaveLength(2);
    });

    it('says so when its record could not be had', () => {
        draw({ other: 'tables', otherRows: null });

        expect(screen.getByText('The track record of tables could not be loaded.')).toBeInTheDocument();
    });

    it('offers no menu where the model is the only one of its task', () => {
        draw({ others: [] });

        expect(screen.queryByRole('combobox')).toBeNull();
    });
});

describe('the panel (#251)', () => {
    afterEach(wideScreen);

    it('names the day and every value drawn on it', () => {
        const { container } = draw({ rows: trackOf(1), other: 'tables', otherRows: trackOf(1) });

        pointAt(container.querySelector('.recharts-wrapper'), 300);

        const tip = container.querySelector('.model-tip');

        expect(tip).toHaveTextContent('Tue, Sep 1, 2026');
        expect(within(tip).getByText('This model, this day')).toBeInTheDocument();
        expect(within(tip).getByText('This model, 1 days')).toBeInTheDocument();
        expect(within(tip).getByText('tables, 20 days')).toBeInTheDocument();
        expect(within(tip).getByText('Know-nothing baseline, 20 days')).toBeInTheDocument();
    });

    it('is one slim line under the chart on a wide screen, on the latest day, and draws no box over the chart', () => {
        const { container } = draw({ rows: trackOf(5) });
        const panel = container.querySelector('.model-chart').nextElementSibling;

        expect(panel).toHaveClass('model-readout', 'model-readout-line');
        expect(panel).toHaveTextContent('Mon, Sep 7, 2026');
        expect(container.querySelector('.recharts-tooltip-wrapper .model-tip')).toBeNull();
    });

    it('marks this model\'s values in its green, and the baseline\'s dashed in amber', () => {
        const { container } = draw({ rows: trackOf(1) });
        const colors = chartColors('light');
        const rows = [...container.querySelectorAll('.model-tip-row')];

        expect(rows[0].querySelector('circle')).toHaveAttribute('fill', colors.live);
        expect(rows[1].querySelector('line')).toHaveAttribute('stroke', colors.live);
        expect(rows[2].querySelector('line')).toHaveAttribute('stroke', colors.baseline);
    });

    it('leaves the baseline out on a day it has none, and is not drawn for a record with no days', () => {
        const rows = trackOf(1).map((row) => ({ ...row, baseline: { ...row.baseline, loss: null } }));
        const { container, unmount } = draw({ rows: rows });

        expect(container.querySelector('.model-readout')).not.toHaveTextContent('Know-nothing baseline');

        unmount();

        expect(draw({ rows: [] }).container.querySelector('.model-readout')).toBeNull();
    });

    it('opens on a phone only for the day tapped, as rows, and closes on a second tap', () => {
        phoneScreen();

        const { container } = draw({ rows: trackOf(1) });
        const chart = container.querySelector('.recharts-wrapper');

        expect(container.querySelector('.model-readout')).toBeNull();

        tapAt(chart, 300);

        expect(container.querySelector('.model-readout')).not.toHaveClass('model-readout-line');
        expect(container.querySelector('.model-readout')).toHaveTextContent('Tue, Sep 1, 2026');

        tapAt(chart, 300);

        expect(container.querySelector('.model-readout')).toBeNull();
    });

    it('names a full window as 20 days', () => {
        const { container } = draw({ rows: trackOf(20) });

        pointAt(container.querySelector('.recharts-wrapper'), 580);

        expect(within(container.querySelector('.model-tip')).getByText('This model, 20 days')).toBeInTheDocument();
    });

    it('says when this model has no score on a day only the other was scored on', () => {
        const { container } = draw({ rows: trackOf(1, '2026-09-02'), other: 'tables', otherRows: trackOf(1, '2026-09-01') });

        pointAt(container.querySelector('.recharts-wrapper'), 100);

        const tip = container.querySelector('.model-tip');

        expect(tip).toHaveTextContent('pt-gnn has no score this day');
        expect(within(tip).queryByText('This model, this day')).toBeNull();
    });
});

describe('folding the track record (#253)', () => {
    // a fold is kept, as a reader's is: none is left for the cases after these
    beforeEach(() => window.localStorage.clear());
    afterEach(() => window.localStorage.clear());

    const title = () => screen.getByRole('button', { name: 'Track record' });

    it('is open on a first visit, its title saying so', () => {
        const { container } = draw();

        expect(title()).toHaveAttribute('aria-expanded', 'true');
        expect(container.querySelector('.model-chart')).not.toBeNull();
    });

    it('folds down to its title: the line under it, its legend, the menu, the chart, its panel and its numbers', async () => {
        const { container } = draw();

        await userEvent.click(title());

        expect(title()).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByRole('heading', { level: 5, name: 'Track record' })).toBeInTheDocument();
        expect(container.querySelector('.model-card-sub')).toBeNull();
        expect(screen.queryByRole('list', { name: 'Legend' })).toBeNull();
        expect(screen.queryByRole('combobox')).toBeNull();
        expect(container.querySelector('.model-chart')).toBeNull();
        expect(container.querySelector('.model-readout')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Show the numbers' })).toBeNull();

        await userEvent.click(title());

        expect(container.querySelector('.model-chart')).not.toBeNull();
        expect(screen.getByRole('combobox')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Show the numbers' })).toBeInTheDocument();
    });

    it('says nothing of another model on its way while folded', async () => {
        const { container } = draw({ other: 'tables', otherRows: undefined });

        await userEvent.click(title());

        expect(container.querySelector('.model-note')).toBeNull();
    });

    it('keeps the fold for the next visit', async () => {
        const { unmount } = draw();

        await userEvent.click(title());
        unmount();

        const { container } = draw();

        expect(title()).toHaveAttribute('aria-expanded', 'false');
        expect(container.querySelector('.model-chart')).toBeNull();
    });
});

describe('the numbers', () => {
    it('lists every day, newest first, with the other model where one is drawn', async () => {
        draw({ rows: trackOf(2), other: 'tables', otherRows: trackOf(1) });

        await userEvent.click(screen.getByRole('button', { name: 'Show the numbers' }));

        const table = screen.getByRole('table', { name: 'Loss, track record' });

        expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent))
            .toEqual(['Day', 'This day', '20 days', 'tables, 20 days', 'Baseline, 20 days']);

        const rows = within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent));

        expect(rows[0]).toEqual(['Sep 2', '1.610', '1.605', '', '1.660']);
        expect(rows[1]).toEqual(['Sep 1', '1.600', '1.600', '1.600', '1.660']);
    });
});

describe('the nights a new version went live', () => {
    it('stand as a short tick on the foot of the plot, in the better color', () => {
        const { container } = render(<svg><WentLiveTick x1={40} y1={10} y2={200} color='#1c5cab' /></svg>);
        const tick = container.querySelector('line');

        expect(tick).toHaveAttribute('y1', '191');
        expect(tick).toHaveAttribute('y2', '198');
        expect(tick).toHaveAttribute('x1', '40');
        expect(tick).toHaveAttribute('stroke', '#1c5cab');
    });

    it('stand nowhere without a place to stand', () => {
        const { container } = render(<svg><WentLiveTick x1={NaN} y1={10} y2={200} color='#000' /></svg>);

        expect(container.querySelector('line')).toBeNull();
    });

    it('are drawn on each such night the chart has a day for, and named in the legend', () => {
        const rows = trackOf(5);
        const { container } = draw({ rows: rows, wentLive: [rows[1].day, rows[3].day, '2025-01-02'] });

        expect(container.querySelectorAll('.model-went-live')).toHaveLength(2);
        expect(container.querySelector('.model-went-live')).toHaveAttribute('stroke', chartColors('light').better);
        expect(within(screen.getByRole('list', { name: 'Legend' })).getByText('New version went live')).toBeInTheDocument();
    });

    it('leave the legend alone where there are none', () => {
        const { container } = draw({ wentLive: ['2025-01-02'] });

        expect(container.querySelector('.model-went-live')).toBeNull();
        expect(screen.queryByText('New version went live')).toBeNull();
    });

    it('are named in the panel of their night', () => {
        const rows = trackOf(1);
        const { container } = draw({ rows: rows, wentLive: [rows[0].day] });

        pointAt(container.querySelector('.recharts-wrapper'), 300);

        expect(container.querySelector('.model-tip-foot')).toHaveTextContent('A new version went live this night');
    });

    it('share the panel\'s note with a day this model has no score', () => {
        const mine = trackOf(1, '2026-09-02');
        const { container } = draw({ rows: mine, other: 'tables', otherRows: trackOf(1, '2026-09-01'), wentLive: ['2026-09-01'] });

        pointAt(container.querySelector('.recharts-wrapper'), 100);

        expect(container.querySelector('.model-tip-foot'))
            .toHaveTextContent('pt-gnn has no score this day · A new version went live this night');
    });

    it('get a column of the table', async () => {
        const rows = trackOf(2);

        draw({ rows: rows, wentLive: [rows[0].day] });
        await userEvent.click(screen.getByRole('button', { name: 'Show the numbers' }));

        const table = screen.getByRole('table', { name: 'Loss, track record' });
        const cells = within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').pop().textContent);

        expect(within(table).getAllByRole('columnheader').pop()).toHaveTextContent('New version');
        expect(cells).toEqual(['', 'went live']);
    });
});

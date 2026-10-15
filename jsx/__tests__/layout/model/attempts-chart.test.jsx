/**
 * attempts-chart.test.jsx: each nightly attempt against the live version, on a
 * model's page (#243).
 *
 * Note: recharts is drawn for real, in a container given a size -- see
 *       sizedRecharts in test-support/model-fixtures.js -- so the marks, the
 *       bars and the flipped axis are read off the svg it draws.
 */

jest.mock('recharts', () => require('../../../test-support/model-fixtures.js').sizedRecharts());

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AttemptsChart, { AttemptMark, attemptPoints, durationUnit } from '../../../import/layout/model/attempts-chart.jsx';
import { ThemeModeContext } from '../../../import/general/theme-mode.jsx';
import { chartColors } from '../../../import/layout/model/scores.js';
import { historyOf, pointAt as pointAtChart, timedHistoryOf } from '../../../test-support/model-fixtures.js';

//
// the attempts' chart, the bars of better or worse under it, and how long each
// attempt took
//
const ATTEMPTS = '.model-chart:not(.model-chart-gap):not(.model-chart-took)';
const GAP = '.model-chart-gap';
const TOOK = '.model-chart-took';

function draw(props, theme = 'light') {
    return render(
        <ThemeModeContext.Provider value={{ theme: theme }}>
            <AttemptsChart rows={historyOf()} score='loss' {...props} />
        </ThemeModeContext.Provider>
    );
}

//
// the y of each tick on the attempts' axis, top to bottom, with its value
//
function yTicks(container) {
    return [...container.querySelectorAll(`.model-attempts ${ATTEMPTS} .recharts-yAxis .recharts-cartesian-axis-tick`)]
        .map((tick) => ({
            y: Number(tick.querySelector('line, text').getAttribute('y')),
            value: Number(tick.textContent),
        }));
}

//
// the labels on the axis of how long each attempt took, but its 0
//
function tookTicks(container) {
    return [...container.querySelectorAll(`${TOOK} .recharts-yAxis .recharts-cartesian-axis-tick`)]
        .map((tick) => tick.textContent)
        .filter((text) => text !== '0');
}

//
// point at the attempts' chart, or one of the charts under it, at `x`. On the
// 600px a chart is drawn at here, x 110 is the first of five nights and 430 the
// fourth -- Oct 15 in timedHistoryOf, the first night with times
//
function pointAt(container, x, which = ATTEMPTS) {
    pointAtChart(container.querySelector(`${which} .recharts-wrapper`), x);
}

describe('attemptPoints', () => {
    it('signs each night\'s difference so that better is positive, whichever way the score runs', () => {
        const rows = historyOf(2, {
            0: { attempt: { loss: 1.5, auc_up: 0.6, auc_beats: 0.5, acc_up: 0.5 }, live: { loss: 1.6, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.5 } },
        });

        expect(attemptPoints(rows, 'loss')[0].gap).toBeCloseTo(0.1);
        expect(attemptPoints(rows, 'auc_up')[0].gap).toBeCloseTo(0.1);
        expect(attemptPoints(rows, 'loss')[1].gap).toBeLessThan(0);
    });

    it('has no difference for a night with no score', () => {
        const rows = historyOf(1, { 0: { attempt: { loss: null, auc_up: null, auc_beats: null, acc_up: null } } });

        expect(attemptPoints(rows, 'loss')[0]).toMatchObject({ attempt: null, gap: null });
    });

    it('splits a night with times into its training and the scoring after it, in seconds (#247)', () => {
        const points = attemptPoints(timedHistoryOf(), 'loss');

        expect(points[3]).toMatchObject({ day: '2026-10-15', started: '2026-10-16T07:58:10+00:00', training: 437.2 });
        expect(points[3].scoring).toBeCloseTo(95.2);
        expect(points[4].training + points[4].scoring).toBeCloseTo(592.4);
    });

    it('has neither for a night without times, one with only one of them, or a total under its training', () => {
        const points = attemptPoints(timedHistoryOf({ 3: { total_seconds: 400 }, 4: { training_seconds: null } }), 'loss');

        points.forEach((point) => {
            expect(point).toMatchObject({ training: null, scoring: null });
        });
        expect(points[0].started).toBeNull();
    });

    it('has neither for a night from a history read before the times were kept', () => {
        const [{ started, training_seconds, total_seconds, ...older }] = historyOf(1);

        expect(attemptPoints([older], 'loss')[0]).toMatchObject({ started: null, training: null, scoring: null });
    });
});

describe('durationUnit', () => {
    //
    // the nights of a history whose one night took `seconds`
    //
    function took(seconds) {
        return attemptPoints(historyOf(1, { 0: { training_seconds: seconds - 60, total_seconds: seconds } }), 'loss');
    }

    it('is minutes up to two hours, and hours once the longest night passes them', () => {
        expect(durationUnit(took(7200))).toEqual({ seconds: 60, label: 'min' });
        expect(durationUnit(took(7200.1))).toEqual({ seconds: 3600, label: 'h' });
    });

    it('is minutes for nights without times', () => {
        expect(durationUnit(attemptPoints(historyOf(), 'loss'))).toEqual({ seconds: 60, label: 'min' });
    });
});

describe('AttemptMark', () => {
    const colors = chartColors('light');

    function mark(payload) {
        const { container } = render(<svg><AttemptMark cx={10} cy={20} payload={payload} colors={colors} /></svg>);

        return container;
    }

    it('fills a dot in the better color for an attempt that went live', () => {
        const dot = mark({ kind: 'nightly', went_live: true, attempt: 1.6 }).querySelectorAll('circle')[1];

        expect(dot).toHaveAttribute('fill', colors.better);
        expect(dot).not.toHaveAttribute('stroke');
    });

    it('draws a hollow dot ringed in the worse color for one kept back', () => {
        const dot = mark({ kind: 'nightly', went_live: false, attempt: 1.6 }).querySelectorAll('circle')[1];

        expect(dot).toHaveAttribute('fill', colors.page);
        expect(dot).toHaveAttribute('stroke', colors.worse);
    });

    it('draws a weekly retrain as a diamond, filled or hollow the same way', () => {
        const went = mark({ kind: 'weekly', went_live: true, attempt: 1.6 });
        const kept = mark({ kind: 'weekly', went_live: false, attempt: 1.6 });

        expect(went.querySelector('circle')).toBeNull();
        expect(went.querySelectorAll('polygon')[1]).toHaveAttribute('fill', colors.better);
        expect(kept.querySelectorAll('polygon')[1]).toHaveAttribute('stroke', colors.worse);
    });

    it('draws nothing for a night with no score, or no place to put it', () => {
        expect(mark({ kind: 'nightly', went_live: true, attempt: null }).querySelector('g')).toBeNull();
        expect(mark(null).querySelector('g')).toBeNull();

        const { container } = render(<svg><AttemptMark cx={NaN} cy={20} payload={{ attempt: 1 }} colors={colors} /></svg>);

        expect(container.querySelector('g')).toBeNull();
    });
});

describe('the chart', () => {
    it('draws a mark for every night: filled where it went live, hollow where it was kept back, a diamond for a weekly retrain', () => {
        const { container } = draw({
            rows: historyOf(4, { 1: { went_live: true }, 2: { kind: 'weekly' }, 3: { kind: 'weekly', went_live: true } }),
        });

        expect(container.querySelectorAll('.model-attempt')).toHaveLength(4);
        expect(container.querySelectorAll('.model-attempt-nightly.model-attempt-kept')).toHaveLength(1);
        expect(container.querySelectorAll('.model-attempt-nightly.model-attempt-live')).toHaveLength(1);
        expect(container.querySelectorAll('.model-attempt-weekly.model-attempt-kept')).toHaveLength(1);
        expect(container.querySelectorAll('.model-attempt-weekly.model-attempt-live')).toHaveLength(1);
    });

    it('flips the loss axis, so lower loss is drawn higher and up is better', () => {
        const { container } = draw({ score: 'loss' });
        const ticks = yTicks(container);
        const top = ticks.reduce((a, b) => (a.y < b.y ? a : b));
        const bottom = ticks.reduce((a, b) => (a.y > b.y ? a : b));

        expect(top.value).toBeLessThan(bottom.value);
        expect(screen.getByText(/the loss axis is flipped: lower is better/)).toBeInTheDocument();
    });

    it('leaves every other score\'s axis the right way up, and says nothing of flipping it', () => {
        const { container } = draw({ score: 'auc_up' });
        const ticks = yTicks(container);
        const top = ticks.reduce((a, b) => (a.y < b.y ? a : b));
        const bottom = ticks.reduce((a, b) => (a.y > b.y ? a : b));

        expect(top.value).toBeGreaterThan(bottom.value);
        expect(screen.queryByText(/flipped/)).toBeNull();
    });

    it('draws a bar up in the better color for a night that beat the live version, and down in the worse one for a miss', () => {
        const { container } = draw({
            rows: historyOf(2, { 0: { attempt: { loss: 1.55, auc_up: 0.6, auc_beats: 0.5, acc_up: 0.5 } } }),
        });
        const colors = chartColors('light');

        expect(container.querySelector('.model-gap-bar-better')).toHaveAttribute('fill', colors.better);
        expect(container.querySelector('.model-gap-bar-worse')).toHaveAttribute('fill', colors.worse);
    });

    it('says, on a score other than loss, that a kept-back attempt can still be better', () => {
        draw({ score: 'acc_up' });

        expect(screen.getByText(/Going live is decided by loss/)).toBeInTheDocument();
    });

    it('says nothing of it on loss, which is what decides', () => {
        draw({ score: 'loss' });

        expect(screen.queryByText(/Going live is decided by loss/)).toBeNull();
    });

    it('draws in the dark theme\'s colors on a dark page', () => {
        const { container } = draw({ rows: historyOf(1, { 0: { went_live: true } }) }, 'dark');

        expect(container.querySelectorAll('.model-attempt circle')[1]).toHaveAttribute('fill', chartColors('dark').better);
    });

    it('describes itself to a screen reader, with how many went live', () => {
        draw({ rows: historyOf(3, { 0: { went_live: true } }) });

        expect(screen.getByRole('img', { name: /Loss of 3 nightly attempts and the live version\. 1 went live/ })).toBeInTheDocument();
    });
});

describe('how long each attempt took (#247)', () => {
    it('draws a bar for each night with times, its training under the scoring after it, and none for the rest', () => {
        const { container } = draw({ rows: timedHistoryOf() });
        const training = [...container.querySelectorAll('.model-took-training')];
        const scoring = [...container.querySelectorAll('.model-took-scoring')];
        const top = (bar) => Number(bar.getAttribute('y'));
        const bottom = (bar) => top(bar) + Number(bar.getAttribute('height'));

        expect(training).toHaveLength(2);
        expect(scoring).toHaveLength(2);
        training.forEach((bar, at) => {
            expect(bottom(scoring[at])).toBeCloseTo(top(bar));
            expect(Number(scoring[at].getAttribute('height'))).toBeLessThan(Number(bar.getAttribute('height')));
        });
        expect(top(training[1])).toBeLessThan(top(training[0]));
    });

    it('draws a nightly update in the page\'s ink, and a weekly retrain in the gray of its diamond, the scoring fainter', () => {
        const { container } = draw({ rows: timedHistoryOf({ 4: { kind: 'weekly' } }) });
        const colors = chartColors('light');

        expect(container.querySelector('.model-took-training.model-took-nightly')).toHaveAttribute('fill', colors.ink);
        expect(container.querySelector('.model-took-scoring.model-took-nightly')).toHaveAttribute('fill', colors.ink);
        expect(container.querySelector('.model-took-training.model-took-weekly')).toHaveAttribute('fill', colors.muted);
        expect(container.querySelector('.model-took-scoring.model-took-weekly')).toHaveAttribute('fill', colors.muted);
        expect(container.querySelector('.model-took-training.model-took-weekly')).not.toHaveAttribute('fill-opacity');
        expect(container.querySelector('.model-took-scoring.model-took-weekly')).toHaveAttribute('fill-opacity', '0.4');
    });

    it('draws in the dark theme\'s colors on a dark page', () => {
        const { container } = draw({ rows: timedHistoryOf({ 4: { kind: 'weekly' } }) }, 'dark');

        expect(container.querySelector('.model-took-training.model-took-nightly')).toHaveAttribute('fill', chartColors('dark').ink);
        expect(container.querySelector('.model-took-training.model-took-weekly')).toHaveAttribute('fill', chartColors('dark').muted);
    });

    it('sits under the bars of better or worse, and says under its title when times start', () => {
        const { container } = draw({ rows: timedHistoryOf() });
        const titles = [...container.querySelectorAll('h6')].map((title) => title.textContent);
        const title = screen.getByRole('heading', { name: 'How long each attempt took' });

        expect(titles).toEqual(['Better or worse than the live version', 'How long each attempt took']);
        expect(title.nextElementSibling).toHaveTextContent('Times are kept from 2026-10-15 on.');
        expect(title.nextElementSibling.nextElementSibling).toHaveClass('model-chart-took');
    });

    it('is left out while no night has times, as a history without them is drawn today', () => {
        const { container } = draw({ rows: historyOf() });

        expect(screen.queryByText('How long each attempt took')).toBeNull();
        expect(screen.queryByText(/Times are kept/)).toBeNull();
        expect(container.querySelector(TOOK)).toBeNull();
        expect(container.querySelectorAll('.model-chart')).toHaveLength(2);
    });

    it('reads its axis in minutes, and in hours once the longest night passes two', () => {
        const minutes = draw({ rows: timedHistoryOf() });
        const inMinutes = tookTicks(minutes.container);

        minutes.unmount();

        const hours = draw({ rows: timedHistoryOf({ 4: { kind: 'weekly', training_seconds: 6 * 3600, total_seconds: 6.5 * 3600 } }) });
        const inHours = tookTicks(hours.container);

        expect(inMinutes.length).toBeGreaterThan(0);
        inMinutes.forEach((tick) => expect(tick).toMatch(/^\d+ min$/));
        expect(inHours.length).toBeGreaterThan(0);
        inHours.forEach((tick) => expect(tick).toMatch(/^\d+ h$/));
    });

    it('describes itself to a screen reader, with the longest night', () => {
        draw({ rows: timedHistoryOf() });

        expect(screen.getByRole('img', { name: /on the 2 nights with times\. The longest took 9 min 52 s\.$/ })).toBeInTheDocument();
    });

    it('counts a single night with times as one', () => {
        draw({ rows: historyOf(11) });

        expect(screen.getByRole('img', { name: /on the 1 night with times\. The longest took 8 min 52 s\.$/ })).toBeInTheDocument();
    });
});

describe('the tooltip', () => {
    it('names the night, its kind and what came of it, beside every score drawn on it', () => {
        const { container } = draw({ rows: historyOf(1, { 0: { kind: 'weekly', went_live: true } }) });

        pointAt(container, 300);

        const tip = container.querySelector('.model-tip');

        expect(tip).toHaveTextContent('Thu, Oct 1, 2026 · weekly retrain');
        expect(within(tip).getByText('Attempt')).toBeInTheDocument();
        expect(within(tip).getByText('Live version')).toBeInTheDocument();
        expect(within(tip).getByText('Baseline')).toBeInTheDocument();
        expect(within(tip).getByText('Worse by')).toBeInTheDocument();
        expect(tip).toHaveTextContent('Went live');
    });

    it('says, on another score, that what went live was decided by loss', () => {
        const { container } = draw({ score: 'auc_up', rows: historyOf(1) });

        pointAt(container, 300);

        expect(container.querySelector('.model-tip')).toHaveTextContent('Kept back (decided by loss)');
    });

    it('says an attempt that beat the live version was better by how much', () => {
        const { container } = draw({ rows: historyOf(1, { 0: { attempt: { loss: 1.55, auc_up: 0.6, auc_beats: 0.5, acc_up: 0.5 } } }) });

        pointAt(container, 300, '.model-chart-gap');

        expect(within(container.querySelector('.model-tip')).getByText('Better by')).toBeInTheDocument();
        expect(container.querySelector('.model-tip')).toHaveTextContent('0.050');
    });

    it('calls an attempt level with the live version where the two print alike', () => {
        const { container } = draw({ rows: historyOf(1, { 0: { attempt: { loss: 1.6001, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.5 } } }) });

        pointAt(container, 300);

        expect(container.querySelector('.model-tip')).toHaveTextContent('Level with the live version');
    });

    it('leaves the difference out on a night with no score', () => {
        const { container } = draw({ rows: historyOf(1, { 0: { attempt: { loss: null, auc_up: null, auc_beats: null, acc_up: null } } }) });

        pointAt(container, 300);

        expect(container.querySelector('.model-tip')).not.toHaveTextContent(/Better by|Worse by|Level/);
    });

    it('says how long a night with times took, and when it started, in Eastern time (#247)', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        pointAt(container, 430, TOOK);

        const tip = container.querySelector('.model-tip');

        expect(tip).toHaveTextContent('Thu, Oct 15, 2026 · nightly update');
        expect(tip).toHaveTextContent('Took 8 min 52 s (training 7 min 17 s)');
        expect(within(tip).getByText('Started 3:58 AM ET')).toBeInTheDocument();
    });

    it('keeps each half of how long it took whole, so a narrow tooltip breaks the line between them', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        pointAt(container, 430, TOOK);

        const tip = container.querySelector('.model-tip');

        expect(within(tip).getByText('Took 8 min 52 s')).toHaveClass('model-tip-whole');
        expect(within(tip).getByText('(training 7 min 17 s)')).toHaveClass('model-tip-whole');
    });

    it('marks how long it took in its bar\'s color: a weekly retrain\'s in the gray of its diamond', () => {
        const { container } = draw({ rows: timedHistoryOf({ 3: { kind: 'weekly' } }) });

        pointAt(container, 430, TOOK);

        const took = within(container.querySelector('.model-tip')).getByText(/^Took/).closest('.model-tip-row');

        expect(took.querySelector('.model-mark rect')).toHaveAttribute('fill', chartColors('light').muted);
    });

    it('says nothing of times on a night without them', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        pointAt(container, 110, TOOK);

        const tip = container.querySelector('.model-tip');

        expect(tip).toHaveTextContent('Mon, Oct 12, 2026');
        expect(tip).not.toHaveTextContent(/Took|Started/);
    });

    it('leaves out when a night started where the history does not say', () => {
        const { container } = draw({ rows: timedHistoryOf({ 3: { started: null } }) });

        pointAt(container, 430, TOOK);

        expect(container.querySelector('.model-tip')).toHaveTextContent('Took 8 min 52 s');
        expect(container.querySelector('.model-tip')).not.toHaveTextContent('Started');
    });

    it.each([
        ['the attempts', ATTEMPTS],
        ['the bars of better or worse', GAP],
        ['how long each took', TOOK],
    ])('shows the night on all three charts, pointed at on %s', (name, which) => {
        const { container } = draw({ rows: timedHistoryOf() });

        pointAt(container, 430, which);

        const tips = [...container.querySelectorAll('.model-tip')];

        expect(tips).toHaveLength(3);
        tips.forEach((tip) => expect(tip).toHaveTextContent('Thu, Oct 15, 2026'));
    });
});

describe('the numbers', () => {
    it('lists every night, newest first, with how it stood and what came of it', async () => {
        draw({
            rows: historyOf(3, {
                0: { went_live: true, attempt: { loss: 1.55, auc_up: 0.6, auc_beats: 0.5, acc_up: 0.5 } },
                1: { kind: 'weekly', attempt: { loss: 1.6001, auc_up: 0.6, auc_beats: 0.5, acc_up: 0.5 } },
                2: { attempt: { loss: null, auc_up: null, auc_beats: null, acc_up: null } },
            }),
        });

        await userEvent.click(screen.getByRole('button', { name: 'Show the numbers' }));

        const table = screen.getByRole('table', { name: 'Loss, each attempt against the live version' });
        const rows = within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent));

        expect(rows).toEqual([
            ['Oct 5', 'Nightly update', '–', '1.600', '1.660', '', 'Kept back', ''],
            ['Oct 2', 'Weekly retrain', '1.600', '1.600', '1.660', 'level', 'Kept back', ''],
            ['Oct 1', 'Nightly update', '1.550', '1.600', '1.660', 'better by 0.050', 'Went live', ''],
        ]);
    });

    it('says how long each night with times took, after what came of it, and leaves the rest empty', async () => {
        draw({ rows: timedHistoryOf() });

        await userEvent.click(screen.getByRole('button', { name: 'Show the numbers' }));

        const table = screen.getByRole('table', { name: 'Loss, each attempt against the live version' });
        const heads = within(table).getAllByRole('columnheader').map((head) => head.textContent);
        const took = within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').pop().textContent);

        expect(heads.slice(-2)).toEqual(['Result', 'Took']);
        expect(took).toEqual(['9 min 52 s', '8 min 52 s', '', '', '']);
    });
});

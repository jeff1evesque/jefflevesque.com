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

import AttemptsChart, { AttemptMark, attemptPoints } from '../../../import/layout/model/attempts-chart.jsx';
import { ThemeModeContext } from '../../../import/general/theme-mode.jsx';
import { chartColors } from '../../../import/layout/model/scores.js';
import { historyOf, pointAt as pointAtChart } from '../../../test-support/model-fixtures.js';

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
    return [...container.querySelectorAll('.model-attempts .model-chart:not(.model-chart-gap) .recharts-yAxis .recharts-cartesian-axis-tick')]
        .map((tick) => ({
            y: Number(tick.querySelector('line, text').getAttribute('y')),
            value: Number(tick.textContent),
        }));
}

//
// point at the attempts' chart, or the bars under it, at `x`
//
function pointAt(container, x, which = '.model-chart:not(.model-chart-gap)') {
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
            ['Oct 5', 'Nightly update', '–', '1.600', '1.660', '', 'Kept back'],
            ['Oct 2', 'Weekly retrain', '1.600', '1.600', '1.660', 'level', 'Kept back'],
            ['Oct 1', 'Nightly update', '1.550', '1.600', '1.660', 'better by 0.050', 'Went live'],
        ]);
    });
});

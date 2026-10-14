/**
 * compare-chart.test.jsx: two or three models of one task on one chart, over
 * /model's lists (#243).
 *
 * Note: recharts is drawn for real, in a container given a size -- see
 *       sizedRecharts in test-support/model-fixtures.js.
 */

jest.mock('recharts', () => require('../../../test-support/model-fixtures.js').sizedRecharts());

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CompareChart from '../../../import/layout/model/compare-chart.jsx';
import { ThemeModeContext } from '../../../import/general/theme-mode.jsx';
import { COMPARE_COLORS } from '../../../import/layout/model/scores.js';
import { TASKS, listingOf, pointAt, trackOf } from '../../../test-support/model-fixtures.js';

const [ptGnn, tables, fresh] = listingOf().models;

function draw(props = {}) {
    const onClear = props.onClear || jest.fn();

    const view = render(
        <ThemeModeContext.Provider value={{ theme: 'light' }}>
            <CompareChart
                picks={[{ model: ptGnn, slot: 0 }, { model: tables, slot: 2 }]}
                records={{ 'pt-gnn': trackOf(3), tables: trackOf(3) }}
                score='loss'
                task={TASKS[0]}
                {...props}
                onClear={onClear}
            />
        </ThemeModeContext.Provider>
    );

    return { ...view, onClear };
}

function yTicks(container) {
    return [...container.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick')].map((tick) => ({
        y: Number(tick.querySelector('line, text').getAttribute('y')),
        value: Number(tick.textContent),
    }));
}

describe('the comparison', () => {
    it('names the models compared, and what they predict', () => {
        draw();

        expect(screen.getByRole('heading', { name: 'Comparing pt-gnn and tables' })).toBeInTheDocument();
        expect(screen.getByText(/^Next-day direction, scored on the same days/)).toBeInTheDocument();
    });

    it('names three as a sentence does', () => {
        draw({
            picks: [{ model: ptGnn, slot: 0 }, { model: tables, slot: 1 }, { model: fresh, slot: 2 }],
            records: { 'pt-gnn': trackOf(3), tables: trackOf(3), fresh: trackOf(3) },
        });

        expect(screen.getByRole('heading', { name: 'Comparing pt-gnn, tables and fresh' })).toBeInTheDocument();
    });

    it('draws each model in the color of its slot, and the baseline', () => {
        const { container } = draw();
        const strokes = [...container.querySelectorAll('.recharts-line-curve')].map((line) => line.getAttribute('stroke'));

        expect(strokes).toHaveLength(3);
        expect(strokes).toContain(COMPARE_COLORS[0]);
        expect(strokes).toContain(COMPARE_COLORS[2]);
        expect(strokes).not.toContain(COMPARE_COLORS[1]);
    });

    it('names each model in its legend in the page\'s text, beside a swatch of its line', () => {
        draw();

        const legend = screen.getByRole('list', { name: 'Legend' });
        const name = within(legend).getByText('tables');

        expect(name).toHaveClass('model-legend-name');
        expect(name).not.toHaveAttribute('style');
        expect(name.closest('li').querySelector('line')).toHaveAttribute('stroke', COMPARE_COLORS[2]);
    });

    it('flips the loss axis and says so; another score\'s is the right way up', () => {
        const loss = draw().container;
        const lossTicks = yTicks(loss);

        expect(lossTicks.reduce((a, b) => (a.y < b.y ? a : b)).value)
            .toBeLessThan(lossTicks.reduce((a, b) => (a.y > b.y ? a : b)).value);
        expect(screen.getByText(/the loss axis is flipped/)).toBeInTheDocument();
    });

    it('says nothing of flipping on another score', () => {
        draw({ score: 'auc_up' });

        expect(screen.queryByText(/flipped/)).toBeNull();
    });

    it('is cleared from its button', async () => {
        const { onClear } = draw();

        await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

        expect(onClear).toHaveBeenCalled();
    });
});

describe('a record that is not in', () => {
    it('says the records are loading while any is on its way, and draws nothing yet', () => {
        const { container } = draw({ records: { 'pt-gnn': trackOf(3) } });

        expect(screen.getByText('Loading the track records…')).toBeInTheDocument();
        expect(container.querySelector('.recharts-wrapper')).toBeNull();
    });

    it('says which could not be loaded, and draws the rest', () => {
        const { container } = draw({ records: { 'pt-gnn': trackOf(3), tables: null } });

        expect(screen.getByText('The track record of tables could not be loaded.')).toBeInTheDocument();
        expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument();
    });
});

describe('the tooltip', () => {
    it('lists the models best first, with the baseline under them', () => {
        const { container } = draw({
            records: { 'pt-gnn': trackOf(1, '2026-09-01', () => 1.7), tables: trackOf(1, '2026-09-01', () => 1.5) },
        });

        pointAt(container.querySelector('.recharts-wrapper'), 300);

        const names = [...container.querySelectorAll('.model-tip-name')].map((name) => name.textContent);

        expect(names).toEqual(['tables (1 days)', 'pt-gnn (1 days)', 'Baseline']);
        expect(container.querySelector('.model-tip-title')).toHaveTextContent('Tue, Sep 1, 2026');
    });

    it('lists the highest first on a score where higher is better', () => {
        const { container } = draw({
            score: 'auc_up',
            records: { 'pt-gnn': trackOf(1, '2026-09-01', () => 1.5), tables: trackOf(1, '2026-09-01', () => 1.7) },
        });

        pointAt(container.querySelector('.recharts-wrapper'), 300);

        expect(container.querySelector('.model-tip-name')).toHaveTextContent('pt-gnn');
    });

    it('names a full window without its count of days', () => {
        const { container } = draw({ records: { 'pt-gnn': trackOf(20), tables: trackOf(20) } });

        pointAt(container.querySelector('.recharts-wrapper'), 585);

        expect([...container.querySelectorAll('.model-tip-name')].map((name) => name.textContent)).toContain('pt-gnn');
    });

    it.each([
        ['had not started yet', { ...fresh, started: '2026-09-05' }, 'not started yet'],
        ['had retired', { ...fresh, started: '2026-07-01', retired: '2026-08-01' }, 'retired'],
        ['has no score that day', { ...fresh, started: null }, 'no score this day'],
    ])('says why a model is missing from a day: it %s', (label, model, why) => {
        const { container } = draw({
            picks: [{ model: ptGnn, slot: 0 }, { model: model, slot: 1 }],
            records: { 'pt-gnn': trackOf(1), fresh: [] },
        });

        pointAt(container.querySelector('.recharts-wrapper'), 300);

        expect(container.querySelector('.model-tip-foot')).toHaveTextContent(`fresh: ${why}`);
    });

    it('leaves the baseline out on a day no record has it', () => {
        const rows = trackOf(1).map((row) => ({ ...row, baseline: { ...row.baseline, loss: null } }));
        const { container } = draw({ records: { 'pt-gnn': rows, tables: rows } });

        pointAt(container.querySelector('.recharts-wrapper'), 300);

        expect([...container.querySelectorAll('.model-tip-name')].map((name) => name.textContent)).not.toContain('Baseline');
    });
});

describe('the numbers', () => {
    it('lists every day, newest first, a blank where a model has none', async () => {
        draw({ records: { 'pt-gnn': trackOf(2), tables: trackOf(1) } });

        await userEvent.click(screen.getByRole('button', { name: 'Show the numbers' }));

        const table = screen.getByRole('table', { name: 'Loss, 20-day averages' });

        expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Day', 'pt-gnn', 'tables', 'Baseline']);

        const rows = within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent));

        expect(rows).toEqual([
            ['Sep 2', '1.605', '', '1.660'],
            ['Sep 1', '1.600', '1.600', '1.660'],
        ]);
    });
});

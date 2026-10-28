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
import {
    TASKS,
    heldModelOf,
    heldTrackOf,
    listingOf,
    optionsListingOf,
    optionsTrackOf,
    ownBaselines,
    phoneScreen,
    pointAt,
    tapAt,
    trackOf,
    wideScreen,
    withTop10,
} from '../../../test-support/model-fixtures.js';

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

    it('joins each model\'s line and baseline across the days it was not scored between its first and its last (#315)', () => {
        const every = trackOf(10);
        const { container } = draw({ records: { 'pt-gnn': every.filter((row, at) => at < 3 || at > 5), tables: every } });
        const lines = [...container.querySelectorAll('.recharts-line-curve')];

        expect(lines).toHaveLength(4);
        lines.forEach((line) => expect(line.getAttribute('d').match(/M/g)).toHaveLength(1));
    });

    it('still starts a model\'s line on its first day, where the other was scored before it (#315)', () => {
        const every = trackOf(10);
        const firstX = (line) => Number(/^M\s*(-?[\d.]+)/.exec(line.getAttribute('d'))[1]);
        const { container } = draw({ records: { 'pt-gnn': every.slice(4), tables: every } });
        const [, , ptGnnLine, tablesLine] = container.querySelectorAll('.recharts-line-curve');

        expect(ptGnnLine).toHaveAttribute('stroke', COMPARE_COLORS[0]);
        expect(firstX(ptGnnLine)).toBeGreaterThan(firstX(tablesLine));
    });

    it('draws each model in the color of its slot, and its baseline in the same', () => {
        const { container } = draw();
        const strokes = [...container.querySelectorAll('.recharts-line-curve')].map((line) => line.getAttribute('stroke'));

        expect(strokes).toHaveLength(4);
        expect(strokes.filter((stroke) => stroke === COMPARE_COLORS[0])).toHaveLength(2);
        expect(strokes.filter((stroke) => stroke === COMPARE_COLORS[2])).toHaveLength(2);
        expect(strokes).not.toContain(COMPARE_COLORS[1]);
    });

    it('dashes each model\'s own baseline in its color, and no model\'s line (#263)', () => {
        const { container } = draw();
        const lines = [...container.querySelectorAll('.recharts-line-curve')];
        const dashed = lines.filter((line) => line.getAttribute('stroke-dasharray') === '5 4');
        const legend = screen.getByRole('list', { name: 'Legend' });

        expect(dashed.map((line) => line.getAttribute('stroke'))).toEqual([COMPARE_COLORS[0], COMPARE_COLORS[2]]);
        expect(lines.filter((line) => !line.getAttribute('stroke-dasharray'))).toHaveLength(2);
        expect(within(legend).queryByText('Know-nothing baseline')).toBeNull();
        expect(within(legend).getByText('pt-gnn’s baseline').closest('li').querySelector('line'))
            .toHaveAttribute('stroke-dasharray', '5 4');
        expect(within(legend).getByText('tables’s baseline').closest('li').querySelector('line'))
            .toHaveAttribute('stroke', COMPARE_COLORS[2]);
        expect(screen.getByText(/each model’s own know-nothing baseline is dashed in its color/)).toBeInTheDocument();
    });

    it('draws two models whose baselines differ on a day as two baseline lines, each from its own record (#263)', async () => {
        const { container } = draw({ records: ownBaselines() });
        const rows = [...container.querySelectorAll('.model-tip-row')].map((row) => row.textContent);

        expect(rows).toContain('pt-gnn’s baseline1.660');
        expect(rows).toContain('tables’s baseline1.700');

        await userEvent.click(screen.getByRole('button', { name: 'Show the numbers' }));

        const table = screen.getByRole('table', { name: 'Loss, 20-day averages' });
        const [newest] = within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent));

        expect(newest.slice(-2)).toEqual(['1.660', '1.700']);
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
        expect(screen.getByText(/Lower is better, so the smallest numbers are at the top\./)).toBeInTheDocument();
    });

    it('says on another score that higher is better, and nothing of where the smallest numbers are (#318)', () => {
        draw({ score: 'auc_up' });

        expect(screen.getByText(/Higher is better\./)).toBeInTheDocument();
        expect(screen.queryByText(/smallest numbers/)).toBeNull();
    });

    it('is cleared from its button', async () => {
        const { onClear } = draw();

        await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

        expect(onClear).toHaveBeenCalled();
    });
});

describe('the days each line averages, the listing\'s average_days (#293)', () => {
    //
    // the two models of a listing of `days`, and records whose days each count
    // every row so far, up to `days`, as the worker counts them
    //
    const over = (days) => [{ model: { ...ptGnn, average_days: days }, slot: 0 }, { model: { ...tables, average_days: days }, slot: 2 }];
    const counted = (count, days) => trackOf(count).map((row, at) => ({ ...row, days: Math.min(at + 1, days) }));

    it('are said under the title, to a screen reader, and in the table\'s name', async () => {
        const { container } = draw({ picks: over(30) });

        expect(screen.getByText(/Lines are averages of the last 30 days, and each model’s own know-nothing baseline/)).toBeInTheDocument();
        expect(container.querySelector('.model-chart')).toHaveAttribute('aria-label', expect.stringMatching(/^Loss, 30-day averages of pt-gnn and tables/));

        await userEvent.click(screen.getByRole('button', { name: 'Show the numbers' }));

        expect(screen.getByRole('table', { name: 'Loss, 30-day averages' })).toBeInTheDocument();
    });

    it('name a model in the panel by its own days while it has fewer, and by its name alone once it has them', () => {
        const filling = draw({ picks: over(30), records: { 'pt-gnn': counted(25, 30), tables: counted(25, 30) } }).container;

        expect([...filling.querySelectorAll('.model-tip-name')].map((name) => name.textContent).slice(0, 2))
            .toEqual(expect.arrayContaining(['pt-gnn (25 days)', 'tables (25 days)']));

        const full = draw({ picks: over(10), records: { 'pt-gnn': counted(25, 10), tables: counted(25, 10) } }).container;

        expect([...full.querySelectorAll('.model-tip-name')].map((name) => name.textContent).slice(0, 2))
            .toEqual(expect.arrayContaining(['pt-gnn', 'tables']));
    });

    it('are 20 for models without them, as before format 4', () => {
        draw();

        expect(screen.getByText(/Lines are averages of the last 20 days/)).toBeInTheDocument();
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

describe('the panel (#251)', () => {
    afterEach(wideScreen);

    it('is one slim line under the chart on a wide screen, on the latest day, and draws no box over the chart', () => {
        const { container } = draw();
        const panel = container.querySelector('.model-chart').nextElementSibling;

        expect(panel).toHaveClass('model-readout', 'model-readout-line');
        expect(panel).toHaveTextContent('Thu, Sep 3, 2026');
        expect(container.querySelector('.recharts-tooltip-wrapper .model-tip')).toBeNull();
    });

    it('marks each model in its color, and its baseline dashed in the same', () => {
        const { container } = draw();
        const rows = [...container.querySelectorAll('.model-tip-row')];
        const baseline = rows.find((row) => row.textContent.startsWith('tables’s baseline'));

        expect(rows.map((row) => row.querySelector('line').getAttribute('stroke')).slice(0, 2).sort())
            .toEqual([COMPARE_COLORS[0], COMPARE_COLORS[2]].sort());
        expect(baseline.querySelector('line')).toHaveAttribute('stroke-dasharray', '5 4');
        expect(baseline.querySelector('line')).toHaveAttribute('stroke', COMPARE_COLORS[2]);
    });

    it('is not drawn while a record is on its way', () => {
        const { container } = draw({ records: { 'pt-gnn': trackOf(3), tables: undefined } });

        expect(container.querySelector('.model-readout')).toBeNull();
    });

    it('opens on a phone only for the day tapped, and closes on a second tap', () => {
        phoneScreen();

        const { container } = draw();
        const chart = container.querySelector('.recharts-wrapper');

        expect(container.querySelector('.model-readout')).toBeNull();

        tapAt(chart, 300);

        expect(container.querySelector('.model-readout')).not.toHaveClass('model-readout-line');
        expect(container.querySelector('.model-readout')).toHaveTextContent('Wed, Sep 2, 2026');

        tapAt(chart, 300);

        expect(container.querySelector('.model-readout')).toBeNull();
    });

    it('lists the models best first, with their baselines under them in the same order', () => {
        const { container } = draw({
            records: { 'pt-gnn': trackOf(1, '2026-09-01', () => 1.7), tables: trackOf(1, '2026-09-01', () => 1.5) },
        });

        pointAt(container.querySelector('.recharts-wrapper'), 300);

        const names = [...container.querySelectorAll('.model-tip-name')].map((name) => name.textContent);

        expect(names).toEqual(['tables (1 days)', 'pt-gnn (1 days)', 'tables’s baseline', 'pt-gnn’s baseline']);
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

    it('leaves a model\'s baseline out on a day its record has none', () => {
        //
        // the worker averages a first day with no baseline to none
        //
        const none = trackOf(1).map((row) => ({ ...row, baseline_average: { ...row.baseline_average, loss: null } }));
        const { container } = draw({ records: { 'pt-gnn': none, tables: trackOf(1) } });

        pointAt(container.querySelector('.recharts-wrapper'), 300);

        const names = [...container.querySelectorAll('.model-tip-name')].map((name) => name.textContent);

        expect(names).not.toContain('pt-gnn’s baseline');
        expect(names).toContain('tables’s baseline');
    });
});

describe('models of different tasks, on a score of what their picks made (#279)', () => {
    const listing = optionsListingOf();
    const [stocks, , options] = listing.tasks;
    const named = (name) => listing.models.find((model) => model.name === name);

    function across(props = {}) {
        return draw({
            picks: [{ model: named('pt-gnn'), slot: 0 }, { model: named('pt-options'), slot: 1 }],
            records: { 'pt-gnn': withTop10(trackOf(3)), 'pt-options': optionsTrackOf(3) },
            score: 'top10_gain',
            task: stocks,
            tasks: [stocks, options],
            onScore: jest.fn(),
            ...props,
        });
    }

    it('draws both, each beside its own baseline, dashed in its color', () => {
        const { container } = across();
        const lines = [...container.querySelectorAll('.recharts-line-curve')];

        expect(lines).toHaveLength(4);
        expect(lines.filter((line) => line.getAttribute('stroke-dasharray') === '5 4').map((line) => line.getAttribute('stroke')))
            .toEqual([COMPARE_COLORS[0], COMPARE_COLORS[1]]);
        expect(screen.getByRole('heading', { name: 'Comparing pt-gnn and pt-options' })).toBeInTheDocument();
    });

    it('reads each one\'s own gain and its own baseline\'s, an options model\'s on its 1-day hold', () => {
        const { container } = across();
        const rows = [...container.querySelectorAll('.model-tip-row')].map((row) => row.textContent);

        expect(rows).toEqual([
            'pt-options (3 days)3.07%',
            'pt-gnn (3 days)0.12%',
            'pt-options’s baseline−4.00%',
            'pt-gnn’s baseline0.03%',
        ]);
    });

    it('offers a picker of its own of the scores both tasks name, and hands up the one picked', async () => {
        const onScore = jest.fn();

        across({ onScore: onScore });

        const buttons = within(screen.getByRole('group', { name: 'Score' })).getAllByRole('button');

        expect(buttons.map((button) => button.textContent)).toEqual(['Top 10 gain', 'Top 10 wins']);
        expect(buttons[0]).toHaveAttribute('aria-pressed', 'true');

        await userEvent.click(buttons[1]);

        expect(onScore).toHaveBeenCalledWith('top10_wins');
    });

    it('says what each predicts, and that the trades last different lengths and options swing more', () => {
        across();

        expect(screen.getByText(/^Next-day direction and Option picks, scored on the same days\./)).toBeInTheDocument();
        expect(screen.getByText(/These trades last different lengths: the stocks are held from 9:40 to 3:40 the same day, the options’ 1-day hold until 3:40 the next day\. Options also swing far more than stocks\./))
            .toBeInTheDocument();
        expect(screen.queryByText(/flipped/)).toBeNull();
    });

    it('has no picker of its own, and says nothing of lengths, for models of one task', () => {
        draw();

        expect(screen.queryByRole('group', { name: 'Score' })).toBeNull();
        expect(screen.queryByText(/different lengths/)).toBeNull();
    });

    it('says nothing of lengths for two tasks of stocks, which are traded alike', () => {
        across({ tasks: [stocks, listing.tasks[1]] });

        expect(screen.queryByText(/different lengths/)).toBeNull();
    });

    it('lists a model whose record has no column for the score after the rest, with none for it', () => {
        const { container } = across({ records: { 'pt-gnn': trackOf(3), 'pt-options': optionsTrackOf(3) } });
        const names = [...container.querySelectorAll('.model-tip-name')].map((name) => name.textContent);
        const values = [...container.querySelectorAll('.model-tip-value')].map((value) => value.textContent);

        expect(names.slice(0, 2)).toEqual(['pt-options (3 days)', 'pt-gnn (3 days)']);
        expect(values[1]).toBe('–');
        expect(names).not.toContain('pt-gnn’s baseline');
    });
});

describe('the numbers', () => {
    it('lists every day, newest first, a blank where a model has none', async () => {
        draw({ records: { 'pt-gnn': trackOf(2), tables: trackOf(1) } });

        await userEvent.click(screen.getByRole('button', { name: 'Show the numbers' }));

        const table = screen.getByRole('table', { name: 'Loss, 20-day averages' });

        expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent))
            .toEqual(['Day', 'pt-gnn', 'tables', 'pt-gnn’s baseline', 'tables’s baseline']);

        const rows = within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent));

        expect(rows).toEqual([
            ['Sep 2', '1.605', '', '1.660', ''],
            ['Sep 1', '1.600', '1.600', '1.660', '1.660'],
        ]);
    });
});

describe('models on their lists\' holds, from format 5 on (#300)', () => {
    //
    // tables-gnn's record with its holds, the newest five days without their
    // 5-day results, and pt-gnn's from before format 5, with none
    //
    const held = heldTrackOf(30);
    const tablesGnn = heldModelOf();

    function onHolds(holds = { 'tables-gnn': 5, 'pt-gnn': 5 }, records = { 'tables-gnn': held, 'pt-gnn': trackOf(30) }) {
        return draw({
            picks: [{ model: tablesGnn, slot: 0, hold: holds['tables-gnn'] }, { model: ptGnn, slot: 1, hold: holds['pt-gnn'] }],
            records: records,
        });
    }

    const cellsOf = (container, label) => {
        const columns = [...container.querySelectorAll('.model-numbers-table thead th')].map((cell) => cell.textContent);
        const at = columns.indexOf(label);

        return [...container.querySelectorAll('.model-numbers-table tbody tr')].map((row) => row.children[at].textContent);
    };

    it('draws a model on its hold where its record has the hold, named in the legend', async () => {
        const { container } = onHolds();

        await userEvent.click(screen.getByRole('button', { name: 'Show the numbers' }));

        expect(screen.getByRole('list', { name: 'Legend' })).toHaveTextContent('tables-gnn, 5-day hold');
        expect(cellsOf(container, 'tables-gnn')[10]).toBe(held[19].average.loss_5d.toFixed(3));
    });

    it('draws a model whose record has no such hold on its plain scores, and names no hold for it', async () => {
        const { container } = onHolds();

        await userEvent.click(screen.getByRole('button', { name: 'Show the numbers' }));

        expect(screen.getByRole('list', { name: 'Legend' }).textContent).not.toMatch(/pt-gnn, 5-day hold/);
        expect(cellsOf(container, 'pt-gnn')[0]).toBe(trackOf(30)[29].average.loss.toFixed(3));
    });

    it('leaves a day whose result on the hold is not in yet empty, and says so in its panel', async () => {
        const { container } = onHolds();

        await userEvent.click(screen.getByRole('button', { name: 'Show the numbers' }));

        expect(cellsOf(container, 'tables-gnn').slice(0, 5)).toEqual(['', '', '', '', '']);
        expect(container.querySelector('.model-readout')).toHaveTextContent('tables-gnn: its 5-day result is not in yet');
    });

    it('names a model\'s days so far on the hold by the hold\'s own days', () => {
        const fewer = heldTrackOf(30, { notIn: 20 });
        const { container } = onHolds({ 'tables-gnn': 5, 'pt-gnn': 5 }, { 'tables-gnn': fewer, 'pt-gnn': trackOf(30) });

        pointAt(container.querySelector('.recharts-wrapper'), 200);

        expect(container.querySelector('.model-readout')).toHaveTextContent(/tables-gnn \(\d+ days\)/);
    });

    it('names no hold for the 1-day hold, as before format 5', () => {
        onHolds({ 'tables-gnn': 1, 'pt-gnn': 1 });

        expect(screen.getByRole('list', { name: 'Legend' })).not.toHaveTextContent('hold');
    });
});

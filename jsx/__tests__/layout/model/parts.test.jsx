/**
 * parts.test.jsx: what both model pages draw alike (#243): the score picker, a
 * model's status, a legend's marks, a tooltip's box, and a chart's table.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Legend, Mark, Numbers, ScorePicker, StatusPill, TipBox, axisStyle } from '../../../import/layout/model/parts.jsx';
import { modelOf } from '../../../test-support/model-fixtures.js';

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
        ['dot', 'circle'],
        ['ring', 'circle'],
        ['diamond', 'polygon'],
        ['faint', 'circle'],
        ['bar', 'rect'],
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

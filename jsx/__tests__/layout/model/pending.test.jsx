/**
 * pending.test.jsx: what /model and a model's own page hold while the listing is
 * on its way (#274). See model.test.jsx and model-page.test.jsx for the pages
 * that draw these, and stylesheet.test.js for how they are laid out.
 */

import React from 'react';
import { render } from '@testing-library/react';

import {
    PendingChart,
    PendingGroup,
    PendingLines,
    PendingPicker,
    PendingPicks,
    PendingRecord,
    PendingRow,
    PendingSummary,
    STAGGER,
} from '../../../import/layout/model/pending.jsx';

//
// the text of each element a selector finds, in the page's order
//
function textsOf(container, selector) {
    return [...container.querySelectorAll(selector)].map((each) => each.textContent);
}

describe('PendingLines', () => {
    it('draws a bar for each line of text, each a line of its own', () => {
        const { container } = render(<p><PendingLines widths={['17rem', '9rem']} /></p>);

        expect(container.querySelectorAll('.model-pending-line > .graph-pending-bar')).toHaveLength(2);
    });

    it('makes each bar at most as wide as its line', () => {
        //
        // read off what each line hands its bar: jsdom drops a width it cannot
        // parse, and 'min()' is one
        //
        const lines = PendingLines({ widths: ['17rem', '9rem'] });

        expect(lines.map((line) => line.props.children.props.width)).toEqual(['min(17rem, 100%)', 'min(9rem, 100%)']);
    });

    it('breathes each line a beat after the one over it, from the delay it is given', () => {
        const { container } = render(<p><PendingLines widths={['1rem', '1rem', '1rem']} delay={STAGGER} /></p>);

        expect([...container.querySelectorAll('.graph-pending-bar')].map((bar) => bar.style.animationDelay))
            .toEqual([`${STAGGER}ms`, `${2 * STAGGER}ms`, `${3 * STAGGER}ms`]);
    });
});

describe('PendingRow', () => {
    function row(at = 0, parts = false) {
        const drawn = parts ? <PendingRow at={at} parts /> : <PendingRow at={at} />;

        return render(drawn).container.querySelector('.model-row');
    }

    it('wears a row\'s classes, cell for cell, as #300 lays a row out, so the list lays it out as one', () => {
        expect([...row().children].map((cell) => cell.className)).toEqual([
            'model-cell model-cell-compare',
            'model-cell model-cell-model',
            'model-cell model-cell-score',
            'model-cell model-cell-trend',
            'model-cell model-cell-since',
        ]);
    });

    it('names no figure, as the picker over the list names the score (#300)', () => {
        expect(row()).toHaveTextContent(/^$/);
    });

    it('puts loss\'s three parts in the score\'s place with `parts`, under a bar for what they add up to, each named over a bar for its figure and one for how it stands (#283, #300)', () => {
        const drawn = row(0, true);
        const parts = [...drawn.querySelectorAll('.model-part-cells > .model-part-cell')];

        expect(drawn.children[2]).toHaveClass('model-cell', 'model-cell-parts');
        expect(drawn.querySelector('.model-cell-score')).toBeNull();
        expect(drawn.querySelector('.model-parts-note > .graph-pending-bar')).not.toBeNull();
        expect(textsOf(drawn, '.model-part-cell-name')).toEqual(['Up or down', 'Beats the average stock', 'Size of the move']);
        expect(parts).toHaveLength(3);
        parts.forEach((part) => {
            expect(part.querySelector('.model-part-cell-value > .graph-pending-bar')).not.toBeNull();
            expect(part.querySelector('.model-gap > .graph-pending-bar')).not.toBeNull();
        });
    });

    it('draws its box disabled, and no bell, since a retired model has none', () => {
        const drawn = row();

        expect(drawn.querySelector('input[type="checkbox"]')).toBeDisabled();
        expect(drawn.querySelector('.model-bell')).toBeNull();
        expect([...drawn.querySelector('.model-name-line').children].every((each) => each.classList.contains('graph-pending-bar'))).toBe(true);
    });

    it('draws a bar for every value, and the trend line\'s waiting block', () => {
        const drawn = row();

        expect(drawn.querySelectorAll('.model-name-line > .graph-pending-bar')).toHaveLength(2);
        expect(drawn.querySelectorAll('.model-description .model-pending-line')).toHaveLength(2);
        ['.model-score-value', '.model-score-days', '.model-gap', '.model-since', '.model-since-went'].forEach((value) => {
            expect(drawn.querySelector(`${value} > .graph-pending-bar`)).not.toBeNull();
        });
        expect(drawn.querySelector('.model-cell-trend > .model-trend-pending')).not.toBeNull();
    });

    it('breathes a row later than the one over it, so the wave runs down the list', () => {
        const first = row(0).querySelector('.graph-pending-bar').style.animationDelay;
        const second = row(1).querySelector('.graph-pending-bar').style.animationDelay;

        expect(parseInt(second, 10)).toBeGreaterThan(parseInt(first, 10));
    });
});

describe('PendingGroup', () => {
    it('draws two rows in the list\'s box, with no headings over them, as #300 lays a list out (#283)', () => {
        const { container } = render(<PendingGroup score='acc_up' />);
        const list = container.querySelector('.model-list');

        expect(list).not.toHaveClass('model-list-parts');
        expect(list.querySelectorAll(':scope > div > .model-row')).toHaveLength(2);
        expect(container.querySelector('.model-list-head')).toBeNull();
        expect(container.querySelectorAll('.model-row .model-cell-score')).toHaveLength(2);
    });

    it('draws loss as its three parts, as the first list, of stock models, opens on it (#283)', () => {
        const { container } = render(<PendingGroup />);

        expect(container.querySelector('.model-list')).toHaveClass('model-list-parts');
        expect(container.querySelectorAll('.model-row .model-cell-parts')).toHaveLength(2);
        expect(container.querySelector('.model-row .model-cell-score')).toBeNull();
    });

    it('draws the task\'s heading and its line as bars', () => {
        const { container } = render(<PendingGroup score='loss' />);
        const head = container.querySelector('.model-group-head');

        expect(head.querySelector('h5 > .graph-pending-bar')).not.toBeNull();
        expect(head.querySelectorAll('.model-group-detail .model-pending-line')).toHaveLength(2);
        expect(head).toHaveTextContent(/^$/);
    });

    it('is hidden from a screen reader, and so holds nothing the keyboard can reach', () => {
        const { container } = render(<PendingGroup score='loss' />);
        const group = container.querySelector('.model-group');

        expect(group).toHaveAttribute('aria-hidden', 'true');
        expect(group.querySelectorAll('a, button, [tabindex]')).toHaveLength(0);
        group.querySelectorAll('input').forEach((input) => expect(input).toBeDisabled());
    });

    it('draws its list\'s score picker as its name over bars, between its heading and its list (#279)', () => {
        const { container } = render(<PendingGroup />);
        const group = container.querySelector('.model-group');

        expect([...group.children].map((part) => part.className)).toEqual(['model-group-head', 'model-controls model-group-controls', 'model-list model-list-parts']);
        expect(group.querySelector('.model-group-controls .model-picker-pending')).not.toBeNull();
    });
});

describe('PendingPicker (#279)', () => {
    it('names the picker, and draws a bar in the outline of each of four buttons and of a phone\'s menu', () => {
        const { container } = render(<PendingPicker />);
        const picker = container.querySelector('.model-scores');

        expect(picker).toHaveClass('model-picker-pending');
        expect(picker).toHaveAttribute('aria-hidden', 'true');
        expect(picker.querySelector('.model-control-label')).toHaveTextContent(/^Score$/);
        expect(picker.querySelectorAll('.model-score-buttons > .model-score-pending > .graph-pending-bar')).toHaveLength(4);
        expect(picker.querySelector('.model-score-menu .model-score-pending > .graph-pending-bar')).not.toBeNull();
        expect(picker.querySelectorAll('button, select')).toHaveLength(0);
    });

    it('breathes each button\'s bar a beat after the one before it', () => {
        const { container } = render(<PendingPicker />);

        expect([...container.querySelectorAll('.model-score-buttons .graph-pending-bar')].map((bar) => bar.style.animationDelay))
            .toEqual([0, 1, 2, 3].map((at) => `${at * STAGGER}ms`));
    });
});

describe('PendingPicks (#290)', () => {
    it('draws the picks page under its heading, hidden from a screen reader, with no control in it', () => {
        const { container } = render(<PendingPicks />);
        const page = container.querySelector('.model-picks-pending');

        expect(page).toHaveAttribute('aria-hidden', 'true');
        expect(page.querySelectorAll('button, input, select')).toHaveLength(0);
    });

    it('names the hold picker over a bar for each hold, and a bar where a phone\'s menu will be', () => {
        const { container } = render(<PendingPicks />);
        const picker = container.querySelector('.model-scores');

        expect(picker.querySelector('.model-control-label')).toHaveTextContent('Hold');
        expect(picker.querySelectorAll('.model-score-buttons > .model-score-pending > .graph-pending-bar')).toHaveLength(3);
        expect(picker.querySelectorAll('.model-score-menu .graph-pending-bar')).toHaveLength(1);
    });

    it('names the When card\'s three days over bars, and the record\'s card over bars for its figures and its days', () => {
        const { container } = render(<PendingPicks />);
        const [when, record] = container.querySelectorAll('.model-picks-summary > .model-stat');

        expect([...when.querySelectorAll('.model-picks-when-name')].map((name) => name.textContent)).toEqual(['From', 'Buy', 'Sell']);
        expect(when.querySelectorAll('.model-picks-when-day > .graph-pending-bar')).toHaveLength(3);
        expect(record.querySelector('.model-stat-label')).toHaveTextContent('How its top 10 has done');
        expect([...record.querySelectorAll('.model-picks-figure .model-stat-detail')].map((line) => line.textContent))
            .toEqual(['average gain', 'made money']);
        expect(record.querySelector('.model-picks-strip-pending')).not.toBeNull();
    });

    it('titles the picks\' card, with a bar for its line and ten rows of bars', () => {
        const { container } = render(<PendingPicks />);
        const card = container.querySelector('.model-card.model-picks');

        expect(card.querySelector('h5')).toHaveTextContent(/^Top 10$/);
        expect(card.querySelectorAll('.model-card-sub .model-pending-line')).toHaveLength(1);
        expect(card.querySelectorAll('.model-picks-pending-rows > .model-pending-line')).toHaveLength(10);
    });
});

describe('PendingRecord (#290)', () => {
    it('stands a bar in for each of the record\'s figures, over its line, hidden from a screen reader', () => {
        const { container } = render(<PendingRecord />);
        const figures = container.querySelector('.model-picks-figures');

        expect(figures).toHaveAttribute('aria-hidden', 'true');
        expect(figures.querySelectorAll('.model-stat-value > .graph-pending-bar')).toHaveLength(2);
    });
});

describe('PendingSummary', () => {
    it('names the three figures over bars as a wide screen\'s cards, with two rows under each one\'s rule', () => {
        const { container } = render(<PendingSummary score='auc_beats' />);

        expect(textsOf(container, '.model-stat-label')).toEqual(['Live version', 'Attempts that went live', 'Beat-the-average AUC']);
        container.querySelectorAll('.model-stat').forEach((card) => {
            expect(card.querySelector('.model-stat-value > .graph-pending-bar')).not.toBeNull();
            expect(card.querySelector('.model-stat-detail > .graph-pending-bar')).not.toBeNull();
            expect(card.querySelectorAll('.model-stat-body .model-stat-row')).toHaveLength(2);
        });
    });

    it('names them as a phone\'s boxes do, the shorter names, over a bar each', () => {
        const { container } = render(<PendingSummary score='loss' />);

        expect(textsOf(container, '.stream-focus-figure-label')).toEqual(['Live version', 'Went live', 'Loss']);
        expect(container.querySelectorAll('.stream-focus-figure-value > .graph-pending-bar')).toHaveLength(3);
    });

    it('is hidden from a screen reader, which hears the page\'s loading line instead', () => {
        const { container } = render(<PendingSummary score='loss' />);

        expect(container.querySelector('.model-summary')).toHaveAttribute('aria-hidden', 'true');
    });
});

describe('PendingChart', () => {
    it('titles its card as the chart\'s, in the look of the title that folds it, though not as a control', () => {
        const { container } = render(<PendingChart title='Track record' height={280} />);

        expect(container.querySelector('h5.model-fold-title > .model-fold')).toHaveTextContent(/^Track record$/);
        expect(container.querySelector('button')).toBeNull();
        expect(container.querySelector('.model-card')).toHaveAttribute('aria-hidden', 'true');
        expect(container.querySelectorAll('.model-card-sub .model-pending-line')).toHaveLength(2);
    });

    it('draws the chart\'s frame as tall as the chart, its grid\'s five lines breathing a beat apart', () => {
        const { container } = render(<PendingChart title='Track record' height={140} />);
        const frame = container.querySelector('.model-chart-pending');

        expect(frame.style.height).toBe('140px');
        expect([...frame.children].map((line) => line.style.animationDelay))
            .toEqual([0, 1, 2, 3, 4].map((at) => `${at * STAGGER}ms`));
    });
});

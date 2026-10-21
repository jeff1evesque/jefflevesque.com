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
    function row(score = 'loss', at = 0) {
        return render(<PendingRow score={score} at={at} />).container.querySelector('.model-row');
    }

    it('wears a row\'s classes, cell for cell, so a wide screen\'s grid and a phone\'s card lay it out as one', () => {
        expect([...row().children].map((cell) => cell.className)).toEqual([
            'model-cell model-cell-compare',
            'model-cell model-cell-model',
            'model-cell model-cell-alarm',
            'model-cell model-cell-score',
            'model-cell model-cell-trend',
            'model-cell model-cell-live',
            'model-cell model-cell-went',
        ]);
    });

    it('names its figures for a phone\'s card, the score as the one picked', () => {
        expect(textsOf(row('auc_up'), '.model-cell-label')).toEqual(['Up/down AUC', 'Last 60 days', 'Live version', 'Went live']);
    });

    it('draws its box disabled, and no bell, since a retired model has none', () => {
        const drawn = row();

        expect(drawn.querySelector('input[type="checkbox"]')).toBeDisabled();
        expect(drawn.querySelector('.model-cell-alarm')).toBeEmptyDOMElement();
    });

    it('draws a bar for every value, and the trend line\'s waiting block', () => {
        const drawn = row();

        expect(drawn.querySelectorAll('.model-name-line > .graph-pending-bar')).toHaveLength(2);
        ['.model-address', '.model-score-value', '.model-gap'].forEach((value) => {
            expect(drawn.querySelector(`${value} > .graph-pending-bar`)).not.toBeNull();
        });
        expect(drawn.querySelectorAll('.model-description .model-pending-line')).toHaveLength(2);
        expect(drawn.querySelectorAll('.model-figure > .graph-pending-bar')).toHaveLength(2);
        expect(drawn.querySelectorAll('.model-figure-detail > .graph-pending-bar')).toHaveLength(2);
        expect(drawn.querySelector('.model-trend-pending')).not.toBeNull();
    });

    it('breathes a row later than the one over it, so the wave runs down the list', () => {
        const first = row('loss', 0).querySelector('.graph-pending-bar').style.animationDelay;
        const second = row('loss', 1).querySelector('.graph-pending-bar').style.animationDelay;

        expect(parseInt(second, 10)).toBeGreaterThan(parseInt(first, 10));
    });
});

describe('PendingGroup', () => {
    it('heads two rows with the list\'s own headings, the score\'s as the one picked', () => {
        const { container } = render(<PendingGroup score='acc_up' />);

        expect([...container.querySelector('.model-list-head').children].map((heading) => heading.textContent))
            .toEqual(['Compare', 'Model', '', 'Up/down accuracy, last 20 days', 'Last 60 days', 'Live version', 'Went live']);
        expect(container.querySelectorAll('.model-row')).toHaveLength(2);
    });

    it('draws the task\'s heading, its line and its count as bars', () => {
        const { container } = render(<PendingGroup score='loss' />);
        const head = container.querySelector('.model-group-head');

        expect(head.querySelector('h5 > .graph-pending-bar')).not.toBeNull();
        expect(head.querySelectorAll('.model-group-detail .model-pending-line')).toHaveLength(2);
        expect(head.querySelector('.model-group-count > .graph-pending-bar')).not.toBeNull();
        expect(head).toHaveTextContent(/^$/);
    });

    it('is hidden from a screen reader, and so holds nothing the keyboard can reach', () => {
        const { container } = render(<PendingGroup score='loss' />);
        const group = container.querySelector('.model-group');

        expect(group).toHaveAttribute('aria-hidden', 'true');
        expect(group.querySelectorAll('a, button, [tabindex]')).toHaveLength(0);
        group.querySelectorAll('input').forEach((input) => expect(input).toBeDisabled());
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

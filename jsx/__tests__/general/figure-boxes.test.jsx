/**
 * figure-boxes.test.jsx: a few figures side by side (#206, #230) -- each its
 * name, an info icon whose note says what the figure counts, and its value --
 * as /stream's stream on its own draws them, and a dataset on its own on /data.
 *
 * What the pages hand them is held by their own suites: stream-focus.test.jsx
 * for /stream, and data-mobile.test.jsx for /data. This holds what the boxes do
 * with any figures: the markup the stylesheet keys on, a phone's shorter forms,
 * the class a value is colored by, and the note after each name.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FigureBoxes, { shortCount } from '../../import/general/figure-boxes.jsx';

//
// a dataset's month, as /data hands it over: a total with a shorter count and
// a shorter name, the rows it holds, and its partitions
//
const FIGURES = [
    {
        key: 'total',
        label: 'Total Filings',
        short: 'Filings',
        note: 'All the filings below, added up',
        value: '83,246',
        shortValue: '83.2K',
        tone: 'total',
    },
    { key: 'rows', label: 'Forms', note: 'One row per form, below', value: '250' },
    { key: 'partitions', label: 'Partitions', note: 'Partitions the month is stored in', value: '1' },
];

function draw(figures = FIGURES) {
    return render(<FigureBoxes figures={figures} />);
}

const boxes = () => [...document.querySelectorAll('.stream-focus-figures > .stream-focus-figure')];

describe('the boxes', () => {
    it('draw a box for each figure, in one row, a name over each value', () => {
        draw();

        expect(document.querySelectorAll('.stream-focus-figures')).toHaveLength(1);
        expect(boxes()).toHaveLength(3);
        expect(boxes().map((box) => box.firstElementChild.className))
            .toEqual(Array(3).fill('stream-focus-figure-label stream-focus-noted'));
        expect(boxes().map((box) => box.lastElementChild.classList.contains('stream-focus-figure-value')))
            .toEqual([true, true, true]);
    });

    it('draw a name and a value both ways where a phone has a shorter one, and once where not', () => {
        draw();

        const [total, rows] = boxes();

        expect(total.querySelector('.stream-focus-figure-label .stream-focus-long')).toHaveTextContent('Total Filings');
        expect(total.querySelector('.stream-focus-figure-label .stream-focus-short')).toHaveTextContent('Filings');
        expect(total.querySelector('.stream-focus-figure-value .stream-focus-long')).toHaveTextContent('83,246');
        expect(total.querySelector('.stream-focus-figure-value .stream-focus-short')).toHaveTextContent('83.2K');

        expect(rows.querySelector('.stream-focus-long')).toBeNull();
        expect(rows.querySelector('.stream-focus-figure-label')).toHaveTextContent('Forms');
        expect(rows.querySelector('.stream-focus-figure-value')).toHaveTextContent('250');
    });

    it('color a value by the tone it is given, and leave one with none in the page\'s text', () => {
        draw();

        expect(boxes().map((box) => box.lastElementChild.className)).toEqual([
            'stream-focus-figure-value stream-focus-figure-total',
            'stream-focus-figure-value',
            'stream-focus-figure-value',
        ]);
    });

    it('follow each name with an info icon, its note describing the name', () => {
        draw();

        const labels = [...document.querySelectorAll('.stream-focus-figure-label')];

        expect(labels.map((label) => label.querySelector('svg').getAttribute('data-testid')))
            .toEqual(['InfoOutlinedIcon', 'InfoOutlinedIcon', 'InfoOutlinedIcon']);
        expect(labels.map((label) => label.getAttribute('tabindex'))).toEqual(['0', '0', '0']);
        expect(labels[0]).toHaveAccessibleDescription('All the filings below, added up');
        expect(labels[1]).toHaveAccessibleDescription('One row per form, below');
        expect(labels[2]).toHaveAccessibleDescription('Partitions the month is stored in');
    });

    it('show a figure\'s note under the pointer', async () => {
        draw();

        fireEvent.mouseOver(document.querySelectorAll('.stream-focus-figure-label')[2]);

        expect(await screen.findByRole('tooltip')).toHaveTextContent('Partitions the month is stored in');
    });

    it('draw a figure still on its way as it is', () => {
        draw([{ key: 'rows', label: 'Forms', note: 'One row per form, below', value: 'n/a' }]);

        expect(boxes()[0].querySelector('.stream-focus-figure-value')).toHaveTextContent('n/a');
        expect(boxes()[0].querySelector('.stream-focus-figure-value').className).toBe('stream-focus-figure-value');
    });
});

describe('shortCount', () => {
    it.each([
        ['205,199,099', '205.2M'],
        ['83,246', '83.2K'],
        ['110', '110'],
        [97343, '97.3K'],
    ])('writes %s in a few characters, %s', (figure, short) => {
        expect(shortCount(figure)).toBe(short);
    });

    it('leaves whatever stands in for a count as it is', () => {
        expect(shortCount('n/a')).toBe('n/a');
    });
});

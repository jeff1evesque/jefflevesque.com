/**
 * small-components.test.jsx: Spinner, Submit, and the throughput key.
 *
 * Three of the smallest modules in the codebase, grouped because each is a handful
 * of lines and none warrants its own file. All three are used widely enough that a
 * change to any would be felt across the app.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Spinner from '../../import/general/spinner.jsx';
import Submit from '../../import/general/submit-button.jsx';
import THROUGHPUT_KEY from '../../import/general/throughput-key.js';

describe('Spinner', () => {
    it('renders the element the stylesheet animates', () => {
        //
        // there is no text and no role -- the whole component is a div carrying the
        // 'sending' class, and the animation lives in the css. So the class IS the
        // contract.
        //
        render(<Spinner />);

        expect(document.querySelector('.sending')).toBeInTheDocument();
    });

    it('renders nothing a reader could mistake for content', () => {
        render(<Spinner />);

        expect(document.body.textContent).toBe('');
    });
});

describe('Submit', () => {
    it('renders a submit input', () => {
        render(<Submit />);

        const input = document.querySelector('input');
        expect(input).toHaveAttribute('type', 'submit');
    });

    it('defaults its label to Submit', () => {
        render(<Submit />);

        expect(screen.getByDisplayValue('Submit')).toBeInTheDocument();
    });

    it('uses the label it is given', () => {
        render(<Submit btnValue='Create account' />);

        expect(screen.getByDisplayValue('Create account')).toBeInTheDocument();
    });

    it('defaults its class to form-submit', () => {
        render(<Submit />);

        expect(document.querySelector('input')).toHaveClass('form-submit');
    });

    it('uses the class it is given', () => {
        render(<Submit cssClass='btn btn-primary' />);

        expect(document.querySelector('input')).toHaveClass('btn', 'btn-primary');
    });

    it('is enabled by default', () => {
        render(<Submit />);

        expect(document.querySelector('input')).not.toBeDisabled();
    });

    it('disables when asked', () => {
        render(<Submit btnDisabled />);

        expect(document.querySelector('input')).toBeDisabled();
    });

    it('calls the click handler', async () => {
        const onClick = jest.fn();
        render(<Submit onClick={onClick} />);

        await userEvent.click(document.querySelector('input'));

        expect(onClick).toHaveBeenCalled();
    });

    it('does not call the handler while disabled', async () => {
        //
        // a disabled input swallows the click, so a form cannot be submitted twice
        // by double-clicking while the first request is in flight.
        //
        const onClick = jest.fn();
        render(<Submit onClick={onClick} btnDisabled />);

        await userEvent.click(document.querySelector('input'));

        expect(onClick).not.toHaveBeenCalled();
    });

    it('warns about a non-boolean disabled prop, but still coerces it', () => {
        //
        // two separate mechanisms, worth separating: propTypes declares btnDisabled
        // as a boolean and warns when it is not, while the render coerces with
        // 'btnDisabled ? true : false' so the DOM never receives a non-boolean.
        //
        // The spy is installed inside the test on purpose. setup.js wraps
        // console.error to fail a test on unexpected output; replacing it here means
        // this EXPECTED warning is asserted rather than treated as a failure.
        //
        const warned = jest.spyOn(console, 'error').mockImplementation(() => {});

        render(<Submit btnDisabled={'yes'} />);

        expect(document.querySelector('input')).toBeDisabled();
        expect(warned.mock.calls.flat().join(' ')).toContain('btnDisabled');

        warned.mockRestore();
    });
});

describe('THROUGHPUT_KEY', () => {
    it('is the namespaced suffix, not a bare word', () => {
        //
            // a report's 'group_by' names the series, so a shared key like
            // 'throughput' would be clobbered when rows from different sources
            // sharing a window_start are merged. The suffix keeps each source's
            // throughput attached to its own series.
        //
        expect(THROUGHPUT_KEY).toBe('__throughput');
    });

    it('starts with a separator, so it appends cleanly to any series name', () => {
        expect(THROUGHPUT_KEY.startsWith('__')).toBe(true);
        expect(`price${THROUGHPUT_KEY}`).toBe('price__throughput');
    });
});

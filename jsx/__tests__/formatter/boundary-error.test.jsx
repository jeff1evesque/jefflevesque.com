/**
 * boundary-error.test.jsx: the error boundary fallback.
 *
 * Rendered by every ErrorBoundary in the app, which is what stands between one
 * broken component and a blank page. Small, but it is the last thing a visitor
 * sees when something has already gone wrong, so it must not throw itself.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import ErrorFallback from '../../import/formatter/boundary-error.jsx';

describe('ErrorFallback', () => {
    it('announces itself to assistive technology', () => {
        //
        // role='alert' is what makes a screen reader speak this without the user
        // having to go looking for it.
        //
        render(<ErrorFallback error={new Error('boom')} />);

        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('says something went wrong in plain words', () => {
        render(<ErrorFallback error={new Error('boom')} />);

        expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    });

    it('shows the error message', () => {
        render(<ErrorFallback error={new Error('a specific failure')} />);

        expect(screen.getByText('a specific failure')).toBeInTheDocument();
    });

    it('renders the message preformatted, so a stack stays readable', () => {
        render(<ErrorFallback error={new Error('line one\nline two')} />);

        expect(document.querySelector('pre')).toBeInTheDocument();
    });

    it('throws when given no error at all', () => {
        //
        // DOCUMENTS A LIMIT: it reads error.message with no guard, so rendering it
        // without an error raises -- inside an error boundary, which is the worst
        // place for a second failure. react-error-boundary always supplies one, so
        // this is unreachable through normal use.
        //
        const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => render(<ErrorFallback />)).toThrow();

        quiet.mockRestore();
    });
});

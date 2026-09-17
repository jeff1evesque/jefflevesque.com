/**
 * api-links.test.jsx: the icons that say where a page's data comes from.
 *
 * The component is small; what it must not get wrong is the pair of destinations and
 * how they open. The request link is only ever the url the page hands it -- the page
 * suites assert that it is the url the page fetched.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import ApiLinks from '../../import/general/api-links.jsx';

const DOCS = 'https://jeff1evesque.github.io/jefflevesque.com/api/performance/';
const REQUEST = 'https://api.jefflevesque.com/v1/public/performance?Stream=bls&Interval=day&Timezone=UTC';

describe('the two links', () => {
    it('links the api docs', () => {
        render(<ApiLinks docs={DOCS} request={REQUEST} />);

        expect(screen.getByRole('link', { name: 'API docs' })).toHaveAttribute('href', DOCS);
    });

    it('links the request, as it was handed in', () => {
        render(<ApiLinks docs={DOCS} request={REQUEST} />);

        expect(screen.getByRole('link', { name: 'This request' })).toHaveAttribute('href', REQUEST);
    });

    it('takes the request as a URL object too, the form the builders return', () => {
        render(<ApiLinks docs={DOCS} request={new URL(REQUEST)} />);

        expect(screen.getByRole('link', { name: 'This request' })).toHaveAttribute('href', REQUEST);
    });

    it('opens both in a new tab, without handing the page to it', () => {
        //
        // a chart someone arranged should survive following a link, and a tab opened
        // with target=_blank gets window.opener unless rel says otherwise.
        //
        render(<ApiLinks docs={DOCS} request={REQUEST} />);

        screen.getAllByRole('link').forEach(link => {
            expect(link).toHaveAttribute('target', '_blank');
            expect(link.getAttribute('rel')).toContain('noopener');
        });
    });

    it('offers only the docs when there is no request to show', () => {
        render(<ApiLinks docs={DOCS} />);

        expect(screen.getAllByRole('link')).toHaveLength(1);
        expect(screen.queryByRole('link', { name: 'This request' })).toBeNull();
    });
});

describe('sizing', () => {
    it('defaults to the medium icon', () => {
        const { container } = render(<ApiLinks docs={DOCS} request={REQUEST} />);

        expect(container.querySelector('.api-links')).toHaveClass('api-links-medium');
    });

    it('matches a large refresh icon when asked', () => {
        //
        // the stylesheet offsets the icons from the refresh icon by its width, so the
        // class has to say which size is in play.
        //
        const { container } = render(<ApiLinks docs={DOCS} request={REQUEST} size='large' />);

        expect(container.querySelector('.api-links')).toHaveClass('api-links-large');
        container.querySelectorAll('svg').forEach(icon => {
            expect(icon).toHaveClass('MuiSvgIcon-fontSizeLarge');
        });
    });
});

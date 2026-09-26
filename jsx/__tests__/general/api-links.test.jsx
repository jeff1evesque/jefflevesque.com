/**
 * api-links.test.jsx: the icons that say where a page's data comes from.
 *
 * The component is small; what it must not get wrong is the pair of destinations and
 * how they open. The request link is only ever the url the page hands it -- the page
 * suites assert that it is the url the page fetched.
 */

import fs from 'fs';
import path from 'path';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

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

describe('a page drawn from more than one request', () => {
    //
    // the Retrieval graph draws a day from its node types and its edge types,
    // asked side by side. Linking one of them would show a reader half of what
    // the graph was drawn from.
    //
    const NODES = 'https://api.jefflevesque.com/v1/public/knowledge-graph/tables/node-types?Day=2026-09-23&Limit=1000';
    const EDGES = 'https://api.jefflevesque.com/v1/public/knowledge-graph/tables/edge-types?Day=2026-09-23&Limit=1000';

    const requests = [
        { url: NODES, label: 'Node types request' },
        { url: new URL(EDGES), label: 'Edge types request' },
    ];

    it('links each request, named for what it asks', () => {
        render(<ApiLinks docs={DOCS} requests={requests} />);

        expect(screen.getByRole('link', { name: 'Node types request' })).toHaveAttribute('href', NODES);
        expect(screen.getByRole('link', { name: 'Edge types request' })).toHaveAttribute('href', EDGES);
    });

    it('still links the docs first, and opens every link in a new tab', () => {
        render(<ApiLinks docs={DOCS} requests={requests} />);

        const links = screen.getAllByRole('link');

        expect(links.map((link) => link.getAttribute('aria-label')))
            .toEqual(['API docs', 'Node types request', 'Edge types request']);
        links.forEach((link) => expect(link).toHaveAttribute('target', '_blank'));
    });

    it('names a single request as it always has', () => {
        //
        // the Training graph hands its one request in this form too, and its
        // icon reads as it did before there was a second page.
        //
        render(<ApiLinks docs={DOCS} requests={[{ url: REQUEST, label: 'This request' }]} />);

        expect(screen.getByRole('link', { name: 'This request' })).toHaveAttribute('href', REQUEST);
    });
});

describe('requests marked apart', () => {
    //
    // the Retrieval graph's two icons were the same braces side by side, told
    // apart only by hovering each one. A mark draws a letter between them.
    //
    const NODES = 'https://api.jefflevesque.com/v1/public/knowledge-graph/tables/node-types?Day=2026-09-23&Limit=1000';
    const EDGES = 'https://api.jefflevesque.com/v1/public/knowledge-graph/tables/edge-types?Day=2026-09-23&Limit=1000';

    const marked = [
        { url: NODES, label: 'Node types request', mark: 'N' },
        { url: EDGES, label: 'Edge types request', mark: 'E' },
    ];

    const icon = (name) => screen.getByRole('link', { name }).querySelector('svg');

    it('draws each request\'s letter inside its braces', () => {
        render(<ApiLinks docs={DOCS} requests={marked} />);

        expect(icon('Node types request')).toHaveAttribute('data-testid', 'DataObjectNIcon');
        expect(icon('Edge types request')).toHaveAttribute('data-testid', 'DataObjectEIcon');
    });

    it('draws the letter as a stroke over the braces, so it waits on no font', () => {
        render(<ApiLinks docs={DOCS} requests={marked} />);

        const svg = icon('Node types request');
        const [braces, letter] = svg.querySelectorAll('path');

        expect(svg.querySelector('text')).toBeNull();
        expect(braces).not.toHaveAttribute('fill');
        expect(letter).toHaveAttribute('fill', 'none');
        expect(letter).toHaveAttribute('stroke', 'currentColor');
    });

    it('draws a different letter for each, so the two differ before either is pointed at', () => {
        render(<ApiLinks docs={DOCS} requests={marked} />);

        const letter = (name) => icon(name).querySelectorAll('path')[1].getAttribute('d');

        expect(letter('Node types request')).not.toBe(letter('Edge types request'));
    });

    it('still says the whole name in the tooltip', async () => {
        render(<ApiLinks docs={DOCS} requests={marked} />);

        fireEvent.mouseOver(screen.getByRole('link', { name: 'Edge types request' }));

        expect(await screen.findByRole('tooltip')).toHaveTextContent('Edge types request');
    });

    it('draws a marked icon at the size asked for', () => {
        render(<ApiLinks docs={DOCS} requests={marked} size='large' />);

        expect(icon('Node types request')).toHaveClass('MuiSvgIcon-fontSizeLarge');
    });

    it('leaves a request with no mark its plain braces', () => {
        render(<ApiLinks docs={DOCS} request={REQUEST} />);

        expect(icon('This request')).toHaveAttribute('data-testid', 'DataObjectIcon');
    });
});

describe('on a dark page', () => {
    //
    // the icons take their color from the chart's refresh icon, which turns
    // '$gray-6' on a dark page. Left at '#555' they are 2.2:1 there, under the
    // 3:1 a control needs.
    //
    const SCSS = path.resolve(__dirname, '../../../scss/_api-links.scss');
    const source = fs.readFileSync(SCSS, 'utf8').replace(/\/\/.*$/gm, '');
    const dark = source.slice(source.indexOf('@include dark'));

    it('takes the refresh icon\'s gray', () => {
        expect(dark).toMatch(/^@include dark\s*\{\s*color\s*:\s*\$gray-6\s*;/);
    });

    it('still darkens toward the text under the pointer', () => {
        expect(dark).toMatch(/&:hover,\s*&:focus-visible\s*\{\s*color\s*:\s*\$gray-9\s*;/);
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

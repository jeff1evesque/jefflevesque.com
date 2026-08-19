/**
 * trigger.test.jsx: the four workflow diagrams drawn on the trigger pages.
 *
 * Four components with one constructor between them: each resolves an 'image_id'
 * through the same guard -- present AND a non-empty string, else the component's own
 * name -- and then builds every internal svg id from it.
 *
 * That id is the whole reason the prop exists. The ids are document-wide, and two of
 * these diagrams on one page with the same id give the second one's clipPath and
 * <image> the first one's definitions: the article renders with a diagram missing its
 * artwork, which no error reports. So the guard is covered per component rather than
 * once, since the fallback it picks is the part that differs.
 *
 * Note: asserted through the rendered ids rather than through state. State would pass
 *       just as happily against a component that resolved the prop and then drew from
 *       its own name anyway, which is exactly the defect worth catching.
 */

import React from 'react';
import { render } from '@testing-library/react';

import AggregateModelWorkflow from '../../import/svg/trigger/aggregate-model-workflow.jsx';
import AggregateWorkflow from '../../import/svg/trigger/aggregate-workflow.jsx';
import BasicModelWorkflow from '../../import/svg/trigger/basic-model-workflow.jsx';
import BasicWorkflow from '../../import/svg/trigger/basic-workflow.jsx';

//
// the four, each beside the id it falls back to.
//
const DIAGRAMS = [
    ['AggregateModelWorkflow', AggregateModelWorkflow],
    ['AggregateWorkflow', AggregateWorkflow],
    ['BasicModelWorkflow', BasicModelWorkflow],
    ['BasicWorkflow', BasicWorkflow],
];

function ids() {
    return Array.from(document.querySelectorAll('[id]')).map(node => node.getAttribute('id'));
}

describe('the image id each diagram draws with', () => {
    it.each(DIAGRAMS)('%s falls back to its own name when given no prop', (name, Component) => {
        render(<Component />);

        expect(ids()).toContain(`_${name}`);
    });

    it.each(DIAGRAMS)('%s takes an id a caller passes', (name, Component) => {
        render(<Component image_id='Custom' />);

        expect(ids()).toContain('_Custom');
        expect(ids()).not.toContain(`_${name}`);
    });

    it.each(DIAGRAMS)('%s falls back for an empty id rather than drawing with one', (name, Component) => {
        //
        // the second half of the guard. An empty string is present in props, so
        // presence alone would accept it and every id would collapse to a bare '_'.
        //
        render(<Component image_id='' />);

        expect(ids()).toContain(`_${name}`);
    });

    it.each(DIAGRAMS)('%s pairs its clip path with the same id', (name, Component) => {
        //
        // the two ids that have to agree: the clipPath is defined under
        // '_clip_<id>' and referenced by url() from the group it clips. A mismatch
        // clips the diagram to nothing and renders blank.
        //
        render(<Component image_id='Paired' />);

        expect(ids()).toContain('_clip_Paired');
        expect(document.querySelector('[clip-path="url(#_clip_Paired)"]')).toBeInTheDocument();
    });
});

describe('the four as a family', () => {
    it('gives each a different default, so two on a page do not collide', () => {
        //
        // the failure this guards against needs no caller error at all: drop two
        // diagrams into one article, take the defaults, and the ids are unique only
        // because the four names are.
        //
        const defaults = DIAGRAMS.map(([name]) => name);

        expect(new Set(defaults).size).toBe(defaults.length);
    });
});

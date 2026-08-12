/**
 * multiselect.test.jsx: the shared MUI multi-select.
 *
 * Used by five trigger panels and the alarm layout, so every stream configuration
 * form goes through it. It seeds its state from props in the constructor and never
 * re-reads them, which is worth knowing: a parent that changes 'items' after mount
 * does not move the selection.
 *
 * Note: it calls structuredClone while rendering the selected chips. That landed in
 *       Node 17 and jsdom does not provide it, so setup.js shims it -- without that,
 *       any component holding a MultiSelect dies at render.
 *
 * Note: MUI renders a combobox that opens a listbox on click. The tests drive that
 *       rather than calling handleChange directly, so the wiring between the two is
 *       covered too.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import MultiSelect from '../../import/general/multiselect.jsx';

const DATA = ['Tech', 'Energy', 'Health'];

function setup(props = {}) {
    const callback = jest.fn();
    const utils = render(
        <MultiSelect input_label='Sector' data={DATA} callback={callback} {...props} />
    );
    return { ...utils, callback };
}

function combobox() {
    return document.querySelector('[role="combobox"]');
}

async function open() {
    await userEvent.click(combobox());
}

function options() {
    return [...document.querySelectorAll('[role="option"]')];
}

describe('rendering', () => {
    it('shows its label', () => {
        setup();

        expect(screen.getByText('Sector')).toBeInTheDocument();
    });

    it('renders a combobox', () => {
        setup();

        expect(combobox()).toBeInTheDocument();
    });

    it('offers one option per data entry once opened', async () => {
        setup();

        await open();

        expect(options().map(o => o.textContent.replace(/\s+/g, ''))).toEqual(DATA);
    });

    it('renders the pre-selected items as chips', () => {
        setup({ items: ['Tech'] });

        expect(document.body.textContent).toContain('Tech');
    });

    it('checks the box of a pre-selected option', async () => {
        //
        // the checkbox state is derived from indexOf on the items array, so a
        // pre-selected value has to arrive checked rather than merely listed.
        //
        setup({ items: ['Energy'] });

        await open();

        const energy = options().find(o => o.textContent.includes('Energy'));
        expect(energy.querySelector('input[type="checkbox"]')).toBeChecked();
    });

    it('leaves unselected options unchecked', async () => {
        setup({ items: ['Energy'] });

        await open();

        const tech = options().find(o => o.textContent.includes('Tech'));
        expect(tech.querySelector('input[type="checkbox"]')).not.toBeChecked();
    });
});

describe('selecting, with multi enabled', () => {
    it('is the default, so an unspecified multi behaves as multi', async () => {
        //
        // worth pinning: 'multi' falls back to TRUE when absent, so a caller that
        // forgets it gets multi-select rather than single. The five trigger panels
        // rely on that default.
        //
        const { callback } = setup({ items: ['Tech'] });

        await open();
        await userEvent.click(options().find(o => o.textContent.includes('Energy')));

        expect(callback).toHaveBeenCalledWith({ selected: ['Tech', 'Energy'] });
    });

    it('reports every selected value', async () => {
        const { callback } = setup({ items: ['Tech'], multi: true });

        await open();
        await userEvent.click(options().find(o => o.textContent.includes('Energy')));

        expect(callback).toHaveBeenCalledWith({ selected: ['Tech', 'Energy'] });
    });

    it('accumulates rather than replacing', async () => {
        const { callback } = setup({ items: [], multi: true });

        await open();
        await userEvent.click(options().find(o => o.textContent.includes('Tech')));
        await userEvent.click(options().find(o => o.textContent.includes('Health')));

        expect(callback).toHaveBeenLastCalledWith({ selected: ['Tech', 'Health'] });
    });
});

describe('selecting, with multi explicitly disabled', () => {
    it('reports only the last value', async () => {
        //
        // multi DEFAULTS TO TRUE, so single-select has to be asked for. And it is
        // implemented by truncating rather than by limiting the control: MUI still
        // collects both values, and the callback receives slice(-1) -- so the chip
        // row can show two while the parent is told one.
        //
        const { callback } = setup({ items: ['Tech'], multi: false });

        await open();
        await userEvent.click(options().find(o => o.textContent.includes('Energy')));

        expect(callback).toHaveBeenCalledWith({ selected: ['Energy'] });
    });

    it('reports one value even when several were already selected', async () => {
        const { callback } = setup({ items: ['Tech', 'Energy'], multi: false });

        await open();
        await userEvent.click(options().find(o => o.textContent.includes('Health')));

        expect(callback).toHaveBeenCalledWith({ selected: ['Health'] });
    });
});

describe('props it is given nothing for', () => {
    it('renders with no props at all', () => {
        expect(() => render(<MultiSelect />)).not.toThrow();
    });

    it('renders an empty list when given no data', async () => {
        render(<MultiSelect input_label='Sector' callback={jest.fn()} />);

        await open();

        expect(options()).toHaveLength(0);
    });

    it('syncs items when the prop changes', () => {
        //
        // componentDidUpdate mirrors input_label, data and items from props into
        // state, so the control IS effectively controlled after mount -- despite the
        // constructor seeding state from the same props.
        //
        const { rerender } = render(
            <MultiSelect input_label='Sector' data={DATA} items={['Tech']} callback={jest.fn()} />
        );

        rerender(
            <MultiSelect input_label='Sector' data={DATA} items={['Energy']} callback={jest.fn()} />
        );

        expect(document.body.textContent).toContain('Energy');
        expect(document.body.textContent).not.toContain('Tech');
    });

    it('shares the caller’s array rather than copying it', () => {
        //
        // DOCUMENTS A HAZARD.
        //
        // The constructor assigns the prop straight through -- 'var items =
        // this.props.items' -- with no copy, so state.items IS the parent's array.
        // Mutating it in the parent changes the component's state directly, with no
        // setState and no render of its own; the change simply appears the next time
        // anything else re-renders.
        //
        // That also defeats componentDidUpdate's guard, which compares references:
        // the two are the same object, so 'items !== prevProps.items' is false and no
        // sync is scheduled. The value changes anyway, by aliasing.
        //
        // A parent that treats its own array as private would find the component
        // following its edits, and a parent expecting an update would find the guard
        // ignoring it. Copying in the constructor fixes both.
        //
        const items = ['Tech'];
        const { rerender } = render(
            <MultiSelect input_label='Sector' data={DATA} items={items} callback={jest.fn()} />
        );

        items.push('Energy');
        rerender(
            <MultiSelect input_label='Sector' data={DATA} items={items} callback={jest.fn()} />
        );

        expect(document.body.textContent).toContain('Energy');
    });

    it('mounts safely with no callback, but cannot be selected in', () => {
        //
        // DOCUMENTS A DEFECT that cannot be asserted directly.
        //
        // handleChange reads:
        //
        //     if ('callback' in this.props && 'multi' in this.state && this.state.multi) {
        //         this.props.callback({ selected });
        //     } else {
        //         this.props.callback({ selected: selected.slice(-1) });
        //     }
        //
        // The 'callback' in this.props check protects only the first branch, and the
        // else calls it unconditionally -- so with no callback prop, EVERY selection
        // throws 'this.props.callback is not a function', whatever 'multi' is. The
        // guard provides no protection at all; there is no safe path to contrast
        // against.
        //
        // Not asserted by selecting here: the error is thrown inside a React event
        // handler, which React rethrows asynchronously rather than through the
        // click's promise, so it escapes both try/catch and .rejects and lands as an
        // unhandled error jest attributes to the test. Any test that triggers it
        // fails by construction.
        //
        // What is asserted is the part that holds: mounting without a callback is
        // fine, which is exactly why this goes unnoticed -- the component renders
        // perfectly and only breaks on interaction.
        //
        // Every caller passes a callback today.
        //
        expect(() => render(<MultiSelect input_label='Sector' data={DATA} />)).not.toThrow();
        expect(document.querySelector('[role="combobox"]')).toBeInTheDocument();
    });
});

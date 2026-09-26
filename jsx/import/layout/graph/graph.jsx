/**
 * graph.jsx: browse the published knowledge graph, as two pages.
 *
 * The front page draws one graph -- the default build -- as a backdrop, and is
 * deliberately not readable up close. These pages are the other half: pick one,
 * see what is in it, and read the thing properly.
 *
 *     /graph              the Training graph: a published PyG build, from its
 *                         schema -- the graph a graph neural network trains on
 *     /graph/retrieval    the Retrieval graph: one day of the published query
 *                         tables -- the graph an LLM's retrieval step reads
 *
 * One layout draws both. Which graph it is -- what the picker offers, how one is
 * loaded, what the details panel says about it, the words the page uses -- is a
 * SOURCE handed in, and see source.js for the two. Everything below reads the
 * document a source loads as a build's schema, so a day of the tables, put in
 * that shape, is drawn by the same code: the filter, the legend, the canvas and
 * the tables. A "build" in the notes that follow is whichever of the two is
 * being drawn.
 *
 * Laid out in three columns on a wide screen -- what the build is, the graph,
 * and how to read its colors -- so all three are in view together. On a narrow
 * one they stack, and the title leads.
 *
 * Both reference columns FOLD, at either width, and what they give up goes to
 * the graph. The grid's side tracks are sized to their contents, so a folded
 * column widens the canvas rather than leaving a gap, and the graph is laid out
 * again for the box it now has.
 *
 * They start open where there is room for all three at once and closed where
 * there is not -- a phone that opened on a page-long list of metadata showed
 * the graph, the reason for the page, only after a long scroll -- and after the
 * first visit they start however the reader last left them. See save.
 *
 * All three of the page's boundaries are controls, and they are one control
 * facing three ways: an arrow that folds what is on the far side of it, and a
 * strip that drags it smaller. The two beside the canvas narrow a reference
 * column; the one above the tables shortens the canvas, and folds the whole
 * three-column row when it is pushed past the point where the columns beside it
 * are already the taller thing. A column goes narrower only -- the width the
 * stylesheet gives it is the width its contents were designed against, so there
 * is nothing a wider one would show that it is not showing already. The canvas
 * goes a little taller as well; see CANVAS_BEYOND.
 *
 * Note: this draws the same slice the front page's backdrop does, out of the
 *       same build. The two used to differ -- 60 here against 24 there -- on
 *       the recorded grounds that the selection fell apart at the smaller size.
 *       Measured against the published build it does not, and the backdrop was
 *       quietly showing a third fewer namespaces than the palette assigns. See
 *       GRAPH_NODE_TYPES in filter-schema.js.
 *
 * Note: a failed load clears the graph rather than leaving the previous one on
 *       screen. A stale graph beside a fresh label is indistinguishable from a
 *       correct one, which is the worst outcome available here -- worse than an
 *       error, and much worse than an empty panel.
 *
 * Note: while it WAITS the page draws itself empty rather than drawing nothing.
 *       Every piece of it -- the picker, both columns, the canvas, the tables
 *       and their controls -- is on screen at its own size from the first
 *       paint, holding a placeholder, and the data fills those in. See
 *       pending.jsx, and note that the page arrives in two pieces: the listing
 *       answers the picker and all of the build panel but its Sources row, and
 *       only that row, the legend, the canvas and the tables are waiting on the
 *       schema behind it.
 */

import React, { Component } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ErrorFallback from '../../formatter/boundary-error.jsx';
import GraphExplorer from '../../animation/graph-explorer.jsx';
import { API_DOCS } from '../../general/api-url.js';
import ApiLinks from '../../general/api-links.jsx';
import { readLayout, writeLayout } from '../../general/layout-preference.js';
import { ThemeModeContext } from '../../general/theme-mode.jsx';
import filterSchema, { GRAPH_NODE_TYPES } from '../../animation/filter-schema.js';
import GraphTables from './tables.jsx';
import { BUILDS, DAYS } from './source.js';
import {
    PendingCanvas,
    PendingCaption,
    PendingDetail,
    PendingDetails,
    PendingLegend,
    PendingPicker,
} from './pending.jsx';
import {
    sourceNamespace,
    buildPalette,
    rankNamespaces,
    ORIGIN_DASH,
    originColor,
    originName,
} from '../../animation/encoding.js';

//
// what each origin means, for the legend. The styling itself lives in
// encoding.js -- this is only the wording.
//
// Note: keyed by the origin's value in the schema, not by the name the legend
//       prints over it -- 'unification' is printed as 'owl:sameAs'. See
//       originName in encoding.js.
//
const ORIGIN_LABEL = {
    raw: 'as published by the source',
    enrichment: 'derived during the build',
    unification: 'the two nodes are the same',
};

//
// the two panels that close on a narrow screen. Both start closed there, so a
// phone opens on the graph; a wide screen ignores this and shows both.
//
const PANELS_START = { build: false, legend: false, row: true };

//
// Note: what the page is called in the preference store, which keeps more than
//       one surface's arrangement under a single key, is its source's `surface`.
//       Each graph is arranged apart: a column folded on one stays open on the
//       other, which is a different page with a different panel in it.
//

//
// where the layout becomes three columns, in pixels, mirroring '$graph-columns'
// in '_graph.scss'.
//
// Duplicated rather than shared because the two languages cannot read one
// another's constants, and the alternative -- measuring the rendered layout to
// find out which one is in force -- reads the answer back out of the thing it is
// meant to decide. The pair is small enough to keep in step by hand; what it
// decides is only which panels START open.
//
const PANELS_WIDE = 992;

//
// dragging the divider between a reference column and the graph.
//
// RAIL_MIN is the narrowest a column may be dragged to, in px against a 16px
// root -- 11rem, which still holds the longest namespace the published builds
// carry beside its swatch, and a 'Sources' value on two lines rather than four.
// RAIL_FOLD is how far PAST that the pointer has to go before the column folds
// away instead of resisting: a boundary that gives way the instant it is reached
// folds the column whenever someone overshoots by a pixel.
//
// Note: px rather than rem because the pointer speaks px, and the conversion
//       would need the root font size read back out of the document on every
//       move to save writing one number down.
//
const RAIL_MIN = 176;
const RAIL_FOLD = 40;

//
// how much taller than it opens at the canvas may be dragged, in px.
//
// Every other drag here only makes a box smaller, and for a column that is
// still the rule. The canvas's height is not what its contents were designed
// against: the graph is laid out again for whatever box it has, so a taller one
// is more room between the same nodes. A little more, because the stylesheet
// sizes the canvas to leave the tables below it peeking 10rem above the fold,
// and 30px of that is a nudge rather than a different layout.
//
const CANVAS_BEYOND = 30;

//
// what each of the three dividers does, since they differ only in which way
// they face and what gives way when they are pushed past their floor.
//
//   box       what the drag resizes, inside this page's own root. Looked up
//             there rather than from the strip that was grabbed, because the
//             horizontal one sits above the TABLES and so is not inside the
//             canvas it resizes
//   property  the custom property that carries the dragged size, whose FALLBACK
//             in '_graph.scss' is the default -- so the stylesheet keeps the
//             number and this only ever overrides it
//   axis      which coordinate the pointer is read on
//   grow      the direction of that axis that makes the box BIGGER. The two
//             columns face opposite ways: the build column's rule is on its
//             right, the legend's on its left
//   floor     a method naming the smallest the box may be dragged to, or absent
//             for the columns, which share RAIL_MIN
//   beyond    how far past the size the stylesheet gives it the box may be
//             dragged, in px, or absent for not at all -- which is every box
//             but the canvas. See CANVAS_BEYOND
//   folds     what closes when the pointer goes past that floor. A column folds
//             itself; the canvas folds the whole three-column row, because a
//             canvas alone between two reference columns is not a layout
//
const DRAG = {
    build: {
        box: '.graph-panel-build',
        property: '--graph-panel-width',
        axis: 'x',
        grow: 1,
        folds: 'build',
    },
    legend: {
        box: '.graph-panel-legend',
        property: '--graph-panel-width',
        axis: 'x',
        grow: -1,
        folds: 'legend',
    },
    canvas: {
        box: '.graph-canvas',
        property: '--graph-canvas-height',
        axis: 'y',
        grow: 1,
        floor: 'canvasFloor',
        beyond: CANVAS_BEYOND,
        folds: 'row',
    },
};

//
// whether a set of legend marks already holds this one. Two marks are the same
// mark when they name the same thing in the same channel -- 'raw' the edge
// origin is not 'raw' the namespace, and a build carrying both would otherwise
// have one entry toggling the other.
//
function holds(marks, mark) {
    return marks.some((m) => m.kind === mark.kind && m.value === mark.value);
}

//
// the menu the picker opens: under the control, aligned with it, and bounded.
//
// Bounded is the point. A native <select> hands its options to the operating
// system, which on a phone draws them as a sheet the page has no say over --
// however many builds the listing holds, at whatever size the platform likes.
// This menu is a popover of this page's own, so a listing longer than the
// screen scrolls inside it rather than becoming the screen.
//
// Note: 48px is a mui menu row. Eight of them is a menu that is clearly a menu
//       rather than a page, and still shows more builds at once than the
//       listing has carried so far.
//
const PICKER_MENU = {
    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
    transformOrigin: { vertical: 'top', horizontal: 'left' },
    PaperProps: { className: 'graph-picker-menu', style: { maxHeight: 48 * 8 } },
};

class GraphLayout extends Component {
    //
    // the page's theme, which the palette's tail is shaded for and the canvas's
    // neutrals follow. See theme-mode.jsx.
    //
    static contextType = ThemeModeContext;

    constructor() {
        super();

        this.state = {
            // what the picker offers: the source's { default, choices } -- the
            // published builds, or the published days. See list() in source.js
            listing: null,
            selected: null,
            schema: null,
            // the WHOLE build, beside the slice above. The tables read every node
            // and edge type from here; it used to be measured for the caption and
            // then discarded on the same line.
            build: null,
            loading: true,
            failed: false,
            open: PANELS_START,
            //
            // a box the reader has made smaller by dragging its divider, in px,
            // or null for whatever the stylesheet gives it. See startDrag.
            //
            size: { build: null, legend: null, canvas: null },
            //
            // the height both reference columns are held at, which is the
            // taller one's. See measureColumns.
            //
            columns: 0,
            //
            // what the LEGEND is asking the canvas to emphasize: the entry
            // under the pointer, and the entry a click pinned. Hovering wins
            // while it lasts, so pointing at one entry previews it and moving
            // off returns to the pinned one -- the same rule the canvas follows
            // for a node, and for the same reason.
            //
            hovered: null,
            marked: [],
            // the picker's menu is controlled so a page scroll can close it --
            // see openPicker
            picker_open: false,
        };

        this.openPicker = this.openPicker.bind(this);
        this.closePicker = this.closePicker.bind(this);
        this.select = this.select.bind(this);
        this.navigateTo = this.navigateTo.bind(this);
        this.requested = this.requested.bind(this);
        this.selectedChoice = this.selectedChoice.bind(this);
        this.onScreen = this.onScreen.bind(this);
        this.toggle = this.toggle.bind(this);
        this.panel = this.panel.bind(this);
        this.rail = this.rail.bind(this);
        this.divider = this.divider.bind(this);
        this.startDrag = this.startDrag.bind(this);
        this.onDrag = this.onDrag.bind(this);
        this.endDrag = this.endDrag.bind(this);
        this.releaseDrag = this.releaseDrag.bind(this);
        this.save = this.save.bind(this);
        this.restoreSizes = this.restoreSizes.bind(this);
        this.settle = this.settle.bind(this);
        this.watchColumns = this.watchColumns.bind(this);
        this.measureColumns = this.measureColumns.bind(this);
        this.emphasis = this.emphasis.bind(this);
        this.entry = this.entry.bind(this);
        this.markHover = this.markHover.bind(this);
        this.markPin = this.markPin.bind(this);
        this.clearMarks = this.clearMarks.bind(this);
        this.legend = this.legend.bind(this);
        this.details = this.details.bind(this);
        this.pending = this.pending.bind(this);
        this.picker = this.picker.bind(this);
        this.caption = this.caption.bind(this);

        // the page's own root, so everything measured here is measured inside
        // THIS layout rather than inside whatever else the document holds
        this.layout = React.createRef();
    }

    componentDidMount() {
        {/*

            both panels start open on a wide screen and closed on a narrow one,
            which is one piece of state answering to two different defaults.

            The narrow default is the deliberate one: a phone that opened on a
            page-long list of metadata showed the graph, the reason for the page,
            only after a long scroll. A wide screen has room for all three
            columns at once and should show them.

            Note: read once, at mount, and not watched afterwards. A media query
                  listener would reopen a panel the reader had just closed
                  whenever the window crossed the breakpoint, which is the
                  window disagreeing with the person about their own choice.

            Note: guarded. jsdom does not implement matchMedia, so under test
                  this falls through to the closed default -- which is the state
                  the panel suite is written against.

        */}

        const wide = typeof window.matchMedia === 'function'
            && window.matchMedia(`(min-width: ${PANELS_WIDE}px)`).matches;
        const stored = readLayout(this.props.source.surface, wide ? 'wide' : 'narrow');

        this.variant = wide ? 'wide' : 'narrow';

        {/*

            what the reader last arranged, where they arranged anything, and the
            breakpoint's default where they did not. 'in' rather than a
            truthiness test, because a stored `false` is an answer.

        */}

        const open = {
            build: 'build' in stored.fold ? !stored.fold.build : wide,
            legend: 'legend' in stored.fold ? !stored.fold.legend : wide,
            row: 'row' in stored.fold ? !stored.fold.row : true,
        };

        {/*

            sizes land in a SECOND pass, once there is something to measure.
            Each one is checked against what its box would be without it, and
            there are no boxes yet: the panels are drawn from the build, which
            has not been asked for at this point, let alone arrived. A box
            measured while it is still folded reports the width of its rail, so
            the folds above have to be settled first as well. See settle.

            Note: a size stored for a box that comes back FOLDED is dropped. It
                  cannot be checked against this screen while the box is closed,
                  and a column reopens at the width the layout designed for it,
                  which is never wrong.

        */}

        this.stored = stored.size;
        this.setState({ open: open });

        this.props.source.list().then((listing) => {
            if (!listing) {
                this.setState({ listing: null, loading: false, failed: true });
                return;
            }

            this.setState({ listing: listing });
            this.select(this.requested(listing));
        });
    }

    componentWillUnmount() {
        window.removeEventListener('scroll', this.closePicker);
        this.endDrag();

        if (this.columnObserver) {
            this.columnObserver.disconnect();
        }
    }

    /**
     * the picker's menu closes when the PAGE scrolls under it.
     *
     * mui renders the menu into a portal positioned against the viewport, and
     * relies on the modal behind it locking body scroll to keep the page still
     * while it is open. That lock is `overflow: hidden` on the body, which iOS
     * Safari does not honor for touch scrolling -- so on a phone the page slid
     * away underneath a menu that stayed nailed to the screen, leaving the
     * options floating with no visible relationship to the control they came
     * from.
     *
     * Closing is the right answer rather than repositioning: the menu has its
     * own scroll for a listing longer than itself (see PICKER_MENU), so nobody
     * scrolls the PAGE while choosing a build on purpose.
     *
     * Note: the listener is on window, which only hears the document scroll.
     *       'scroll' does not bubble from an element, so scrolling the menu's
     *       own option list does not reach this and does not close it.
     *
     * Note: on a desktop browser the lock works, no scroll event is fired, and
     *       this changes nothing.
     */
    openPicker() {
        window.addEventListener('scroll', this.closePicker, { passive: true });
        this.setState({ picker_open: true });
    }

    closePicker() {
        window.removeEventListener('scroll', this.closePicker);
        this.setState({ picker_open: false });
    }

    /**
     * the build the address asks for, when the listing holds it.
     *
     * Note: an id the listing does not hold falls back to the default rather
     *       than 404ing. The listing is what decides which builds exist, and a
     *       link to a build that has since rolled off is an ordinary thing to
     *       find in someone's bookmarks -- the page still has something true to
     *       draw, and the picker shows what it drew instead. A day the tables no
     *       longer list falls back to the newest the same way, for the same
     *       reason.
     */
    requested(listing) {
        const requested = this.props.params[this.props.source.param];

        if (requested && listing.choices.some((choice) => choice.id === requested)) {
            return requested;
        }

        return listing.default || listing.choices[0].id;
    }

    /**
     * a build chosen in the picker becomes the address, so the selection can be
     * linked to and the back button moves between builds.
     *
     * Note: componentDidUpdate does the selecting, off the address, rather than
     *       this navigating AND selecting. Two entry points writing 'selected'
     *       -- the picker and the back button -- is how they get to disagree.
     */
    navigateTo(id) {
        this.props.navigate(this.props.source.path(id));
    }

    componentDidUpdate(previous) {
        const param = this.props.source.param;
        const before = previous.params[param];
        const now = this.props.params[param];
        const { listing } = this.state;

        if (before !== now && listing) {
            const wanted = this.requested(listing);

            if (wanted !== this.state.selected) {
                this.select(wanted);
            }
        }
    }

    /**
     * Note: the graph is cleared BEFORE the fetch, not after it resolves. The
     *       alternative leaves the previous build on screen under the new
     *       build's label for as long as the request takes, which reads as a
     *       correct answer and is not one.
     */
    select(id) {
        //
        // the legend's marks go with the build. They name a namespace or an
        // origin out of the build being left, and the next one need not carry
        // either -- an emphasis on something the new legend does not list is a
        // canvas dimmed against nothing.
        //
        this.setState({
            selected: id,
            schema: null,
            build: null,
            loading: true,
            failed: false,
            hovered: null,
            marked: [],
        });

        return this.props.source.load(id).then((schema) => {
            //
            // the slice is chosen by what the source weighs a type by: its
            // nodes for a build, its findable entities for a day. See source.js
            //
            const filtered = filterSchema(schema, GRAPH_NODE_TYPES, this.props.source.weight);

            this.setState({
                schema: filtered,
                build: filtered ? schema : null,
                loading: false,
                failed: !filtered,
            }, this.settle);
        });
    }

    selectedChoice() {
        const { listing, selected } = this.state;

        if (!listing || !selected) {
            return null;
        }

        return listing.choices.find((choice) => choice.id === selected) || null;
    }

    //
    // the namespaces and origins actually ON SCREEN, not a fixed list. A
    // hardcoded legend drifts the moment a build carries a namespace nobody
    // anticipated, and then it is describing a graph that is not there.
    //
    onScreen() {
        const { schema } = this.state;

        if (!schema) {
            return null;
        }

        //
        // memoised on the schema OBJECT, which only changes when a build is
        // selected, and on the theme, which changes the palette's shaded tail.
        // Recomputed per render it would hand the tables below a fresh color
        // Map every time, and a table that caches its rows against that Map
        // would rebuild all 976 of them on every keystroke in its filter box.
        //
        const theme = this.context.theme;

        if (this.screenFor === schema && this.screenTheme === theme) {
            return this.screen;
        }

        const nodes = Object.keys(schema.node_types).map((id) => ({
            id: id,
            namespace: sourceNamespace(schema.node_types[id], id),
        }));

        //
        // the namespaces LISTED are the ones on screen, from the slice; the
        // colors they are listed in come from the whole build, so this legend
        // describes the front page's backdrop as well as this page's canvas.
        // See buildPalette -- the two used to rank separately and disagree.
        //
        // Note: every namespace in `namespaces` is in `painted`. Both are taken
        //       over the same slice -- buildPalette filters the build at
        //       the shared budget, which is what `schema` already is -- so a
        //       swatch can never come back undefined here.
        //
        this.screenFor = schema;
        this.screenTheme = theme;
        this.screen = {
            namespaces: rankNamespaces(nodes),
            painted: buildPalette(this.state.build, GRAPH_NODE_TYPES, this.props.source.weight, theme),
            origins: [...new Set(
                Object.values(schema.edge_types).map((e) => e.origin).filter(Boolean)
            )].sort(),
        };

        return this.screen;
    }

    toggle(key) {
        this.setState(
            (state) => ({ open: { ...state.open, [key]: !state.open[key] } }),
            this.save
        );
    }

    /**
     * the boundary between a reference column and the graph, as a control.
     *
     * Two things sit on the rule, because a boundary can do two things and they
     * want different affordances. An arrow pointing OUTWARD folds the column --
     * outward is the way its edge travels when it closes, which is also the way
     * the folded rail's own chevron then points back. And the strip the arrow
     * sits on drags, to narrow the column without folding it.
     *
     * Note: the strip is aria-hidden and the arrow is not. The arrow is a
     *       button with a name, and the heading above it toggles the same
     *       column, so folding is on the keyboard path twice over; dragging is
     *       a pointer affordance for choosing a width, and a width is a
     *       preference rather than information. Marking the strip hidden is
     *       what keeps a draggable div out of the tab order and off the
     *       accessibility tree, instead of announcing a control that would do
     *       nothing when it was reached.
     *
     * Note: rendered only while the column is open, and shown only by the wide
     *       stylesheet. Below the breakpoint the columns are stacked bands with
     *       no vertical rule to put either one on.
     */
    rail(key, title) {
        return this.divider(
            key,
            `Collapse ${title.toLowerCase()}`,
            key === 'build' ? ChevronLeftIcon : ChevronRightIcon,
            'graph-panel'
        );
    }

    /**
     * the same control for any of the three dividers, which differ only in
     * which way they face.
     *
     * `scope` is the class prefix its two parts wear, so the stylesheet can
     * place a vertical rule's controls down the side of a column and a
     * horizontal one's across the top of the tables without either knowing
     * about the other. Everything else -- what the arrow means, what the strip
     * does, what each is called to assistive technology -- is one behavior.
     */
    divider(key, label, Arrow, scope) {
        return (
            <React.Fragment>
                <div
                    className={`graph-grip ${scope}-grip`}
                    aria-hidden='true'
                    onPointerDown={(event) => this.startDrag(key, event)}
                />
                <button
                    type='button'
                    className={`graph-fold ${scope}-fold`}
                    aria-label={label}
                    onClick={() => this.toggle(DRAG[key].folds)}
                >
                    <Arrow fontSize='inherit' />
                </button>
            </React.Fragment>
        );
    }

    /**
     * the shortest the canvas may be dragged.
     *
     * The taller reference column, because that is where the drag stops having
     * an effect: below it the ROW's height is the column's rather than the
     * canvas's, so the rule would not move however far the pointer went, and a
     * boundary that does not follow the pointer reads as broken.
     *
     * That number is only a single number because both columns are matched to
     * each other -- see measureColumns. When there is no column to measure,
     * because both are folded or no build has loaded, the canvas's own
     * `min-height` answers instead.
     *
     * Note: read off the element rather than written down here, the same as the
     *       columns' ceiling and for the same reason: '_graph.scss' owns that
     *       floor and would have to be kept in step with a copy.
     */
    canvasFloor(canvas) {
        const declared = parseFloat(window.getComputedStyle(canvas).minHeight);

        return Math.max(this.columnHeight || 0, Number.isFinite(declared) ? declared : 0);
    }

    /**
     * dragging a divider narrows its column, and folds it once it is dragged
     * well past the point where the contents stop fitting.
     *
     * NARROWER only, which is the whole shape of this. The width the stylesheet
     * gives a column is the width its contents were designed against -- the
     * legend's namespace grid runs two abreast at 18rem and one below that --
     * so there is nothing a wider column would show that it is not showing
     * already, and the space it would take is the graph, which is the page.
     * The canvas is the one box that goes past the size it opens at, by its
     * `beyond` -- see CANVAS_BEYOND.
     *
     * Note: the ceiling is read back off the element with the inline width
     *       taken off, rather than written down here. '_graph.scss' clamps that
     *       width against the viewport, so a copy in this file would be both a
     *       second number to keep in step and the wrong one at most window
     *       sizes. The canvas's allowance goes on top of what is read.
     *
     * Note: the move and release listeners go on the window rather than on the
     *       strip. A pointer dragging a 14px target leaves it constantly, and a
     *       drag that stops the moment the pointer is off the rule is a drag
     *       that cannot reach the width it is being dragged to.
     *
     * Note: one set of handlers for all three dividers. They differ in which
     *       axis they read, which way is bigger, what their floor is and what
     *       folds when they pass it -- and in nothing else, which is why DRAG
     *       is a table rather than three copies of this.
     */
    startDrag(key, event) {
        if (event.button !== 0) {
            return;
        }

        const rules = DRAG[key];
        const box = this.layout.current.querySelector(rules.box);
        const measure = () => (rules.axis === 'x' ? box.offsetWidth : box.offsetHeight);
        const start = measure();
        const inline = box.style.getPropertyValue(rules.property);

        box.style.removeProperty(rules.property);
        const ceiling = measure() + (rules.beyond || 0);

        if (inline) {
            box.style.setProperty(rules.property, inline);
        }

        this.drag = {
            key: key,
            folds: rules.folds,
            grow: rules.grow,
            from: rules.axis === 'x' ? event.clientX : event.clientY,
            at: rules.axis === 'x' ? 'clientX' : 'clientY',
            start: start,
            ceiling: ceiling,
            floor: rules.floor ? this[rules.floor](box) : RAIL_MIN,
        };

        window.addEventListener('pointermove', this.onDrag);
        window.addEventListener('pointerup', this.releaseDrag);
        event.preventDefault();
    }

    //
    // Note: no guard on `this.drag`. endDrag takes this listener off the window
    //       before it clears the drag, and both of the things that end a drag --
    //       the pointer coming up, and the component going away -- go through
    //       it, so there is no path that reaches here without one.
    //
    onDrag(event) {
        const { key, folds, grow, from, at, start, ceiling, floor } = this.drag;
        const wanted = start + (event[at] - from) * grow;

        if (wanted < floor - RAIL_FOLD) {
            this.endDrag();

            //
            // folded by the drag, and back at its designed size when it is
            // opened again. The size it folded at is the smallest the drag
            // would go, which is not a size anybody chose.
            //
            this.setState(
                (state) => ({
                    open: { ...state.open, [folds]: false },
                    size: { ...state.size, [key]: null },
                }),
                this.save
            );

            return;
        }

        this.setState((state) => ({
            size: {
                ...state.size,
                [key]: Math.min(Math.max(wanted, floor), ceiling),
            },
        }));
    }

    endDrag() {
        window.removeEventListener('pointermove', this.onDrag);
        window.removeEventListener('pointerup', this.releaseDrag);
        this.drag = null;
    }

    //
    // the pointer coming up is the reader settling on a size, which is the
    // moment worth keeping. Every move in between is not: a drag is a hundred
    // pointer events, and localStorage is synchronous.
    //
    releaseDrag() {
        this.endDrag();
        this.save();
    }

    /**
     * keep how the page is arranged, for the next visit.
     *
     * Note: per BREAKPOINT. A reader folds both columns on a phone because a
     *       phone has room for one thing, and restoring that on a wide monitor
     *       is the stored preference disagreeing with the person -- the same
     *       disagreement the matchMedia note in componentDidMount is about,
     *       arriving a week later instead of on a window drag.
     *
     * Note: folds rather than opens, because that is what the store calls them
     *       and a boolean that means the opposite of its name in one of two
     *       files is a bug waiting for whoever reads the other one.
     */
    save() {
        const { open, size } = this.state;

        writeLayout(this.props.source.surface, this.variant, {
            fold: { build: !open.build, legend: !open.legend, row: !open.row },
            size: size,
        });
    }

    /**
     * a stored size, against what this screen can actually give the box.
     *
     * Returns null -- meaning 'whatever the stylesheet says' -- rather than a
     * number, wherever the stored one cannot be honored: it is bigger than the
     * box's own default, so honoring it would make a column wider than the
     * layout ever intended; or it is below the floor a drag would have stopped
     * at, in which case it came from a screen this is not. The default itself
     * comes back as null too, being what the stylesheet says already.
     *
     * `beyond` is how far past its default the box may go, which is nothing for
     * a column and CANVAS_BEYOND for the canvas: a height dragged up to that is
     * one this screen gives, and past it is one from a taller window.
     *
     * Note: a size under the floor is DROPPED and not folded. Folding somebody's
     *       column on page load, because of a number left over from another
     *       screen, is a page that opens broken to explain a preference.
     */
    restoreSize(stored, natural, floor, beyond) {
        if (!Number.isFinite(stored) || stored < floor || stored === natural || stored > natural + beyond) {
            return null;
        }

        return stored;
    }

    //
    // every stored size, measured against the box it belongs to as this screen
    // would draw it. See the note in componentDidMount for why this runs after
    // the folds and not with them.
    //
    restoreSizes(stored) {
        const root = this.layout.current;

        if (!root) {
            return;
        }

        const size = { build: null, legend: null, canvas: null };

        Object.keys(DRAG).forEach((key) => {
            const rules = DRAG[key];
            const box = root.querySelector(rules.box);

            if (!box || (key !== 'canvas' && !box.classList.contains('graph-panel-open'))) {
                return;
            }

            size[key] = this.restoreSize(
                stored[key],
                rules.axis === 'x' ? box.offsetWidth : box.offsetHeight,
                rules.floor ? this[rules.floor](box) : RAIL_MIN,
                rules.beyond || 0
            );
        });

        this.setState({ size: size });
    }

    /**
     * what can only be done once the panels are on screen.
     *
     * Both of these need boxes to measure, and there are none until a build has
     * loaded -- the panels are drawn from it. This runs whenever one arrives,
     * because a build that fails takes the panels away again and the next one
     * brings back different elements.
     *
     * Note: the sizes are restored ONCE. They are what the reader arranged on
     *       their last visit, and re-applying them when they pick another build
     *       would undo whatever they have dragged since.
     */
    settle() {
        this.watchColumns();

        if (!this.restored) {
            this.restored = true;
            this.restoreSizes(this.stored);
        }
    }

    /**
     * watch both columns' headings and bodies, so the heights stay matched
     * without anything having to remember to re-measure.
     *
     * A column changes height when the build changes, when it is dragged
     * narrower -- the namespace grid drops from two abreast to one below 18rem,
     * which roughly doubles the legend -- when either column folds, and on a
     * window resize. One observer answers all four the same way; four callers
     * remembering to recalculate answers three of them until somebody adds a
     * fifth.
     *
     * Note: the headings are watched as well as the bodies, because a column's
     *       height takes in its heading -- see measureColumns. A heading that
     *       wraps moves the body below it down without resizing it, and a box
     *       that moves is not one a ResizeObserver reports.
     *
     * Note: the same pattern the canvas uses in graph-explorer.jsx, and guarded
     *       the same way. Without ResizeObserver the columns are simply not
     *       matched, which is how the page looked before this.
     */
    watchColumns() {
        if (typeof ResizeObserver !== 'function' || !this.layout.current) {
            return;
        }

        //
        // called again whenever the panels are rebuilt, because there are none
        // to watch until a build has loaded -- and none again if one fails.
        //
        if (this.columnObserver) {
            this.columnObserver.disconnect();
        }

        this.columnObserver = new ResizeObserver(this.measureColumns);
        this.layout.current.querySelectorAll('.graph-panel-heading, .graph-panel-body').forEach((box) => {
            this.columnObserver.observe(box);
        });
    }

    /**
     * both reference columns take the height of the taller.
     *
     * Two rules of visibly different lengths, starting level and stopping in
     * different places, is what frames the graph otherwise -- the build panel is
     * eight label/value rows and the legend is a namespace grid plus three edge
     * origins, and they are never the same height by accident.
     *
     * The measurement is of what each column HOLDS: from the top of its panel
     * to the bottom of its body, which takes in the heading above the body. It
     * used to be the body alone, and the height the shorter column was then
     * held at was the taller one's body -- a heading short of the taller
     * column, so its rule stopped short and the two never matched.
     *
     * The panel's own height is not what is measured, because it is what is
     * being SET. Measuring it feeds the answer back into itself, and the columns
     * ratchet taller on every pass and never come back down. A body ends where
     * its contents do, whatever height its panel is held at.
     *
     * Note: read off the boxes as drawn, rather than added up from the heading's
     *       height and its margin, so the sum cannot leave out a piece of
     *       spacing the stylesheet adds later.
     *
     * Note: this is also where the canvas drag gets its floor -- see
     *       canvasFloor. The floor is a single number only because these two
     *       are matched, which is why the two arrived together.
     *
     * Note: a folded column does not take part. It is already the full height of
     *       the row by 'align-self: stretch', and its body is display:none and
     *       measures zero.
     */
    measureColumns() {
        const root = this.layout.current;

        if (!root) {
            return;
        }

        const tallest = ['build', 'legend'].reduce((most, key) => {
            const panel = root.querySelector(`.graph-panel-${key}.graph-panel-open`);
            const body = panel && panel.querySelector('.graph-panel-body');

            return Math.max(
                most,
                body ? body.getBoundingClientRect().bottom - panel.getBoundingClientRect().top : 0
            );
        }, 0);

        if (tallest === this.columnHeight) {
            return;
        }

        this.columnHeight = tallest;
        this.setState({ columns: tallest });
    }

    //
    // the legend points at the canvas: hovering an entry previews it, clicking
    // pins it, and clicking the pinned one again lets go. A click on the canvas
    // clears both -- see clearMarks, which the explorer calls.
    //
    markHover(mark) {
        this.setState({ hovered: mark });
    }

    /**
     * a click adds an entry to what is held, or takes it out again.
     *
     * It used to replace what was held, which meant the legend answered every
     * question except the one worth asking of a sixty-node canvas: where do two
     * namespaces sit RELATIVE to each other. A reader could see either against
     * everything and never the two together, and clicking an edge origin
     * silently dropped the namespaces they had lined up.
     */
    markPin(mark) {
        this.setState((state) => ({
            marked: holds(state.marked, mark)
                ? state.marked.filter((m) => !(m.kind === mark.kind && m.value === mark.value))
                : [...state.marked, mark],
        }));
    }

    clearMarks() {
        this.setState({ hovered: null, marked: [] });
    }

    /**
     * what the canvas is being asked to emphasize: everything held, plus the
     * entry under the pointer.
     *
     * Pointing at an entry that is NOT held previews what clicking it would
     * add, because that is the question being asked at that moment. The
     * alternative -- previewing the pointed entry ALONE, which is what a single
     * mark did -- makes the three namespaces a reader has lined up vanish when
     * they point at a fourth, and come back when they move away. That reads as
     * the page dropping their work.
     *
     * Note: memoised on the two pieces of state it reads, so the array handed
     *       down keeps its identity between renders. The explorer repaints when
     *       that identity changes, and a fresh array every render would repaint
     *       the canvas on every keystroke in the table filter below it and on
     *       every pointer move of a divider drag.
     */
    emphasis() {
        const { marked, hovered } = this.state;

        if (this.marksFor && this.marksFor.marked === marked && this.marksFor.hovered === hovered) {
            return this.marks;
        }

        this.marksFor = { marked: marked, hovered: hovered };
        this.marks = hovered && !holds(marked, hovered) ? [...marked, hovered] : marked;

        return this.marks;
    }

    /**
     * one row of the legend, as a control over the canvas.
     *
     * A button rather than a list item with handlers on it. What these do --
     * light a namespace's nodes, or an origin's edges, and drop the rest -- is
     * the same thing clicking a node on the canvas does, and a reader who
     * cannot use a pointer had no way to ask for it at all.
     *
     * Note: focus and blur drive the same preview hover does, so tabbing
     *       through the legend lights each class in turn.
     */
    entry(kind, value, children) {
        const mark = { kind: kind, value: value };
        const pinned = holds(this.state.marked, mark);

        return (
            <li key={value}>
                <button
                    type='button'
                    className='graph-legend-entry'
                    aria-pressed={pinned}
                    onClick={() => this.markPin(mark)}
                    onMouseEnter={() => this.markHover(mark)}
                    onMouseLeave={() => this.markHover(null)}
                    onFocus={() => this.markHover(mark)}
                    onBlur={() => this.markHover(null)}
                >
                    {children}
                </button>
            </li>
        );
    }

    /**
     * a reference column that opens and closes, at every width.
     *
     * It used to render two headers and let the stylesheet show one -- a toggle
     * button below the breakpoint, a plain heading above it -- because the wide
     * layout never closed anything. Now that both columns collapse on a wide
     * screen too, there is one header at both widths and it is a button.
     *
     * The button lives INSIDE the heading rather than replacing it. A collapsed
     * section still has to appear in the document outline: a bare button is not
     * a heading, and a reader navigating this page by headings would find the
     * graph and the tables and nothing that names either column.
     *
     * The summary is what a FOLDED panel says INSTEAD of its contents, so it is
     * gone once the contents are there. Open, it was a second copy of something
     * on screen a line or two below it -- '10.4M nodes' over the Nodes row, '12
     * namespaces' over a list of twelve namespaces -- and on a wide screen the
     * pair had to share a 16rem column, which wrapped 'Legend' and its count
     * onto two lines to say one thing twice.
     *
     * Note: the closed body stays in the document and is hidden by the
     *       stylesheet, not by React. Unmounting it would throw away the
     *       measured legend every time it was folded away, and the explorer
     *       beside it reads its colors from the same render.
     */
    panel(key, title, summary, content) {
        if (!content) {
            return null;
        }

        const open = this.state.open[key];
        const body = `graph-panel-${key}-body`;
        const state = open ? 'graph-panel-open' : 'graph-panel-closed';
        const width = this.state.size[key];

        //
        // the height is the TALLER column's, so the two rules that frame the
        // graph start level and stop level -- see measureColumns. It is carried
        // as a custom property and consumed only by the wide stylesheet,
        // because below the breakpoint the columns are stacked bands and
        // matching their heights would pad one of them out with nothing.
        //
        const style = {};

        if (width) {
            style['--graph-panel-width'] = `${width}px`;
        }
        if (open && this.state.columns) {
            style['--graph-panel-height'] = `${this.state.columns}px`;
        }

        return (
            <section
                className={`graph-panel graph-panel-${key} ${state}`}
                style={Object.keys(style).length ? style : undefined}
            >
                <h6 className='graph-panel-heading'>
                    <button
                        type='button'
                        className='graph-panel-toggle'
                        aria-expanded={open}
                        aria-controls={body}
                        onClick={() => this.toggle(key)}
                    >
                        <span className='graph-panel-title'>{title}</span>
                        {summary && !open
                            ? <span className='graph-panel-summary'>{summary}</span>
                            : null}
                    </button>
                </h6>
                <div className='graph-panel-body' id={body}>
                    {content}
                </div>
                {open ? this.rail(key, title) : null}
            </section>
        );
    }

    /**
     * which published build the page is showing.
     *
     * A mui Select rather than a <select>, for the menu it opens rather than for
     * how it looks closed. A native control delegates its option list to the
     * platform, which on a phone is a full height sheet -- the page cannot bound
     * it, style it, or keep it from covering the thing it belongs to. This one is
     * an ordinary popover of the page's own; see PICKER_MENU.
     *
     * Note: 'standard' with no underline, rather than the outlined variant mui
     *       defaults to. Outlined draws its own border as a fieldset, and the
     *       stylesheet already draws this control's border -- the same one the
     *       filter box below the graph has. Two borders, or one; this is one.
     *
     * Note: the accessible name travels in `inputProps`, which is where mui puts
     *       props meant for the element it gives role='combobox'. Passed as a
     *       plain `aria-label` it lands on the hidden input beside that element
     *       instead, where nothing reads it.
     */
    picker() {
        const { listing, selected } = this.state;
        const { source } = this.props;

        if (!listing) {
            return null;
        }

        const labels = source.labels(listing.choices);

        return (
            <Select
                className='graph-picker'
                variant='standard'
                disableUnderline
                value={selected || ''}
                onChange={(event) => this.navigateTo(event.target.value)}
                inputProps={{ 'aria-label': source.picker.name }}
                MenuProps={PICKER_MENU}
                open={this.state.picker_open}
                onOpen={this.openPicker}
                onClose={this.closePicker}
            >
                {listing.choices.map((choice, index) => (
                    <MenuItem key={choice.id} value={choice.id} disabled={!!choice.error}>
                        {choice.error ? `${labels[index]} (unavailable)` : labels[index]}
                    </MenuItem>
                ))}
            </Select>
        );
    }

    //
    // what the selected build is, from the LISTING rather than from the schema.
    // The listing is the authority on a build's identity -- the schema's own
    // dataset field is empty on published builds, and a panel reading 'n/a'
    // beside a named picker entry invites the reader to distrust both.
    //
    // Note: 'Nodes', not 'Node types'. The listing's figure is every node in
    //       the build -- ten million of them -- while a node TYPE is what one
    //       circle on the canvas stands for, and a build has about a hundred
    //       and fifty. The label said the second over the first, which made the
    //       canvas look like it was missing all but sixty of ten million.
    //
    // Note: Sources waits for the schema as well -- see graphSources. It holds
    //       its place with the bar the whole panel's stand-in draws in that
    //       row, and reads 'n/a' once there is no schema coming.
    //
    // Note: Day does not wait. It is the day the listing's entry names, or, for
    //       a build too old to name one, the day list() read off the published
    //       days before handing the choice over -- the day the picker shows.
    //       See buildDay in source.js.
    //
    // Note: a DAY's panel is the same panel with other rows, and every one of
    //       them but the day itself is totalled from the day's rows -- so all
    //       of those wait the way Sources does. See DAY_DETAILS in source.js.
    //
    details(build) {
        if (!build) {
            return null;
        }

        const whole = this.state.build;

        return (
            <dl className='graph-details'>
                {this.props.source.rows.map((row, index) => (
                    <div key={row.label} className='graph-details-row'>
                        <dt>{row.label}</dt>
                        <dd>
                            {row.schema && !whole && this.state.loading
                                ? <PendingDetail index={index} width={row.pending || null} />
                                : row.read(build, whole) || 'n/a'}
                        </dd>
                    </div>
                ))}
            </dl>
        );
    }

    /**
     * what a reference column holds while what belongs in it is still on its
     * way.
     *
     * Null once the request is over however it ended, which is the half of the
     * question this answers: a placeholder still up after a failed load is a
     * page claiming to be trying. The other half -- whether the real thing has
     * arrived yet -- is answered at the call site, where each of these is the
     * fallback of the content it stands in for.
     *
     * Note: which matters, because the two columns stop waiting a whole round
     *       trip apart. The build panel is drawn from the LISTING, so it fills
     *       in at the first response, while the legend is waiting on the schema
     *       behind it. The panel's Sources row waits with the legend, and holds
     *       its own place meanwhile -- see details.
     */
    pending(key) {
        if (!this.state.loading) {
            return null;
        }

        const { rows } = this.props.source;

        return key === 'build'
            ? (
                <PendingDetails
                    labels={rows.map((row) => row.label)}
                    widths={rows.map((row) => row.pending || null)}
                />
            )
            : <PendingLegend />;
    }

    //
    // Note: headed 'Namespaces', not 'Sources'. These are the namespaces the
    //       node types come from -- bls-jolts, bls-eci, sec-filings -- which is
    //       not the same list as the sources the graph holds (bls, market, sec).
    //       The panel beside it lists the sources under that name, and two
    //       different lists under one heading read as a contradiction.
    //
    legend(shown) {
        if (!shown) {
            return null;
        }

        return (
            <div className='graph-legend'>
                <h6>Namespaces</h6>
                <ul className='graph-legend-namespaces'>
                    {shown.namespaces.map((namespace) => this.entry('namespace', namespace, (
                        <React.Fragment>
                            <span
                                className='graph-legend-swatch'
                                style={{ backgroundColor: shown.painted.get(namespace) }}
                            />
                            {namespace}
                        </React.Fragment>
                    )))}
                </ul>

                <h6>Edges</h6>
                <ul className='graph-legend-origins'>
                    {shown.origins.map((origin) => this.entry('origin', origin, (
                        <React.Fragment>
                            <svg width='34' height='10' aria-hidden='true'>
                                <line
                                    x1='0' y1='5' x2='34' y2='5'
                                    stroke={originColor(origin, this.context.theme)}
                                    strokeWidth={origin === 'raw' ? 1 : 1.5}
                                    strokeDasharray={ORIGIN_DASH[origin] || undefined}
                                />
                            </svg>
                            {originName(origin)}
                            <span className='graph-legend-note'>
                                {ORIGIN_LABEL[origin] || ''}
                            </span>
                        </React.Fragment>
                    )))}
                </ul>
            </div>
        );
    }

    //
    // how much of the build the canvas is showing. Each circle is a node TYPE,
    // and the canvas carries a slice of them; without saying so, a reader
    // comparing the canvas with the totals beside it has no way to reconcile
    // the two.
    //
    // Note: it guards on the schema itself rather than being rendered behind a
    //       guard, because it now shares its row with the api icons, which are
    //       there whether or not a graph is.
    //
    // Note: while a build is on its way the line says so instead -- see
    //       PendingCaption, which moved here from the middle of the canvas
    //       once the placeholder there grew to fill it.
    //
    caption() {
        const { schema, build, loading } = this.state;

        if (loading) {
            return <PendingCaption />;
        }
        if (!schema) {
            return null;
        }

        const drawn = Object.keys(schema.node_types).length;
        const published = build ? Object.keys(build.node_types).length : 0;
        const scope = published > drawn
            ? `${drawn} of ${published} node types`
            : `All ${drawn} node types`;

        //
        // what chose them, where it is not their size. The two graphs are drawn
        // alike, so which types are on the canvas is the one difference a
        // reader cannot see for themselves -- see `chosen` in source.js
        //
        const chosen = this.props.source.chosen;

        return (
            <p className='graph-caption'>
                {chosen ? `${scope}, ${chosen}` : scope} · hover or tap a node for details · the rest are below
            </p>
        );
    }

    render() {
        const { schema, loading, failed, listing } = this.state;
        const { source } = this.props;
        const build = this.selectedChoice();
        const shown = this.onScreen();

        const body = () => {
            if (loading) {
                return <PendingCanvas />;
            }
            if (failed || !schema) {
                return (
                    <p className='graph-status graph-status-failed'>
                        {listing ? source.failed.load : source.failed.list}
                    </p>
                );
            }

            return (
                <GraphExplorer
                    data={schema}
                    palette={shown ? shown.painted : null}
                    emphasis={this.emphasis()}
                    onClear={this.clearMarks}
                    theme={this.context.theme}
                />
            );
        };

        const nodes = source.summary(build, this.state.build);
        const namespaces = shown
            ? `${shown.namespaces.length} ${shown.namespaces.length === 1 ? 'namespace' : 'namespaces'}`
            : null;

        return (
            <ErrorBoundary FallbackComponent={ErrorFallback}>
                <div className='container graph-page'>
                    {/*

                        the page's title, and the one control that changes what
                        the whole page shows.

                        It is a GRID ITEM, and which cell it lands in is the
                        whole point. Sitting at the left end of a row above
                        three columns, a title aligns with the leftmost one and
                        reads as that column's heading -- moving it to an <h4>
                        and pushing the picker to the far end did not fix that,
                        because the left edge is still the left edge.

                        So on a wide screen it is placed in the MIDDLE column,
                        directly over the graph, where what it names is not in
                        question. On a narrow screen there is only one column
                        and it is placed first, ahead of both panels, because a
                        page title that arrives third is not a page title. The
                        stylesheet decides which, by naming grid areas; the
                        markup is the same at both widths, so nothing is
                        duplicated and no heading is hidden from a reader who
                        navigates by them.

                        Note: the visible label is what a sighted reader was
                              missing -- the accessible name was there long
                              before it, which screen readers got and nobody
                              else did. Both pages read 'Day' and 'Published
                              day' now, from their source: the Retrieval graph
                              picks a day of the tables, and the Training graph
                              a build by the day it holds.

                        Note: the heading names WHICH graph -- 'Training Graph'
                              or 'Retrieval Graph' -- rather than the 'Knowledge
                              graph' both of them are, since the two are one
                              menu away from each other and look alike. In
                              title case, as every other page's heading is.

                    */}
                    <div
                        className={`graph-layout ${this.state.open.row
                            ? 'graph-row-open'
                            : 'graph-row-folded'}`}
                        ref={this.layout}
                    >
                        <div className='graph-header'>
                            <h4>{source.heading}</h4>
                            {/*

                                the field is here while the listing is on its
                                way as well as once it has arrived, holding a
                                box the size of the control.

                                It is a whole line of the page on a phone --
                                '.graph-picker-field' takes one to itself below
                                576px -- so a control that arrives with the
                                listing is a header that grows a line under the
                                reader, and everything below it moves down.

                            */}
                            {listing || loading ? (
                                <div className='graph-picker-field'>
                                    <span className='graph-picker-label'>{source.picker.label}</span>
                                    {listing ? this.picker() : <PendingPicker width={source.picker.pending} />}
                                </div>
                            ) : null}
                        </div>
                        {this.panel(
                            'build',
                            source.panel,
                            nodes,
                            this.details(build) || this.pending('build')
                        )}
                        {this.panel(
                            'legend',
                            'Legend',
                            namespaces,
                            this.legend(shown) || this.pending('legend')
                        )}
                        <div
                            className='graph-canvas'
                            id='graph-row'
                            style={this.state.size.canvas
                                ? { '--graph-canvas-height': `${this.state.size.canvas}px` }
                                : undefined}
                        >
                            {/*

                                the caption and the api icons head the canvas
                                column rather than the page, because both
                                describe the graph rather than the page: what of
                                the build is drawn, and the request it was drawn
                                from -- the build the picker has selected, as
                                getGraphById fetches it, or the listing, before
                                one is selected. A day is drawn from TWO
                                requests, and gets an icon for each -- see
                                requests() in source.js.

                            */}
                            <div className='graph-canvas-header'>
                                {this.caption()}
                                <ApiLinks
                                    docs={API_DOCS.knowledgeGraph}
                                    requests={source.requests(this.state.selected)}
                                    size='medium'
                                />
                            </div>
                            {body()}
                        </div>
                        {/*

                            the bar a folded row leaves behind, in the green the
                            folded columns wear. It is the only way back, so it
                            is rendered whatever the row is doing and hidden by
                            the stylesheet while the row is open -- a control
                            that exists only in the state it undoes is a control
                            that cannot be reached from the state it undoes.

                        */}
                        <button
                            type='button'
                            className='graph-row-bar'
                            aria-expanded={this.state.open.row}
                            aria-controls='graph-row'
                            onClick={() => this.toggle('row')}
                        >
                            <ExpandMoreIcon fontSize='inherit' />
                            <span>Show the graph</span>
                        </button>
                    </div>
                    {/*

                        everything the canvas could not draw, at full width below
                        the three columns. It reads the UNFILTERED build and is
                        handed the canvas's own color assignment, so a swatch in
                        a row is the color that namespace is above it.

                        The rule above it is the third divider: the same strip
                        and the same arrow as the two beside the graph, turned
                        ninety degrees. It rides on this wrapper rather than on
                        the tables, so the tables stay a component that draws a
                        table and knows nothing about the layout around it.

                    */}
                    <div className='graph-below'>
                        {this.state.open.row
                            ? this.divider('canvas', 'Collapse the graph', ExpandLessIcon, 'graph-row')
                            : null}
                        <GraphTables
                            schema={this.state.build}
                            drawn={schema}
                            painted={shown ? shown.painted : null}
                            loading={loading}
                            terms={source.terms}
                            lookups={source.lookups}
                            scope={source.scope}
                            weight={source.weight}
                            theme={this.context.theme}
                        />
                    </div>
                </div>
            </ErrorBoundary>
        );
    }
}

//
// a page that names no source is the Training graph, which is what this page was
// before there were two.
//
GraphLayout.defaultProps = { source: BUILDS };

//
// the address is injected rather than read inside the class, the way
// stream/trigger.jsx and stream/alarm.jsx do it -- react-router's hooks cannot
// be called from a class component.
//
// Two pages, one layout, and the source is what tells them apart. Each is its own
// component so that moving between the two -- by the Graph menu -- mounts the
// other rather than handing one page the other's source mid-life.
//
export default (props) => (
    <GraphLayout {...props} source={BUILDS} params={useParams()} navigate={useNavigate()} />
);

export function RetrievalGraph(props) {
    return <GraphLayout {...props} source={DAYS} params={useParams()} navigate={useNavigate()} />;
}

export { GraphLayout };

/**
 * graph.jsx: browse the published knowledge graph builds.
 *
 * The front page draws one graph -- the default build -- as a backdrop, and is
 * deliberately not readable up close. This page is the other half: pick a build,
 * see what is in it, and read the thing properly.
 *
 * Laid out in three columns on a wide screen -- what the build is, the graph,
 * and how to read its colours -- so all three are in view together. On a narrow
 * one they stack, and the title leads.
 *
 * Both reference columns FOLD, at either width, and what they give up goes to
 * the graph. The grid's side tracks are sized to their contents, so a folded
 * column widens the canvas rather than leaving a gap; the canvas takes its
 * height from the viewport and does not change, which means the graph grows
 * sideways and never downward.
 *
 * They start open where there is room for all three at once and closed where
 * there is not -- a phone that opened on a page-long list of metadata showed
 * the graph, the reason for the page, only after a long scroll.
 *
 * Note: the slice here is larger than the backdrop's. Both go through the same
 *       selection rule, which takes the limit as an argument precisely so two
 *       surfaces can want different amounts. At this size the published graph
 *       stays in one piece, which it does not at the backdrop's budget.
 *
 * Note: a failed load clears the graph rather than leaving the previous one on
 *       screen. A stale graph beside a fresh label is indistinguishable from a
 *       correct one, which is the worst outcome available here -- worse than an
 *       error, and much worse than an empty panel.
 */

import React, { Component } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ErrorFallback from '../../formatter/boundary-error.jsx';
import GraphExplorer from '../../animation/graph-explorer.jsx';
import { getGraphListing, getGraphById } from '../../general/get-graph-schema.js';
import { knowledgeGraphUrl, API_DOCS } from '../../general/api-url.js';
import ApiLinks from '../../general/api-links.jsx';
import filterSchema, { EXPLORER_NODE_TYPES } from '../../animation/filter-schema.js';
import GraphTables from './tables.jsx';
import {
    sourceNamespace,
    buildPalette,
    rankNamespaces,
    ORIGIN_DASH,
    originColor,
} from '../../animation/encoding.js';

//
// what each origin means, for the legend. The styling itself lives in
// encoding.js -- this is only the wording.
//
const ORIGIN_LABEL = {
    raw: 'as published by the source',
    enrichment: 'derived during the build',
    unification: 'the same thing, seen twice',
};

//
// the two panels that close on a narrow screen. Both start closed there, so a
// phone opens on the graph; a wide screen ignores this and shows both.
//
const PANELS_CLOSED = { build: false, legend: false };

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
// which way the pointer travels to WIDEN each column, since their dividers face
// opposite ways: the build column's is on its right, the legend's on its left.
//
const RAIL_WIDEN = { build: 1, legend: -1 };

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

const COMPACT = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumSignificantDigits: 3,
});

function when(iso) {
    if (!iso) {
        return 'n/a';
    }

    const zone = /(Z|[+-]00:?00)$/.test(String(iso)) ? ' UTC' : '';

    return String(iso).replace('T', ' ').replace(/(:\d\d).*$/, '$1').replace(/\+.*$/, '') + zone;
}

function count(n) {
    return typeof n === 'number' ? n.toLocaleString() : 'n/a';
}

//
// what tells the builds in the picker apart, which is not what the listing
// calls them.
//
// The listing labels a build with a sentence -- 'September 2026 (all-sources,
// 1024d, run 2026-09-19 05:00 UTC)' -- and the builds it returns differ only in
// the last few characters of it. Seven of those made a 466px control beside the
// page heading, and, in a phone's option list, seven wrapped paragraphs to
// choose between builds that read as identical until their end.
//
// Every constant part of that sentence is already on the page, in the build
// panel directly below it: Dataset, Variant, Run. So an option says the run
// time -- the part that differs, in the words the Run row uses -- and then
// whatever else actually varies across THIS listing, which is nothing while
// every published build is the same dataset and variant.
//
// Note: `period` is deliberately not one of the fields that can be added. It is
//       a partition key rather than a window over the data -- see the note below
//       -- and an option ending '2026-09' would put it back in front of a reader
//       as though it bounded something.
//
// Note: the listing's own labels are used for ALL of them when the derived ones
//       do not tell every build apart: two builds run in the same minute would
//       both read '2026-09-19 05:00 UTC'. A shorter label is worth having, and a
//       label that names two different builds is not.
//
const DISTINGUISHING = ['dataset', 'variant'];

function pickerLabels(graphs) {
    const varies = DISTINGUISHING.filter(
        (key) => new Set(graphs.map((build) => build[key])).size > 1
    );

    const labels = graphs.map((build) => (build.run
        ? [when(build.run), ...varies.map((key) => build[key]).filter(Boolean)].join(' · ')
        : build.label));

    return new Set(labels).size === labels.length ? labels : graphs.map((build) => build.label);
}

//
// There is deliberately no 'Period' row below, and the listing's `period` is
// read by nothing on this page.
//
// It is a PARTITION KEY: the builds are listed out of a partition, and an id is
// selected from within it. It is not a window over the data, and a row headed
// 'Period' invited every reader to take it for one. The September build carries
// 76 distinct dates -- `bls_enrichment_UnifiedDay` in its own schema -- across
// economic series going back eighteen years, so '2026-09' bounds none of it.
//
// The page said so twice before arriving here. First as a derived day range,
// '2026-09-01 – 2026-09-19', whose end was the run date wearing a coverage
// date's clothes. Then as 'September 2026', which dropped the invented precision
// and kept the false framing. What a reader can actually use is in the rows that
// remain -- and the partition itself is already in the picker's label, where it
// reads as part of a build's name rather than as a claim about its contents.
//

class GraphLayout extends Component {
    constructor() {
        super();

        this.state = {
            listing: null,
            selected: null,
            schema: null,
            // the WHOLE build, beside the slice above. The tables read every node
            // and edge type from here; it used to be measured for the caption and
            // then discarded on the same line.
            build: null,
            loading: true,
            failed: false,
            open: PANELS_CLOSED,
            //
            // a column the reader has narrowed by dragging its divider, in px,
            // or null for whatever the stylesheet gives it. See startDrag.
            //
            width: { build: null, legend: null },
            //
            // what the LEGEND is asking the canvas to emphasise: the entry
            // under the pointer, and the entry a click pinned. Hovering wins
            // while it lasts, so pointing at one entry previews it and moving
            // off returns to the pinned one -- the same rule the canvas follows
            // for a node, and for the same reason.
            //
            hovered: null,
            marked: null,
            // the picker's menu is controlled so a page scroll can close it --
            // see openPicker
            picker_open: false,
        };

        this.openPicker = this.openPicker.bind(this);
        this.closePicker = this.closePicker.bind(this);
        this.selectBuild = this.selectBuild.bind(this);
        this.navigateToBuild = this.navigateToBuild.bind(this);
        this.requestedBuild = this.requestedBuild.bind(this);
        this.selectedBuild = this.selectedBuild.bind(this);
        this.onScreen = this.onScreen.bind(this);
        this.toggle = this.toggle.bind(this);
        this.panel = this.panel.bind(this);
        this.rail = this.rail.bind(this);
        this.startDrag = this.startDrag.bind(this);
        this.onDrag = this.onDrag.bind(this);
        this.endDrag = this.endDrag.bind(this);
        this.entry = this.entry.bind(this);
        this.markHover = this.markHover.bind(this);
        this.markPin = this.markPin.bind(this);
        this.clearMarks = this.clearMarks.bind(this);
        this.legend = this.legend.bind(this);
        this.details = this.details.bind(this);
        this.picker = this.picker.bind(this);
        this.caption = this.caption.bind(this);
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

        if (typeof window.matchMedia === 'function'
            && window.matchMedia(`(min-width: ${PANELS_WIDE}px)`).matches) {
            this.setState({ open: { build: true, legend: true } });
        }

        getGraphListing().then((listing) => {
            if (!listing || !listing.graphs.length) {
                this.setState({ listing: null, loading: false, failed: true });
                return;
            }

            this.setState({ listing: listing });
            this.selectBuild(this.requestedBuild(listing));
        });
    }

    componentWillUnmount() {
        window.removeEventListener('scroll', this.closePicker);
        this.endDrag();
    }

    /**
     * the picker's menu closes when the PAGE scrolls under it.
     *
     * mui renders the menu into a portal positioned against the viewport, and
     * relies on the modal behind it locking body scroll to keep the page still
     * while it is open. That lock is `overflow: hidden` on the body, which iOS
     * Safari does not honour for touch scrolling -- so on a phone the page slid
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
     *       draw, and the picker shows what it drew instead.
     */
    requestedBuild(listing) {
        const requested = this.props.params.graph;

        if (requested && listing.graphs.some((b) => b.id === requested)) {
            return requested;
        }

        return listing.default || listing.graphs[0].id;
    }

    /**
     * a build chosen in the picker becomes the address, so the selection can be
     * linked to and the back button moves between builds.
     *
     * Note: componentDidUpdate does the selecting, off the address, rather than
     *       this navigating AND selecting. Two entry points writing 'selected'
     *       -- the picker and the back button -- is how they get to disagree.
     */
    navigateToBuild(id) {
        this.props.navigate(`/graph/${encodeURIComponent(id)}`);
    }

    componentDidUpdate(previous) {
        const before = previous.params.graph;
        const now = this.props.params.graph;
        const { listing } = this.state;

        if (before !== now && listing) {
            const wanted = this.requestedBuild(listing);

            if (wanted !== this.state.selected) {
                this.selectBuild(wanted);
            }
        }
    }

    /**
     * Note: the graph is cleared BEFORE the fetch, not after it resolves. The
     *       alternative leaves the previous build on screen under the new
     *       build's label for as long as the request takes, which reads as a
     *       correct answer and is not one.
     */
    selectBuild(id) {
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
            marked: null,
        });

        return getGraphById(id).then((schema) => {
            const filtered = filterSchema(schema, EXPLORER_NODE_TYPES);

            this.setState({
                schema: filtered,
                build: filtered ? schema : null,
                loading: false,
                failed: !filtered,
            });
        });
    }

    selectedBuild() {
        const { listing, selected } = this.state;

        if (!listing || !selected) {
            return null;
        }

        return listing.graphs.find((b) => b.id === selected) || null;
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
        // selected. Recomputed per render it would hand the tables below a fresh
        // colour Map every time, and a table that caches its rows against that
        // Map would rebuild all 976 of them on every keystroke in its filter box.
        //
        if (this.screenFor === schema) {
            return this.screen;
        }

        const nodes = Object.keys(schema.node_types).map((id) => ({
            id: id,
            namespace: sourceNamespace(schema.node_types[id], id),
        }));

        //
        // the namespaces LISTED are the ones on screen, from the slice; the
        // colours they are listed in come from the whole build, so this legend
        // describes the front page's backdrop as well as this page's canvas.
        // See buildPalette -- the two used to rank separately and disagree.
        //
        // Note: every namespace in `namespaces` is in `painted`. Both are taken
        //       over the same slice -- buildPalette filters the build at
        //       EXPLORER_NODE_TYPES, which is what `schema` already is -- so a
        //       swatch can never come back undefined here.
        //
        this.screenFor = schema;
        this.screen = {
            namespaces: rankNamespaces(nodes),
            painted: buildPalette(this.state.build),
            origins: [...new Set(
                Object.values(schema.edge_types).map((e) => e.origin).filter(Boolean)
            )].sort(),
        };

        return this.screen;
    }

    toggle(key) {
        this.setState((state) => ({ open: { ...state.open, [key]: !state.open[key] } }));
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
        const Arrow = key === 'build' ? ChevronLeftIcon : ChevronRightIcon;

        return (
            <React.Fragment>
                <div
                    className='graph-panel-grip'
                    aria-hidden='true'
                    onPointerDown={(event) => this.startDrag(key, event)}
                />
                <button
                    type='button'
                    className='graph-panel-fold'
                    aria-label={`Collapse ${title.toLowerCase()}`}
                    onClick={() => this.toggle(key)}
                >
                    <Arrow fontSize='inherit' />
                </button>
            </React.Fragment>
        );
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
     *
     * Note: the ceiling is read back off the element with the inline width
     *       taken off, rather than written down here. '_graph.scss' clamps that
     *       width against the viewport, so a copy in this file would be both a
     *       second number to keep in step and the wrong one at most window
     *       sizes.
     *
     * Note: the move and release listeners go on the window rather than on the
     *       strip. A pointer dragging a 14px target leaves it constantly, and a
     *       drag that stops the moment the pointer is off the rule is a drag
     *       that cannot reach the width it is being dragged to.
     */
    startDrag(key, event) {
        if (event.button !== 0) {
            return;
        }

        const panel = event.currentTarget.closest('.graph-panel');
        const start = panel.offsetWidth;
        const inline = panel.style.getPropertyValue('--graph-panel-width');

        panel.style.removeProperty('--graph-panel-width');
        const ceiling = panel.offsetWidth;

        if (inline) {
            panel.style.setProperty('--graph-panel-width', inline);
        }

        this.drag = { key: key, from: event.clientX, start: start, ceiling: ceiling };

        window.addEventListener('pointermove', this.onDrag);
        window.addEventListener('pointerup', this.endDrag);
        event.preventDefault();
    }

    //
    // Note: no guard on `this.drag`. endDrag takes this listener off the window
    //       before it clears the drag, and both of the things that end a drag --
    //       the pointer coming up, and the component going away -- go through
    //       it, so there is no path that reaches here without one.
    //
    onDrag(event) {
        const { key, from, start, ceiling } = this.drag;
        const wanted = start + (event.clientX - from) * RAIL_WIDEN[key];

        if (wanted < RAIL_MIN - RAIL_FOLD) {
            this.endDrag();

            //
            // folded by the drag, and back at its designed width when it is
            // opened again. The width it folded at is the narrowest the drag
            // would go, which is not a width anybody chose.
            //
            this.setState((state) => ({
                open: { ...state.open, [key]: false },
                width: { ...state.width, [key]: null },
            }));

            return;
        }

        this.setState((state) => ({
            width: {
                ...state.width,
                [key]: Math.min(Math.max(wanted, RAIL_MIN), ceiling),
            },
        }));
    }

    endDrag() {
        window.removeEventListener('pointermove', this.onDrag);
        window.removeEventListener('pointerup', this.endDrag);
        this.drag = null;
    }

    //
    // the legend points at the canvas: hovering an entry previews it, clicking
    // pins it, and clicking the pinned one again lets go. A click on the canvas
    // clears both -- see clearMarks, which the explorer calls.
    //
    markHover(mark) {
        this.setState({ hovered: mark });
    }

    markPin(mark) {
        this.setState((state) => ({
            marked: state.marked
                && state.marked.kind === mark.kind
                && state.marked.value === mark.value
                ? null
                : mark,
        }));
    }

    clearMarks() {
        this.setState({ hovered: null, marked: null });
    }

    /**
     * one row of the legend, as a control over the canvas.
     *
     * A button rather than a list item with handlers on it. What these do --
     * light one namespace's nodes, or one origin's edges, and drop the rest --
     * is the same thing clicking a node on the canvas does, and a reader who
     * cannot use a pointer had no way to ask for it at all.
     *
     * Note: focus and blur drive the same preview hover does, so tabbing
     *       through the legend lights each class in turn.
     */
    entry(kind, value, children) {
        const { marked } = this.state;
        const pinned = !!marked && marked.kind === kind && marked.value === value;
        const mark = { kind: kind, value: value };

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
     *       beside it reads its colours from the same render.
     */
    panel(key, title, summary, content) {
        if (!content) {
            return null;
        }

        const open = this.state.open[key];
        const body = `graph-panel-${key}-body`;
        const state = open ? 'graph-panel-open' : 'graph-panel-closed';
        const width = this.state.width[key];

        return (
            <section
                className={`graph-panel graph-panel-${key} ${state}`}
                style={width ? { '--graph-panel-width': `${width}px` } : undefined}
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

        if (!listing) {
            return null;
        }

        const labels = pickerLabels(listing.graphs);

        return (
            <Select
                className='graph-picker'
                variant='standard'
                disableUnderline
                value={selected || ''}
                onChange={(event) => this.navigateToBuild(event.target.value)}
                inputProps={{ 'aria-label': 'Published build' }}
                MenuProps={PICKER_MENU}
                open={this.state.picker_open}
                onOpen={this.openPicker}
                onClose={this.closePicker}
            >
                {listing.graphs.map((build, index) => (
                    <MenuItem key={build.id} value={build.id} disabled={!!build.error}>
                        {build.error ? `${labels[index]} (unavailable)` : labels[index]}
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
    details(build) {
        if (!build) {
            return null;
        }

        const rows = [
            ['Nodes', count(build.nodes)],
            ['Edges', count(build.edges)],
            ['Sources', (build.sources || []).join(', ')],
            ['Run', when(build.run)],
            ['Built', when(build.built)],
            ['Dataset', build.dataset],
            ['Variant', build.variant],
        ];

        return (
            <dl className='graph-details'>
                {rows.map(([label, value]) => (
                    <div key={label} className='graph-details-row'>
                        <dt>{label}</dt>
                        <dd>{value || 'n/a'}</dd>
                    </div>
                ))}
            </dl>
        );
    }

    //
    // Note: headed 'Namespaces', not 'Sources'. These are the namespaces the
    //       node types come from -- jolts, eci, laus -- which is not the same
    //       list as the build's sources (bls, market, noaa, sec). The panel
    //       beside it lists the sources under that name, and two different
    //       lists under one heading read as a contradiction.
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
                                    stroke={originColor(origin)}
                                    strokeWidth={origin === 'raw' ? 1 : 1.5}
                                    strokeDasharray={ORIGIN_DASH[origin] || undefined}
                                />
                            </svg>
                            {origin}
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
    caption() {
        const { schema, build } = this.state;

        if (!schema) {
            return null;
        }

        const drawn = Object.keys(schema.node_types).length;
        const published = build ? Object.keys(build.node_types).length : 0;
        const scope = published > drawn
            ? `${drawn} of ${published} node types`
            : `All ${drawn} node types`;

        return (
            <p className='graph-caption'>
                {scope} · hover or tap a node for details · the rest are below
            </p>
        );
    }

    render() {
        const { schema, loading, failed, listing } = this.state;
        const build = this.selectedBuild();
        const shown = this.onScreen();

        const body = () => {
            if (loading) {
                return <p className='graph-status'>Loading the graph…</p>;
            }
            if (failed || !schema) {
                return (
                    <p className='graph-status graph-status-failed'>
                        {listing
                            ? 'That build could not be loaded.'
                            : 'The published builds could not be listed.'}
                    </p>
                );
            }

            return (
                <GraphExplorer
                    data={schema}
                    palette={shown ? shown.painted : null}
                    emphasis={this.state.hovered || this.state.marked}
                    onClear={this.clearMarks}
                />
            );
        };

        const nodes = build && typeof build.nodes === 'number'
            ? `${COMPACT.format(build.nodes)} nodes`
            : null;
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

                        Note: the visible 'Build' is what a sighted reader was
                              missing -- the accessible name has always been
                              'Published build', which screen readers got and
                              nobody else did.

                    */}
                    <div className='graph-layout'>
                        <div className='graph-header'>
                            <h4>Knowledge graph</h4>
                            {listing ? (
                                <div className='graph-picker-field'>
                                    <span className='graph-picker-label'>Build</span>
                                    {this.picker()}
                                </div>
                            ) : null}
                        </div>
                        {this.panel('build', 'Build details', nodes, this.details(build))}
                        {this.panel('legend', 'Legend', namespaces, this.legend(shown))}
                        <div className='graph-canvas'>
                            {/*

                                the caption and the api icons head the canvas
                                column rather than the page, because both
                                describe the graph rather than the page: what of
                                the build is drawn, and the request it was drawn
                                from -- the build the picker has selected, as
                                getGraphById fetches it, or the listing, before
                                one is selected.

                            */}
                            <div className='graph-canvas-header'>
                                {this.caption()}
                                <ApiLinks
                                    docs={API_DOCS.knowledgeGraph}
                                    request={knowledgeGraphUrl(this.state.selected)}
                                    size='medium'
                                />
                            </div>
                            {body()}
                        </div>
                    </div>
                    {/*

                        everything the canvas could not draw, at full width below
                        the three columns. It reads the UNFILTERED build and is
                        handed the canvas's own colour assignment, so a swatch in
                        a row is the colour that namespace is above it.

                    */}
                    <GraphTables
                        schema={this.state.build}
                        drawn={schema}
                        painted={shown ? shown.painted : null}
                    />
                </div>
            </ErrorBoundary>
        );
    }
}

//
// the address is injected rather than read inside the class, the way
// stream/trigger.jsx and stream/alarm.jsx do it -- react-router's hooks cannot
// be called from a class component.
//
export default (props) => <GraphLayout {...props} params={useParams()} navigate={useNavigate()} />;

export { GraphLayout, EXPLORER_NODE_TYPES };

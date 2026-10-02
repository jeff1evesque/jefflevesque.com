/**
 * header-menu.jsx: anonymous users.
 *
 * Note: this script implements jsx (reactjs) syntax.
 */

import React, { Component } from 'react';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MenuIcon from '@mui/icons-material/Menu';
import { Link, NavLink, useLocation } from 'react-router-dom'
import HomeLink, { HomeBrand } from './menu-items/home.jsx';
import ThemeToggle from './theme-toggle.jsx';
import LoginLinkState from '../redux/container/login-link.jsx';
import RegisterLinkState from '../redux/container/register-link.jsx';
import { Navbar, Nav, NavDropdown } from 'react-bootstrap';
import { BreakpointRender } from 'rearm/lib/Breakpoint';
import { breakpoints } from '../general/breakpoints.js';
import PropTypes from 'prop-types';

//
// the Graph section, which is two pages: the published PyG build a graph neural
// network trains on, and a day of the query tables an LLM's retrieval step reads.
// Named for what each graph is FOR, in the builder's own split, so neither name
// asks a reader to know what PyG is.
//
// Note: '/graph' keeps its address, so every link to a build keeps working. See
//       main-route.jsx for why '/graph/retrieval' is never read as one.
//
const GRAPH_PAGES = [
    { to: '/graph', label: 'Training Graph' },
    { to: '/graph/retrieval', label: 'Retrieval Graph' },
];

//
// which of the two an address is on, or null for neither. '/graph/<id>' is the
// Training graph opened on one build, so it counts as '/graph'.
//
function graphPage(pathname) {
    if (/^\/graph\/retrieval(\/|$)/.test(pathname)) {
        return '/graph/retrieval';
    }

    return /^\/graph(\/|$)/.test(pathname) ? '/graph' : null;
}

/**
 * the Graph section on a wide screen: a pill like the three beside it, opening
 * onto the two pages.
 *
 * Its entries go through the router, as the pills beside it do. The toggle is
 * marked active on either page, and each entry on its own, for the reason a
 * NavLink marks itself -- the header says where the reader is.
 *
 * Note: a function component beside the class, because it reads the address,
 *       and react-router's hooks cannot be called from a class. A NavLink cannot
 *       say it either: '/graph' is a prefix of '/graph/retrieval', so the
 *       Training graph's entry would light on both pages.
 */
function GraphMenu() {
    const current = graphPage(useLocation().pathname);

    return (
        <NavDropdown
            id='graph-nav-dropdown'
            className='main-navigation-dropdown'
            title='Graph'
            active={Boolean(current)}
        >
            {GRAPH_PAGES.map((page) => (
                <NavDropdown.Item key={page.to} as={Link} to={page.to} active={current === page.to}>
                    {page.label}
                </NavDropdown.Item>
            ))}
        </NavDropdown>
    );
}

//
// the phone's menu: every page in one list, in the order the wide header gives
// them (#173). The Graph section's two pages are entries of their own, with no
// heading over them, since each name already says it is a graph.
//
const PHONE_PAGES = [
    { to: '/stream', label: 'Stream' },
    { to: '/data', label: 'Data' },
    ...GRAPH_PAGES,
    { to: '/model', label: 'Model' },
];

//
// which of them an address is on, or null for none: the Graph section's own
// rule for its two pages, and otherwise the page the address starts with -- so
// a stream's alarm page, '/stream/<stream>/alarm', is on Stream.
//
// Note: Login and Register are never the page on screen. Their pages draw a
//       header of their own -- see renderContent.
//
function phonePage(pathname) {
    const graph = graphPage(pathname);

    if (graph) {
        return graph;
    }

    const page = PHONE_PAGES.find(
        (entry) => pathname === entry.to || pathname.startsWith(`${entry.to}/`)
    );

    return page ? page.to : null;
}

/**
 * the phone's menu, opened from the bar (#173): a panel dropped over the page,
 * one row per page, each ending in the arrow a row that goes somewhere ends in
 * on /stream's list. The page on screen is a green band across the panel, as the
 * phone's way back to every stream is green. Login and Register are the wide
 * header's two buttons, at its foot, and the round arrow /graph and /data fold
 * with sits on its bottom edge.
 *
 * Every way out of it -- a pick, either button, the arrow -- goes through
 * 'onClose', so the page the reader lands on is never covered by the menu.
 *
 * Note: a function component beside the class, as GraphMenu is, because it
 *       reads the address.
 */
function PhoneMenu({ onClose }) {
    const current = phonePage(useLocation().pathname);

    return (
        <nav className='phone-menu' aria-label='Site'>
            {PHONE_PAGES.map((page) => (
                <Link
                    key={page.to}
                    to={page.to}
                    className={current === page.to ? 'phone-menu-link active' : 'phone-menu-link'}
                    aria-current={current === page.to ? 'page' : undefined}
                    onClick={onClose}
                >
                    <span>{page.label}</span>
                    <ChevronRightIcon className='phone-menu-arrow' fontSize='inherit' aria-hidden='true' />
                </Link>
            ))}
            <div className='phone-menu-actions'>
                <Link to='/login' className='btn' onClick={onClose}>Login</Link>
                <Link to='/register' className='btn btn-primary' onClick={onClose}>Register</Link>
            </div>
            <button type='button' className='phone-menu-fold' aria-label='Close the menu' onClick={onClose}>
                <ExpandLessIcon fontSize='inherit' />
            </button>
        </nav>
    );
}

PhoneMenu.propTypes = {
    onClose: PropTypes.func.isRequired,
};

class HeaderMenu extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        layout: PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.shape({
                type: PropTypes.string,
            })
        ])
    }

    constructor(props) {
        super(props);

        //
        // whether the phone's menu is open: held here rather than left to the
        // navbar, so a pick, the arrow on the menu's foot and a tap on the
        // dimmed page can all close it, and the bar's button can show which it
        // will do
        //
        this.state = { menu_open: false };
        this.toggleMenu = this.toggleMenu.bind(this);
        this.closeMenu = this.closeMenu.bind(this);
    }

    toggleMenu(open) {
        this.setState({ menu_open: open });
    }

    closeMenu() {
        this.setState({ menu_open: false });
    }

    showDesktopHeader() {
        return (
            <Navbar collapseOnSelect expand='lg' className='main-navigation menu-home-desktop'>
                <div className='row main-navigation-row'>
                    <div className='col-sm-2 home'>
                        <Navbar.Brand><HomeBrand /></Navbar.Brand>
                    </div>
                    <div className='col'>
                        <div className='row'>
                            <div className='col'>
                                <Nav>
                                    <div>
                                        {/*

                                            ordered the way the data moves:
                                            ingested, then stored, then built
                                            into a graph, then modeled.

                                        */}
                                        <span className='border-oval-radius'>
                                            <NavLink className='main-navigation-large' to='/stream'>Stream</NavLink>
                                        </span>
                                        <span className='horizontal-spacer'>|</span>
                                        <span className='border-oval-radius'>
                                            <NavLink className='main-navigation-large' to='/data'>Data</NavLink>
                                        </span>
                                        <span className='horizontal-spacer'>|</span>
                                        <span className='border-oval-radius'>
                                            <GraphMenu />
                                        </span>
                                        <span className='horizontal-spacer'>|</span>
                                        <span className='border-oval-radius'>
                                            <NavLink className='main-navigation-large' to='/model'>Model</NavLink>
                                        </span>
                                    </div>
                                </Nav>
                            </div>
                            <div className='col-sm-5'>
                                <ThemeToggle />
                                <LoginLinkState />
                                <RegisterLinkState />
                            </div>
                        </div>
                    </div>
                </div>
            </Navbar>
        )
    }

    //
    // the phone's header (#173): the page's own color, as the wide one is, with
    // the house, the theme's switch, and the button that opens the menu. The
    // menu drops over the page from under it -- see PhoneMenu -- with the page
    // dimmed behind it, and a tap on the dimmed page closes it.
    //
    showMobileHeader() {
        const open = this.state.menu_open;

        return (
            <Navbar
                expand='lg'
                expanded={open}
                onToggle={this.toggleMenu}
                className='main-navigation menu-home menu-home-mobile phone-header'
            >
                <Navbar.Brand><HomeBrand /></Navbar.Brand>
                {/*

                    on the bar itself, beside the button that opens the menu,
                    rather than in the menu. A reader changes it on the page
                    they are reading, and should not have to open a menu that
                    covers the page to do it.

                */}
                <ThemeToggle className='theme-toggle-phone' />
                {/*

                    its name says what a press will do. react-bootstrap takes
                    the name as 'label', and writes it over an 'aria-label'

                */}
                <Navbar.Toggle
                    aria-controls='phone-menu'
                    label={open ? 'Close the menu' : 'Open the menu'}
                    className='phone-menu-toggle'
                >
                    {open ? <CloseIcon fontSize='inherit' /> : <MenuIcon fontSize='inherit' />}
                </Navbar.Toggle>
                {/*

                    the page under the open menu, dimmed. Not a button of its
                    own: the menu's arrow and the bar's button are the ways out
                    a keyboard and a screen reader are given, and this is only
                    the tap a finger reaches for

                */}
                {open
                    ? <div className='phone-menu-scrim' aria-hidden='true' onClick={this.closeMenu} />
                    : null}
                <Navbar.Collapse id='phone-menu'>
                    <PhoneMenu onClose={this.closeMenu} />
                </Navbar.Collapse>
            </Navbar>
        )
    }
    renderContent() {
        const desktopMenu = this.showDesktopHeader();
        const mobileMenu = this.showMobileHeader();

        if (
            !!this.props &&
            !!this.props.layout &&
            !!this.props.layout.type &&
            this.props.layout.type == 'login'
        ) {
            return (
                <nav className='main-navigation menu-login'>
                    <div className='col-sm-12'>
                        <HomeLink />
                        <ThemeToggle className='theme-toggle-corner' />
                    </div>
                </nav>
            );
        } else if (
            !!this.props &&
            !!this.props.layout &&
            !!this.props.layout.type &&
            this.props.layout.type == 'register'
        ) {
            return (
                <nav className='main-navigation menu-register'>
                    <div className='col-sm-12'>
                        <HomeLink />
                        <ThemeToggle />
                        <LoginLinkState />
                    </div>
                </nav>
            );
        }
        return (
            <BreakpointRender
                breakpoints={breakpoints}
                type='viewport'
            >
                {bp => ( bp.isGt('small') ? desktopMenu : mobileMenu )}
            </BreakpointRender>
        );
    }
    // display result
    render() {
        const selectedContent = this.renderContent();
        return (selectedContent);
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default HeaderMenu;

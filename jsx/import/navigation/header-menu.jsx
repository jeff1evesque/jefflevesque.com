/**
 * header-menu.jsx: anonymous users.
 *
 * Note: this script implements jsx (reactjs) syntax.
 */

import React, { Component } from 'react';
import SvgHome from '../svg/svg-home.jsx';
import SvgBooks from '../svg/svg-books.jsx';
import SvgUser from '../svg/svg-user.jsx';
import SvgPencilNote from '../svg/svg-pencil-note.jsx';
import { Link, NavLink, useLocation } from 'react-router-dom'
import HomeLink from './menu-items/home.jsx';
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
    { to: '/graph', label: 'Training graph' },
    { to: '/graph/retrieval', label: 'Retrieval graph' },
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

    showDesktopHeader() {
        return (
            <Navbar collapseOnSelect expand='lg' className='main-navigation menu-home-desktop'>
                <div className='row main-navigation-row'>
                    <div className='col-sm-2 home'>
                        <Navbar.Brand><Link to='/'><SvgHome /></Link></Navbar.Brand>
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
                                <LoginLinkState />
                                <RegisterLinkState />
                            </div>
                        </div>
                    </div>
                </div>
            </Navbar>
        )
    }

    showMobileHeader() {
        const session = (
            <span>
                <span><SvgBooks /></span>
                <span className='menu-label'>{'Session'}</span>
            </span>
        );

        return (
            <Navbar collapseOnSelect expand='lg' className='main-navigation menu-home menu-home-mobile'>
                <Navbar.Brand><Link to='/'><SvgHome /></Link></Navbar.Brand>
                <Navbar.Toggle aria-controls='basic-navbar-nav' />
                <Navbar.Collapse id='mr-auto'>
                    <NavDropdown
                        id='basic-nav-dropdown'
                        className='session'
                        title={session}
                    >
                        <NavDropdown.Item href='/stream'>{'Stream'}</NavDropdown.Item>
                        <NavDropdown.Item href='/data'>{'Data'}</NavDropdown.Item>
                        {/*

                            the Graph section is two pages, so its one entry
                            becomes a heading over two. A dropdown inside this
                            dropdown would be a menu a phone cannot hold open
                            while the reader moves between them.

                        */}
                        <NavDropdown.Header>{'Graph'}</NavDropdown.Header>
                        {GRAPH_PAGES.map((page) => (
                            <NavDropdown.Item key={page.to} className='menu-sub-item' href={page.to}>
                                {page.label}
                            </NavDropdown.Item>
                        ))}
                        <NavDropdown.Item href='/model'>{'Model'}</NavDropdown.Item>
                    </NavDropdown>
                    <Nav>
                        <Link to='/login' className='login'>
                            <div className='nav-item'>
                                <span><SvgUser /></span>
                                <span className='menu-label'>{'Login'}</span>
                            </div>
                        </Link>
                        <Link to='/register' className='register'>
                            <div className='nav-item'>
                                <span><SvgPencilNote /></span>
                                <span className='menu-label'>{'Register'}</span>
                            </div>
                        </Link>
                    </Nav>
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
                    <div className='col-sm-12'><HomeLink /></div>
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

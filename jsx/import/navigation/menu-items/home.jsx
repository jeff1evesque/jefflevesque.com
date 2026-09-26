/**
 * home.jsx: home menu markup.
 *
 * @HomeLink, must be capitalized in order for reactjs to render it as a
 *     component. Otherwise, the variable is rendered as a dom node.
 *
 * Note: this script implements jsx (reactjs) syntax.
 */

import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import SvgHome from '../../svg/svg-home.jsx';
import { themeColors } from '../../general/colors.js';
import { ThemeModeContext } from '../../general/theme-mode.jsx';

//
// the house in the page's own dark gray, which on a dark page is a light one:
// this link sits on the page, where the header's house sits on its bar.
//
const HomeLink = () => {
    const { theme } = useContext(ThemeModeContext);

    return (
        <NavLink
            activeclassname='active'
            className='icon home'
            to='/'
        >
            <SvgHome houseColor={themeColors(theme)['gray-7']} />
        </NavLink>
    );
};

// indicate which class can be exported, and instantiated via 'require'
export default HomeLink;

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

//
// the house on the header's bar, linking home. On the home page itself its roof
// keeps the green it takes under the pointer, so the bar says where the reader
// is, as the section links beside it do. On every other page the roof is gray
// until pointed at, as it always was.
//
// Note: a NavLink rather than a Link, for the one thing a Link cannot tell: that
//       the page on screen is the one it links to. `end` keeps that to the home
//       page alone, and the link says so to assistive technology as well, with
//       the aria-current a NavLink sets.
//
export const HomeBrand = () => (
    <NavLink to='/' end>
        {({ isActive }) => <SvgHome active={isActive} />}
    </NavLink>
);

// indicate which class can be exported, and instantiated via 'require'
export default HomeLink;

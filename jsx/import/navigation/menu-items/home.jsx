/**
 * home.jsx: home menu markup.
 *
 * @HomeBrand, must be capitalized in order for reactjs to render it as a
 *     component. Otherwise, the variable is rendered as a dom node.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: the house the sign-in and sign-up pages drew on the page itself, in the
 *       page's own dark gray, went with their bare headers (#179). Every page
 *       wears the header's house now.
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import SvgHome from '../../svg/svg-home.jsx';

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
export default HomeBrand;

/**
 * svg-exit.jsx: append exit icon.
 *
 * @SvgExit, must be capitalized in order for reactjs to render it as a
 *     component. Otherwise, the variable is rendered as a dom node.
 *
 * Note: this script implements jsx (reactjs) syntax.
 */

import { themeColors } from '../general/colors.js';
import React, { Component } from 'react';
import checkValidString from '../validator/valid-string.js';
import { ThemeModeContext } from '../general/theme-mode.jsx';

class SvgExit extends Component {
    //
    // the page's theme: the icon sits on the page, pale at rest and toward the
    // text under the pointer, which on a dark page is the other way round. See
    // themeColors.
    //
    static contextType = ThemeModeContext;

    constructor() {
        super();
        this.state = {
            hover: false,
            height: '36px',
            width: '36px',
            view_box: '0 0 32 32'
        }
        this.handleMouseOver = this.handleMouseOver.bind(this);
        this.handleMouseOut = this.handleMouseOut.bind(this);
    }

    handleMouseOver(event) {
        this.setState({ hover: true });
    }

    handleMouseOut(event) {
        this.setState({ hover: false });
    }

    componentDidMount() {
        if (
            'height' in this.props
            && checkValidString(this.props.height)
        ) {
            this.setState({ height: this.props.height});
        }

        if (
            'width' in this.props
            && checkValidString(this.props.width)
        ) {
            this.setState({ width: this.props.width});
        }

        if (
            'view_box' in this.props
            && checkValidString(this.props.view_box)
        ) {
            this.setState({ view_box: this.props.view_box});
        }
    }

    render() {
        const shade = themeColors(this.context.theme);

        return(
            <svg
                height={this.state.height}
                onMouseOut={this.handleMouseOut}
                onMouseOver={this.handleMouseOver}
                preserveAspectRatio='xMidYMid meet'
                version='1.1'
                viewBox={this.state.view_box}
                width={this.state.width}
                xmlns='http://www.w3.org/2000/svg'
            >
                <path
                    d={`M24 9.4L22.6 8L16 14.6L9.4 8L8 9.4l6.6 6.6L8 22.6L9.4 24l6.6-6.6l6.6 6.6l1.4-1.4l-6.6-6.6L24 9.4z`}
                    fill={this.state.hover ? shade['gray-7'] : shade['gray-5']}
                />
            </svg>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default SvgExit;

/**
 * svg-exit.jsx: append exit icon.
 *
 * @SvgExit, must be capitalized in order for reactjs to render it as a
 *     component. Otherwise, the variable is rendered as a dom node.
 *
 * Note: this script implements jsx (reactjs) syntax.
 */

import { colors } from '../general/colors.js';
import React, { Component } from 'react';
import checkValidString from '../validator/valid-string.js';

class SvgExit extends Component {
    constructor() {
        super();
        this.state = {
            body_color: colors['gray-5'],
            height: '36px',
            width: '36px',
            view_box: '0 0 32 32'
        }
        this.handleMouseOver = this.handleMouseOver.bind(this);
        this.handleMouseOut = this.handleMouseOut.bind(this);
    }

    handleMouseOver(event) {
        this.setState({ body_color: colors['gray-7'] });
    }

    handleMouseOut(event) {
        this.setState({ body_color: colors['gray-5'] });
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
                    fill={this.state.body_color}
                />
            </svg>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default SvgExit;

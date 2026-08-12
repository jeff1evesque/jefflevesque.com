/**
 * svg-order.jsx: append order icon.
 *
 * @Svgorder, must be capitalized in order for reactjs to render it as a
 *     component. Otherwise, the variable is rendered as a dom node.
 *
 * Note: this script implements jsx (reactjs) syntax.
 */

import { colors } from '../general/colors.js';
import React, { Component } from 'react';

class SvgOrder extends Component {
    constructor() {
        super();
        this.state = {
            outer_color: colors['gray-6'],
            height: '100%',
            ascend: false
        }
        this.handleMouseOver = this.handleMouseOver.bind(this);
        this.handleMouseOut = this.handleMouseOut.bind(this);
        this.getSvgPath = this.getSvgPath.bind(this);
    }

    componentDidMount() {
        if ('ascend' in this.props) {
            this.setState({ ascend: this.props.ascend });
        } else

        if ('hover_bg' in this.props && !this.props.hover_bg) {
            this.setState({ mouse_over_color: colors['green-3'] });
        } else {
            this.setState({ mouse_over_color: this.state.outer_color });
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (
            'ascend' in this.props
            && 'ascend' in prevProps
            && this.props.ascend !== prevProps.ascend
        ) {
            this.setState({ ascend: this.props.ascend });
        }
    }

    handleMouseOver(event) {
        this.setState({ outer_color: this.state.mouse_over_color });
    }

    handleMouseOut(event) {
        this.setState({ outer_color: colors['gray-6'] });
    }

    getSvgPath() {
        if (this.state.ascend) {
            return(`
                M383.01 379.71c11.57 0 20.97 9.4 20.97 20.97 0 11.57-9.4
                20.97-20.97 20.97l-362.04-.44C9.4 421.21 0 411.81 0 400.24c0
                -11.57 9.4-20.97 20.97-20.97l362.04.44zm-90.97-238.93c-7.91
                7.94-20.8 7.99-28.74.08-7.94-7.91-7.99-20.8-.08-28.74L369.33
                5.98c7.91-7.94 20.79-7.99 28.73-.08l107.98 107.91c7.95 7.94
                7.95 20.87 0 28.81-7.94 7.95-20.87 7.95-28.81 0l-73.12-73.11.32
                206.4c0 11.2-9.1 20.3-20.3 20.3-11.2 0-20.29-9.1-20.29-20.3l
                -.32-206.63-71.48 71.5zM171.62 40.59c11.57 0 20.97 9.41 20.97
                20.98 0 11.56-9.4 20.97-20.97 20.97l-150.65-.16C9.4 82.38 0
                72.97 0 61.4c0-11.56 9.4-20.97 20.97-20.97l150.65.16zm41.33
                170.71c11.57 0 20.97 9.4 20.97 20.97 0 11.57-9.4 20.97-20.97
                20.97l-191.98-.23C9.4 253.01 0 243.61 0 232.04c0-11.56 9.4
                -20.97 20.97-20.97l191.98.23z
            `);
        } else {
            return(`
                M383.01 0c11.57 0 20.97 9.4 20.97 20.97 0 11.57-9.4 20.97
                -20.97 20.97l-362.04.44C9.4 42.38 0 32.97 0 21.4 0 9.84
                9.4.43 20.97.43L383.01 0zM263.22 309.53c-7.91-7.95-7.86
                -20.83.08-28.74s20.83-7.86 28.74.08l71.48 71.5.32-206.63c0
                -11.2 9.09-20.3 20.29-20.3s20.3 9.1 20.3 20.3l-.32 206.4
                73.12-73.12c7.94-7.94 20.87-7.94 28.81 0 7.95 7.95 7.95
                20.88 0 28.82l-107.9 107.9c-8.02 7.91-20.9 7.87-28.81
                -.08L263.22 309.53zm-91.6 29.58c11.57 0 20.97 9.4 20.97
                20.97 0 11.57-9.4 20.97-20.97 20.97l-150.65.16C9.4 381.21
                0 371.81 0 360.24c0-11.56 9.4-20.97 20.97-20.97l150.65
                -.16zm41.33-170.7c11.57 0 20.97 9.4 20.97 20.97 0 11.57
                -9.4 20.97-20.97 20.97l-191.98.23C9.4 210.58 0 201.17 0
                189.6c0-11.56 9.4-20.97 20.97-20.97l191.98-.22z
            `);
        }
    }

    render() {
        return(
            <svg
                xmlns='http://www.w3.org/2000/svg'
                shapeRendering='geometricPrecision'
                textRendering='geometricPrecision'
                imageRendering='optimizeQuality'
                fillRule='evenodd'
                clipRule='evenodd'
                height={this.state.height}
                onMouseOut={this.handleMouseOut}
                onMouseOver={this.handleMouseOver}
                preserveAspectRatio='xMidYMid meet'
                version='1.1'
                viewBox='0 0 512 421.65'
            >
                <path
                    d={this.getSvgPath()}
                    fillRule='nonzero'
                    fill={this.state.outer_color}
                />
            </svg>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default SvgOrder;

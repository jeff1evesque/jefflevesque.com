/**
 * aggregate-model-workflow.jsx: stream trigger svg.
 *
 * @AggregateModelWorkflow, must be capitalized in order for reactjs to render it as a
 *     component. Otherwise, the variable is rendered as a dom node.
 *
 * Note: this script implements jsx (reactjs) syntax.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import checkValidString from '../../validator/valid-string.js';

class AggregateModelWorkflow extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        image_id: PropTypes.string,
    }

    constructor(props) {
        super(props);

        if ('image_id' in this.props && checkValidString(this.props.image_id)) {
            var image_id = this.props.image_id;
        } else {
            var image_id = 'AggregateModelWorkflow';
        }

        this.state = {
            image_id: image_id
        }
    }

    render() {
        const font_family = {
            fontFamily:'ArialMT, Arial, sans-serif',
            fontSize:'46.376px',
            fill:'white'
        };

        const font_family_smaller = {
            fontFamily:'ArialMT, Arial, sans-serif',
            fontSize:'32px',
            fill:'white'
        };

        const arrow_style = {
            fill:'none',
            stroke:'rgb(0,0,0)',
            strokeWidth:'5.47px',
            strokeLinecap:'round',
            strokeLinejoin:'miter',
            strokeMiterlimit:10
        };

        const avatar_rectangle_style = {
            fill:'none',
            stroke:'rgb(255,255,255)',
            strokeWidth:'7.2px'
        };

        return(
            <svg
                width='100%'
                height='100%'
                viewBox='0 0 1221 653'
                version='1.1'
                xmlns='http://www.w3.org/2000/svg'
                xmlnsXlink='http://www.w3.org/1999/xlink'
                xmlSpace='preserve'
                xmlnsserif='http://www.serif.com/'
                style={{fillRule:'evenodd',clipRule:'evenodd',strokeLinecap:'round',strokeLinejoin:'round',strokeMiterlimit:1.5,padding:'0 1.25rem 0 1.25rem'}}
            >
                <g transform='matrix(1,0,0,1,-36.4583,-1139.32)'>
                    <g id='AggregateModelWorkflow' transform='matrix(1.82292,0,0,1.82292,-145.833,1139.32)'>
                        <g id='Avatar' transform='matrix(1,0,0,1,215.406,0)'>
                            <g id='OuterRectangle' transform='matrix(0.746769,0,0,0.676514,403.099,46.225)'>
                                <rect x='124.404' y='153.397' width='77.668' height='85.734'/>
                            </g>
                            <g transform='matrix(0.138889,0,0,0.138889,500.003,154.121)'>
                                <clipPath id={`_clip_${this.state.image_id}`}>
                                    <rect x='0' y='0' width='360' height='360'/>
                                </clipPath>
                                <g clipPath={`url(#_clip_${this.state.image_id})`}>
                                    <g transform='matrix(3.94971,-0,-0,3.94971,-4430.94,-1109.67)'>
                                        <use xlinkHref={`#_${this.state.image_id}`} x='1121.84' y='280.95' width='92px' height='92px'/>
                                    </g>
                                </g>
                                <rect x='0' y='0' width='360' height='360' style={avatar_rectangle_style}/>
                            </g>
                        </g>
                        <g id='SymbolNotification' transform='matrix(1,0,0,1,453.859,0.62499)'>
                            <g id='OuterRectangle1' serifid='OuterRectangle' transform='matrix(0.746769,0,0,0.676514,27.5029,45.6217)'>
                                <rect x='124.404' y='153.397' width='77.668' height='85.734' style={{fill:'rgb(255,138,231)'}}/>
                            </g>
                            <g id='InnerRectangle' transform='matrix(0.643766,0,0,0.583201,44.3168,63.9355)'>
                                <rect x='124.404' y='153.397' width='77.668' height='85.734' style={{fill:'rgb(64,0,255)'}}/>
                            </g>
                            <g id='Icon' transform='matrix(1,0,0,1,6,7)'>
                                <text x='127.575px' y='187.858px' style={font_family}>N</text>
                            </g>
                        </g>
                        <g id='SymbolModel' transform='matrix(1,0,0,1,316.716,0.62499)'>
                            <g id='OuterRectangle2' serifid='OuterRectangle' transform='matrix(0.746769,0,0,0.676514,27.5029,45.6217)'>
                                <rect x='124.404' y='153.397' width='77.668' height='85.734' style={{fill:'rgb(255,147,0)'}}/>
                            </g>
                            <g id='InnerRectangle1' serifid='InnerRectangle' transform='matrix(0.643766,0,0,0.583201,44.3168,63.9355)'>
                                <rect x='124.404' y='153.397' width='77.668' height='85.734' style={{fill:'rgb(163,29,40)'}}/>
                            </g>
                            <g id='Icon1' serifid='Icon' transform='matrix(1,0,0,1,2,7)'>
                                <text x='127.575px' y='187.858px' style={font_family}>M</text>
                            </g>
                        </g>
                        <g id='SymbolTriggerAggregate' transform='matrix(1,0,0,1,179.596,0.603276)'>
                            <g id='OuterRectangle3' serifid='OuterRectangle' transform='matrix(0.746769,0,0,0.676514,27.5029,45.6217)'>
                                <rect x='124.404' y='153.397' width='77.668' height='85.734' style={{fill:'rgb(0,255,37)'}}/>
                            </g>
                            <g id='InnerRectangle2' serifid='InnerRectangle' transform='matrix(0.643766,0,0,0.583201,44.3168,63.9355)'>
                                <rect x='124.404' y='153.397' width='77.668' height='85.734' style={{fill:'rgb(10,94,16)'}}/>
                            </g>
                            <g id='Icon2' serifid='Icon' transform='matrix(1,0,0,1,2.15632,2.55415)'>
                                <text x='127.575px' y='187.858px' style={font_family_smaller}>T<tspan x='144.747px ' y='187.858px '>A</tspan></text>
                            </g>
                        </g>
                        <g id='Arrows'>
                            <g id='Arrow4' transform='matrix(0.540181,0,0,1,548.942,4)'>
                                <g transform='matrix(1.01553,-0,-0,0.548571,-831.096,-4)'>
                                    <path d='M1100.43,319.019L1108.67,327.186L1100.51,335.426' style={arrow_style}/>
                                    <path d='M975.542,327.786C975.542,327.786 1086.41,327.286 1108.67,327.186' style={arrow_style}/>
                                </g>
                            </g>
                            <g id='Arrow3' transform='matrix(0.540181,0,0,1,411.799,4)'>
                                <g transform='matrix(1.01553,-0,-0,0.548571,-577.213,-4)'>
                                    <path d='M850.435,319.019L858.675,327.186L850.509,335.426' style={arrow_style}/>
                                    <path d='M725.542,327.786C725.542,327.786 836.409,327.286 858.675,327.186' style={arrow_style}/>
                                </g>
                            </g>
                            <g id='Arrow2' transform='matrix(0.540184,0.00112189,0.00112348,0.999997,274.459,3.82143)'>
                                <g transform='matrix(1.01553,-0.00113932,-0.00114093,0.548574,-322.954,-3.45912)'>
                                    <path d='M600.452,319.279L608.675,327.462L600.492,335.685' style={arrow_style}/>
                                    <path d='M475.542,327.786C475.542,327.786 586.409,327.516 608.675,327.462' style={arrow_style}/>
                                </g>
                            </g>
                            <g id='Arrow1' transform='matrix(1,0,0,1,0.901662,4)'>
                                <g transform='matrix(0.548571,-0,-0,0.548571,99.0983,-4)'>
                                    <path d='M351.815,318.994L360.038,327.178L351.855,335.401' style={arrow_style}/>
                                    <path d='M110.286,327.786C110.286,327.786 328.184,327.255 360.038,327.178' style={arrow_style}/>
                                </g>
                            </g>
                            <g id='BottomAngle' transform='matrix(1,0,0,1,80,-350)'>
                                <g transform='matrix(0.548571,-0,-0,0.548571,20,350)'>
                                    <path d='M410.356,395.404L418.536,387.177L426.762,395.357' style={arrow_style}/>
                                    <path d='M111.264,600.048L419.152,601.92L418.525,383.31L419.152,601.92C419.152,601.92 418.62,416.442 418.536,387.177' style={arrow_style}/>
                                </g>
                            </g>
                            <g id='TopAngle' transform='matrix(0.983868,0,0,1.0496,82.2583,-369.445)'>
                                <g transform='matrix(0.557566,-0,-0,0.52265,18.0326,351.987)'>
                                    <path d='M423.996,257.487L415.796,265.692L407.59,257.492' style={arrow_style}/>
                                    <path d='M107.552,56.362L415.728,56.074C415.728,56.074 415.786,236.824 415.796,265.692' style={arrow_style}/>
                                </g>
                            </g>
                        </g>
                        <g id='SymbolTriggerBottom' transform='matrix(1,0,0,1,-20.4037,0.603276)'>
                            <g id='OuterRectangle4' serifid='OuterRectangle' transform='matrix(0.746769,0,0,0.676514,27.5029,45.6217)'>
                                <rect x='124.404' y='153.397' width='77.668' height='85.734' style={{fill:'rgb(69,236,255)'}}/>
                            </g>
                            <g id='InnerRectangle3' serifid='InnerRectangle' transform='matrix(0.643766,0,0,0.583201,44.3168,63.9355)'>
                                <rect x='124.404' y='153.397' width='77.668' height='85.734' style={{fill:'rgb(19,57,234)'}}/>
                            </g>
                            <g id='Icon3' serifid='Icon' transform='matrix(1,0,0,1,7.64571,7)'>
                                <text x='127.575px' y='187.858px' style={font_family}>T</text>
                            </g>
                        </g>
                        <g id='SymbolTriggerCenter' transform='matrix(1,0,0,1,-20.4037,-149.397)'>
                            <g id='OuterRectangle5' serifid='OuterRectangle' transform='matrix(0.746769,0,0,0.676514,27.5029,45.6217)'>
                                <rect x='124.404' y='153.397' width='77.668' height='85.734' style={{fill:'rgb(69,236,255)'}}/>
                            </g>
                            <g id='InnerRectangle4' serifid='InnerRectangle' transform='matrix(0.643766,0,0,0.583201,44.3168,63.9355)'>
                                <rect x='124.404' y='153.397' width='77.668' height='85.734' style={{fill:'rgb(19,57,234)'}}/>
                            </g>
                            <g id='Icon4' serifid='Icon' transform='matrix(1,0,0,1,7.64571,7)'>
                                <text x='127.575px' y='187.858px' style={font_family}>T</text>
                            </g>
                        </g>
                        <g id='SymbolTriggerTop' transform='matrix(1,0,0,1,-20.4037,150.603)'>
                            <g id='OuterRectangle6' serifid='OuterRectangle' transform='matrix(0.746769,0,0,0.676514,27.5029,45.6217)'>
                                <rect x='124.404' y='153.397' width='77.668' height='85.734' style={{fill:'rgb(69,236,255)'}}/>
                            </g>
                            <g id='InnerRectangle5' serifid='InnerRectangle' transform='matrix(0.643766,0,0,0.583201,44.3168,63.9355)'>
                                <rect x='124.404' y='153.397' width='77.668' height='85.734' style={{fill:'rgb(19,57,234)'}}/>
                            </g>
                            <g id='Icon5' serifid='Icon' transform='matrix(1,0,0,1,7.64571,7)'>
                                <text x='127.575px' y='187.858px' style={font_family}>T</text>
                            </g>
                        </g>
                    </g>
                </g>
                <defs>
                    <image id={`_${this.state.image_id}`} width='92px' height='92px' xlinkHref='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCABcAFwDAREAAhEBAxEB/8QAGwABAAICAwAAAAAAAAAAAAAAAAcIBgkBBAX/xAAuEAABAwMCBAQHAAMAAAAAAAABAAIDBAURBgcIEiExE0FRYRgiMlZxldIjgYL/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AuWgICAgICAgICAgICAgICAgICAgICAgICAgICAg69yrqK2UE1fcqyno6SBpfNPPII442juXOPQD3KCGr1xSbRW6vbSxXW4XEZw+akoXmNhzjqX8pP5aCgkTb7cTRevqSSo0nf6W5eCf8sQDo5o/d0bwHgehxg+RQZSgICAgICAgICCi/HDuPcL3uBJoajqXx2azBnjxsd8s9S5ocXO9eUODQPIhx80FckHs6L1LeNIamotQ2KrfS11HIHscCcOHmxw82kdCPMFBtD0PqCn1Vo6z6kpWeHDc6OKqEfPzeGXtBLCR3LSSD7hB7KAgICAgICAg1w8Wdgq7DvxqIVLH+FcJW19O8jAeyQAnH4cHt/wCUEUIOUGz3YXT9TpbZzS1krWyMqoKBj545G4dHJJmRzCPVpeW/6QZugICAgICAgIIr4htutE7h2eit+o7vSWW7+IY7VWvkY2TnPeMNcR4jTjPKOvTIIQVavHCdunR15hoRZrlTk/LURVnIMe7XgEH8ZQSdsxw4WLRGpLZedytRWepujpgbba2TBsT5R8wOX4MrhjPKG46ZOR0QWrQEBAQEBAQEEN8TO9dJtZZYqG3MhrNS18ZdSwPOWQR5x40gHXGcgDpzEH0KCgmq9R33VV6mvOorpU3KumPzSzvzgZzytHZrRk4aMAeQQd+37ga8t9Iyjt+ttS0lMxvKyGC6TsY0egaHYAQeLdLjcLrWvrbpX1VdVPxzzVErpHux6ucSSgsVwzcRl00/caTSmu6+SusUzxFBcKiTmloST05nH6ovz1aOxwMILvtcHNDmkEHqCEHKAgICAg612r6S1WqrulfM2Cko4Hzzyu7MjY0uc4/gAlBq13K1ZX651zdtU3IkTV85e2PORFGOjIwemQ1oa3PnjPcoMdQEBAQX74I9dy6r2rNir5xJcNOyNpck/M6mcMwk9PIB7B7RjPdBPSAgICAgxrdSx3HU22+odPWmqjpa642+amhkk+jL2kYdjsCCQT1wDnqgos/hh3la8tGm6Z4BwHC5U+D79XoOPhi3m+2af9lT/wBoHwxbzfbNP+yp/wC0D4Yt5vtmn/ZU/wDaB8MW832zT/sqf+0FgODraPXG3Nyv1x1XHTUUNdBHDHSRztlc5zXE85LcgAAkDrk8x7Y6hY9AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEH/2Q=='/>
                </defs>
            </svg>
        )
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default AggregateModelWorkflow;

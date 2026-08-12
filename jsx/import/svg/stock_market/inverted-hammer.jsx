/**
 * inverted-hammer.jsx: render candlestick svg.
 *
 * @InvertedHammer, must be capitalized in order for reactjs to render it as a
 *     component. Otherwise, the variable is rendered as a dom node.
 *
 * Note: this script implements jsx (reactjs) syntax.
 */

import React, { Component } from 'react';

class InvertedHammer extends Component {
    constructor() {
        super();
    }

    render() {
        const font_family = {
            fontFamily:'Arial-BoldMT, Arial, sans-serif',
            fontWeight:700,
            fontSize:'26.667px'
        };

        const font_family_smaller = {
            fontFamily:'Arial-BoldMT, Arial, sans-serif',
            fontWeight: 700,
            fontSize:'21.333px'
        };

        const arrow_style = {
            fill:'none',
            stroke:'rgb(128,128,128)',
            strokeWidth:'2.5px'
        };

        return(
            <svg
                width='100%'
                height='100%'
                viewBox='0 0 691 495'
                version='1.1'
                xmlns='http://www.w3.org/2000/svg'
                xmlnsXlink='http://www.w3.org/1999/xlink'
                xmlSpace='preserve'
                xmlnsserif='http://www.serif.com/'
                style={{fillRule:'evenodd',clipRule:'evenodd',strokeLinecap:'round',strokeLinejoin:'round',strokeMiterlimit:1.5,padding:'0 1.25rem 0 1.25rem'}}
            >
                <g transform='matrix(1,0,0,1,-165.86,-236.813)'>
                    <g id='InvertedHammer'>
                        <g id='CenterCandleSticks' transform='matrix(0.956016,0,0,0.971814,168.545,26.457)'>
                            <g opacity='0.1'>
                                <g id='LeftVerticalLine' transform='matrix(-0.00256896,-4.07543,-1.2603,0.000768821,703.789,1018.96)'>
                                    <path d='M83.26,351.206C82.981,351.206 82.755,351.95 82.755,352.866C82.755,353.782 82.981,354.526 83.26,354.526C117.235,354.526 151.761,354.028 185.526,354.028C185.804,354.028 186.031,353.284 186.031,352.368C186.031,351.452 185.804,350.708 185.526,350.708C151.761,350.708 117.235,351.206 83.26,351.206Z'/>
                                </g>
                                <g id='RightVerticalLine' transform='matrix(-0.00256896,-4.07543,-1.2603,0.000768821,900.439,1018.96)'>
                                    <path d='M83.26,351.206C82.981,351.206 82.755,351.95 82.755,352.866C82.755,353.782 82.981,354.526 83.26,354.526C117.235,354.526 151.761,354.028 185.526,354.028C185.804,354.028 186.031,353.284 186.031,352.368C186.031,351.452 185.804,350.708 185.526,350.708C151.761,350.708 117.235,351.206 83.26,351.206Z'/>
                                </g>
                                <g id='LeftBox' transform='matrix(1,0,0,2.969,-9.41407,-1434.43)'>
                                    <rect x='218.687' y='606.666' width='100.615' height='62.787' style={{fill:'rgb(128,128,128)'}}/>
                                </g>
                                <g id='RightBox' transform='matrix(1,0,0,1.30587,187.235,-381.7)'>
                                    <rect x='218.687' y='606.666' width='100.615' height='62.787' style={{fill:'rgb(128,128,128)'}}/>
                                </g>
                            </g>
                        </g>
                        <g id='TopLabels'>
                            <g id='Long-Upper-Whisker' serifid='Long Upper Whisker' transform='matrix(1,0,0,1,21.5427,-50.5171)'>
                                <g transform='matrix(1,0,0,1,411.535,326.419)'>
                                    <text x='0px' y='0px' style={font_family}>Long Upper</text>
                                </g>
                                <g transform='matrix(1,0,0,1,434.472,357.086)'>
                                    <text x='0px' y='0px' style={font_family}>Whisker</text>
                                </g>
                            </g>
                            <g transform='matrix(1.36788,-0.00078015,-6.82291e-05,1,-156.135,0.331003)'>
                                <g id='TopLeftArrow'>
                                    <g>
                                        <path d='M326.805,257.079L314.801,263.07L326.797,269.079L326.805,257.079Z' style={{fill:'rgb(128,128,128)'}}/>
                                        <path d='M324.401,263.077L424.457,263.151' style={arrow_style}/>
                                    </g>
                                </g>
                            </g>
                            <g transform='matrix(1.36956,-2.10078e-09,-1.37559e-09,0.999998,-219.207,2.93345e-05)'>
                                <g id='TopRightArrow'>
                                    <g>
                                        <path d='M690.663,270.488L702.673,264.507L690.683,258.488L690.663,270.488Z' style={{fill:'rgb(128,128,128)'}}/>
                                        <path d='M693.073,264.492L593.149,264.33' style={arrow_style}/>
                                    </g>
                                </g>
                            </g>
                        </g>
                        <g id='BottomLabels'>
                            <g transform='matrix(1.36788,-0.00078015,-6.82291e-05,1,-156.135,440.331)'>
                                <g id='BottomLeftArrow'>
                                    <g>
                                        <path d='M326.805,257.079L314.801,263.07L326.797,269.079L326.805,257.079Z' style={{fill:'rgb(128,128,128)'}}/>
                                        <path d='M324.401,263.077L424.457,263.151' style={arrow_style}/>
                                    </g>
                                </g>
                            </g>
                            <g transform='matrix(1.36956,-2.10078e-09,-1.37559e-09,0.999998,-219.207,440)'>
                                <g id='BottomRightArrow'>
                                    <g>
                                        <path d='M690.663,270.488L702.673,264.507L690.683,258.488L690.663,270.488Z' style={{fill:'rgb(128,128,128)'}}/>
                                        <path d='M693.073,264.492L593.149,264.33' style={arrow_style}/>
                                    </g>
                                </g>
                            </g>
                            <g id='Label' transform='matrix(1,0,0,1,23.5427,356.483)'>
                                <g transform='matrix(1,0,0,1,411.535,326.419)'>
                                    <g transform='matrix(26.667,0,0,26.667,145.158,0)'>
                                    </g>
                                    <text x='0px' y='0px' style={font_family}>Short to No</text>
                                </g>
                                <g transform='matrix(1,0,0,1,434.472,357.086)'>
                                    <text x='0px' y='0px' style={font_family}>Whisker</text>
                                </g>
                            </g>
                        </g>
                        <g id='LeftCandleStick' transform='matrix(1,0,0,1,-46,0)'>
                            <g id='LeftVerticalLine1' serifid='LeftVerticalLine' transform='matrix(0.000482169,-3.9604,1.3028,0.000158613,-184.803,1016.4)'>
                                <path d='M83.26,354.401C82.981,354.401 82.755,353.713 82.755,352.866C82.755,352.019 82.981,351.331 83.26,351.331C117.235,351.331 151.761,350.832 185.526,350.832C185.804,350.832 186.031,351.52 186.031,352.368C186.031,353.215 185.804,353.903 185.526,353.903C151.761,353.903 117.235,354.401 83.26,354.401Z'/>
                            </g>
                            <g id='GreenBox' transform='matrix(0.956016,0,0,0.971814,21.6187,-30.9008)'>
                                <rect x='218.687' y='606.666' width='100.615' height='62.787' style={{fill:'rgb(39,154,42'}}/>
                            </g>
                            <g transform='matrix(1,0,0,1,248.436,708.728)'>
                                <g id='Low'>
                                    <text x='0px' y='0px' style={font_family}>Low</text>
                                </g>
                            </g>
                            <g id='High' transform='matrix(1,0,0,1,143.749,-78.1766)'>
                                <g transform='matrix(1,0,0,1,102.949,349.55)'>
                                    <text x='0px' y='0px' style={font_family}>High</text>
                                </g>
                                <g id='CloseOpen' transform='matrix(1,0,0,1,95.1478,100.948)'>
                                    <g transform='matrix(1,0,0,1,98.036,553.176)'>
                                        <text x='0px' y='0px' style={font_family_smaller}>Close</text>
                                    </g>
                                    <g transform='matrix(1,0,0,1,98.036,593.176)'>
                                        <text x='0px' y='0px' style={font_family_smaller}>Open</text>
                                    </g>
                                </g>
                            </g>
                        </g>
                        <g id='RightCandleStick' transform='matrix(1,0,0,1,46,0)'>
                            <g id='RightVerticalLine1' serifid='RightVerticalLine' transform='matrix(-0.00245597,-3.96056,-1.20487,0.000747151,1164.98,1015.48)'>
                                <path d='M83.26,351.206C82.981,351.206 82.755,351.95 82.755,352.866C82.755,353.782 82.981,354.526 83.26,354.526C117.235,354.526 151.761,354.028 185.526,354.028C185.804,354.028 186.031,353.284 186.031,352.368C186.031,351.452 185.804,350.708 185.526,350.708C151.761,350.708 117.235,351.206 83.26,351.206Z'/>
                            </g>
                            <g id='RedBox' transform='matrix(0.956016,0,0,0.971814,484.146,24.2416)'>
                                <rect x='218.687' y='606.666' width='100.615' height='62.787' style={{fill:'rgb(213,44,19'}}/>
                            </g>
                            <g transform='matrix(1,0,0,1,712.544,271.233)'>
                                <g id='High1' serifid='High'>
                                    <text x='0px' y='0px' style={font_family}>High</text>
                                </g>
                            </g>
                            <g transform='matrix(1,0,0,1,713.935,706.923)'>
                                <g id='Low1' serifid='Low'>
                                    <text x='0px' y='0px' style={font_family}>Low</text>
                                </g>
                            </g>
                        </g>
                        <g id='OpenClose' transform='matrix(1,0,0,1,574.543,80.409)'>
                            <g transform='matrix(1,0,0,1,98.036,553.176)'>
                                <text x='0px' y='0px' style={font_family_smaller}>Open</text>
                            </g>
                            <g transform='matrix(1,0,0,1,98.036,593.176)'>
                                <text x='0px' y='0px' style={font_family_smaller}>Close</text>
                            </g>
                        </g>
                    </g>
                </g>
            </svg>
        )
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default InvertedHammer;

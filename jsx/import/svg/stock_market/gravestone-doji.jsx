/**
 * gravestone-doji.jsx: render candlestick svg.
 *
 * @GravestoneDoji, must be capitalized in order for reactjs to render it as a
 *     component. Otherwise, the variable is rendered as a dom node.
 *
 * Note: this script implements jsx (reactjs) syntax.
 */

import React, { Component } from 'react';

class GravestoneDoji extends Component {
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

        const supplement_text = {
            fontFamily:'ArialMT Arial sans-serif',
            fontSize:'16px',
            fill:'rgb(128,128,128)'
        }

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
                    <g id='GravestoneDoji'>
                        <g id='CenterCandleSticks' transform='matrix(1,0,0,1,0,-247)'>
                            <g transform='matrix(-0.000720524,-1.16193,-1.04767,0.000649667,875.723,776.153)'>
                                <g id='VerticalLine'>
                                    <path d='M83.26,351.206C82.981,351.206 82.755,351.95 82.755,352.866C82.755,353.782 82.981,354.526 83.26,354.526C117.235,354.526 151.761,354.028 185.526,354.028C185.804,354.028 186.031,353.284 186.031,352.368C186.031,351.452 185.804,350.708 185.526,350.708C151.761,350.708 117.235,351.206 83.26,351.206Z'/>
                                </g>
                            </g>
                            <g id='Box' transform='matrix(0.956016,0,0,0.0498166,249.146,641.976)'>
                                <rect x='218.687' y='606.666' width='100.615' height='62.787' style={{stroke:'black',strokeWidth:'1.48px'}}/>
                            </g>
                            <g id='CloseText' transform='matrix(1,-1.2326e-32,6.50521e-19,1,-146.094,160.12)'>
                                <text x='665.264px' y='477.937px' style={supplement_text}>open and close</text>
                                <text x='665.264px' y='494.461px' style={supplement_text}>nearly equal</text>
                            </g>
                            <g id='LowerWhisker' transform='matrix(1,-1.2326e-32,6.50521e-19,1,-181.012,251.384)'>
                                <text x='659.944px' y='477.937px' style={supplement_text}>little to no</text>
                                <text x='659.944px' y='494.461px' style={supplement_text}>lower whisker</text>
                            </g>
                            <g transform='matrix(1,0,0,1,477.967,544.224)'>
                                <g id='High'>
                                    <text x='0px' y='0px' style={font_family}>High</text>
                                </g>
                            </g>
                            <g transform='matrix(1,0,0,1,478.412,709.088)'>
                                <g id='Low'>
                                    <text x='0px' y='0px' style={font_family}>Low</text>
                                </g>
                            </g>
                            <g id='LongLowerWhisker' transform='matrix(1,0,0,1,-175.309,274.213)'>
                                <g transform='matrix(1,0,0,1,418.535,322.419)'>
                                    <text x='0px' y='0px' style={font_family}>Long Upper</text>
                                </g>
                                <g transform='matrix(1,0,0,1,441.472,353.086)'>
                                    <text x='0px' y='0px' style={font_family}>Whisker</text>
                                </g>
                                <g transform='matrix(1.00429,0.000452447,-0.000187098,0.999998,-32.6222,71.2305)'>
                                    <g id='TopRightArrow'>
                                        <g>
                                            <path d='M690.663,270.488L702.673,264.507L690.683,258.488L690.663,270.488Z' style={{fill:'rgb(128,128,128)'}}/>
                                            <path d='M693.073,264.492L593.149,264.33' style={arrow_style}/>
                                        </g>
                                    </g>
                                </g>
                            </g>
                        </g>
                        <g id='RightCandleStick' transform='matrix(1,0,0,1,296,103)'>
                            <g opacity='0.2'>
                                <g transform='matrix(-0.00198144,-3.19532,-1.03848,0.00064397,736.336,872.86)'>
                                    <g id='VerticalLine1' serifid='VerticalLine'>
                                        <path d='M83.26,351.206C82.981,351.206 82.755,351.95 82.755,352.866C82.755,353.782 82.981,354.526 83.26,354.526C117.235,354.526 151.761,354.028 185.526,354.028C185.804,354.028 186.031,353.284 186.031,352.368C186.031,351.452 185.804,350.708 185.526,350.708C151.761,350.708 117.235,351.206 83.26,351.206Z'/>
                                    </g>
                                </g>
                                <g id='Box1' serifid='Box' transform='matrix(0.956016,0,0,4.09113,113.545,-2156.53)'>
                                    <rect x='218.687' y='606.666' width='100.615' height='62.787' style={{fill:'rgb(213,44,19)'}}/>
                                </g>
                                <g id='OpenClose' transform='matrix(1,0,0,1,125,-55)'>
                                    <g id='Open' transform='matrix(1,0,0,1,303.273,397.345)'>
                                        <text x='0px' y='0px' style={font_family_smaller}>Open</text>
                                    </g>
                                    <g id='Close' transform='matrix(1,0,0,1,303.273,635.345)'>
                                        <text x='0px' y='0px' style={font_family_smaller}>Close</text>
                                    </g>
                                </g>
                            </g>
                        </g>
                        <g id='LeftCandleStick' transform='matrix(1,0,0,1,-73,104)'>
                            <g opacity='0.2'>
                                <g id='VerticalLine2' serifid='VerticalLine' transform='matrix(-0.00180131,-2.90484,-1.20487,0.00074715,847.256,848.761)'>
                                    <path d='M83.26,351.206C82.981,351.206 82.755,351.95 82.755,352.866C82.755,353.782 82.981,354.526 83.26,354.526C117.235,354.526 151.761,354.028 185.526,354.028C185.804,354.028 186.031,353.284 186.031,352.368C186.031,351.452 185.804,350.708 185.526,350.708C151.761,350.708 117.235,351.206 83.26,351.206Z'/>
                                </g>
                                <g id='Box2' serifid='Box' transform='matrix(0.956016,0,0,4.0441,165.545,-2116.9)'>
                                    <rect x='218.687' y='606.666' width='100.615' height='62.787' style={{fill:'rgb(39,154,33)'}}/>
                                </g>
                                <g id='CloseOpen' transform='matrix(1,0,0,1,-412,14)'>
                                    <g id='Close1' serifid='Close' transform='matrix(1,0,0,1,719.827,342.444)'>
                                        <text x='0px' y='0px' style={font_family_smaller}>Close</text>
                                    </g>
                                    <g id='Open1' serifid='Open' transform='matrix(1,0,0,1,721.827,572.444)'>
                                        <text x='0px' y='0px' style={font_family_smaller}>Open</text>
                                    </g>
                                </g>
                            </g>
                        </g>
                    </g>
                </g>
            </svg>
        )
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default GravestoneDoji;

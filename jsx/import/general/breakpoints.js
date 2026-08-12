/**
 * breakpoints.js: define consistent custom breakpoints.
 */

//
// rearm breakpoints match bootstrap breakpoints
//
const small_maxWidth = 576;
const medium_minWidth = 768;
const medium_maxWidth = 992;
const large_minWidth = 1200;

const breakpoints = [
    { name: 'small', maxWidth: small_maxWidth },
    { name: 'medium', minWidth: medium_minWidth, maxWidth: medium_maxWidth },
    { name: 'large', minWidth: large_minWidth },
];

const breakpoints_exact = [
    { name: 'small', maxWidth: small_maxWidth, exact: true },
    {
        name: 'medium',
        minWidth: medium_minWidth,
        maxWidth: medium_maxWidth,
        exact: true
    },
    { name: 'large', minWidth: large_minWidth, exact: true },
];

export {
    small_maxWidth,
    medium_minWidth,
    medium_maxWidth,
    large_minWidth,
    breakpoints,
    breakpoints_exact
}

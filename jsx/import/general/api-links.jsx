/**
 * api-links.jsx: where the data on a page comes from.
 *
 * Two icons beside a chart: the api's reference page on the documentation site,
 * where its requests can be tried, and the request the page made for what it is
 * drawing, which opens the raw response.
 *
 * Icons rather than text, and sized with the chart's refresh icon, because they
 * sit beside it: the charts already carry their one control as an icon in that
 * corner, and two words under the chart read as an afterthought beneath it. Each
 * icon names itself in a tooltip, and to assistive technology in its label.
 *
 * Note: the request is handed in rather than rebuilt here. A page builds its url
 *       with api-url.js for its own fetch and passes the same url to this link,
 *       so the link cannot name a request the page did not make.
 *
 * Note: both open in a new tab. The page is a chart someone may have spent a
 *       while arranging -- a stream, a rate, a month, a build -- and following a
 *       link should not throw that away.
 *
 * Note: a page drawn from MORE than one request hands them all in, each named,
 *       as `requests`, and gets an icon for each. The Retrieval graph draws a day
 *       from two answers side by side, and linking one of them would show a reader
 *       half of what the graph was drawn from.
 *
 * Note: and a request handed in beside another may carry a `mark` -- a letter
 *       drawn inside its braces. Two identical icons side by side could only be
 *       told apart by hovering each one, so the Retrieval graph marks its node
 *       types N and its edge types E. The tooltip and the label say it in full,
 *       as they did.
 */

import React from 'react';
import PropTypes from 'prop-types';
import Tooltip from '@mui/material/Tooltip';
import SvgIcon from '@mui/material/SvgIcon';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import DataObjectIcon from '@mui/icons-material/DataObject';

//
// the braces of mui's DataObject icon, as @mui/icons-material draws them, for an
// icon that adds a letter between them
//
const BRACES = 'M4 7v2c0 .55-.45 1-1 1H2v4h1c.55 0 1 .45 1 1v2c0 1.65 1.35 3 3 3h3v-2H7c-.55 0-1-.45-1-1v-2c0-1.3-.84-2.42-2-2.83v-.34C5.16 11.42 6 10.3 6 9V7c0-.55.45-1 1-1h3V4H7C5.35 4 4 5.35 4 7m17 3c-.55 0-1-.45-1-1V7c0-1.65-1.35-3-3-3h-3v2h3c.55 0 1 .45 1 1v2c0 1.3.84 2.42 2 2.83v.34c-1.16.41-2 1.52-2 2.83v2c0 .55-.45 1-1 1h-3v2h3c1.65 0 3-1.35 3-3v-2c0-.55.45-1 1-1h1v-4z';

//
// the letters a request may be marked with, as strokes in the braces' 24-unit
// box.
//
// Strokes rather than text, at close to the weight of the braces' own lines, so
// a letter is as sharp as the braces at every size and waits on no font. The
// braces leave a 12-unit square open between them -- about 10px at the 21px
// the medium icon draws at this site's 14px root -- and each letter stands 7
// units tall in it, clear of the braces' arms by more than a unit.
//
const MARKS = {
    N: 'M9.5 15.5v-7l5 7v-7',
    E: 'M14.25 8.5h-4.5v7h4.5M9.75 12h3.75',
};

function RequestIcon({ mark = null, size }) {
    if (!mark) {
        return <DataObjectIcon fontSize={size} />;
    }

    return (
        <SvgIcon fontSize={size} data-testid={`DataObject${mark}Icon`}>
            <path d={BRACES} />
            <path
                d={MARKS[mark]}
                fill='none'
                stroke='currentColor'
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={1.7}
            />
        </SvgIcon>
    );
}

RequestIcon.propTypes = {
    mark: PropTypes.oneOf(Object.keys(MARKS)),
    size: PropTypes.oneOf(['medium', 'large']).isRequired,
};

function ApiLinks({ docs, request = null, requests = null, size = 'medium' }) {
    const shown = requests || (request ? [{ url: request, label: 'This request' }] : []);

    return (
        <div className={`api-links api-links-${size}`}>
            <Tooltip title='API docs'>
                <a
                    className='api-link'
                    href={docs}
                    target='_blank'
                    rel='noopener noreferrer'
                    aria-label='API docs'
                >
                    <MenuBookIcon fontSize={size} />
                </a>
            </Tooltip>
            {shown.map(({ url, label, mark }) => (
                <Tooltip key={label} title={label}>
                    <a
                        className='api-link'
                        href={String(url)}
                        target='_blank'
                        rel='noopener noreferrer'
                        aria-label={label}
                    >
                        <RequestIcon mark={mark} size={size} />
                    </a>
                </Tooltip>
            ))}
        </div>
    );
}

ApiLinks.propTypes = {
    docs: PropTypes.string.isRequired,
    request: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    requests: PropTypes.arrayOf(PropTypes.shape({
        url: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
        label: PropTypes.string.isRequired,
        mark: PropTypes.oneOf(Object.keys(MARKS)),
    })),
    size: PropTypes.oneOf(['medium', 'large']),
};

export default ApiLinks;

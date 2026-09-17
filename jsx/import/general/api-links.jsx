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
 */

import React from 'react';
import PropTypes from 'prop-types';
import Tooltip from '@mui/material/Tooltip';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import DataObjectIcon from '@mui/icons-material/DataObject';

function ApiLinks({ docs, request = null, size = 'medium' }) {
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
            {request
                ? (
                    <Tooltip title='This request'>
                        <a
                            className='api-link'
                            href={String(request)}
                            target='_blank'
                            rel='noopener noreferrer'
                            aria-label='This request'
                        >
                            <DataObjectIcon fontSize={size} />
                        </a>
                    </Tooltip>
                )
                : null}
        </div>
    );
}

ApiLinks.propTypes = {
    docs: PropTypes.string.isRequired,
    request: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    size: PropTypes.oneOf(['medium', 'large']),
};

export default ApiLinks;

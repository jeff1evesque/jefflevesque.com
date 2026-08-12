/**
 * breadcrumbs.jsx: general breadcrumb navigation links.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import React, { Component } from 'react';
import { Box, Breadcrumbs, Typography, Link } from '@mui/material'

class BreadCrumbs extends Component {
    render() {
        const paths = window.location.pathname.split('/').slice(1);
        const breadcrumbs = [];
        paths.map((p, index) => {
            breadcrumbs.push({
                title: p,
                link: `/${paths.slice(0, index + 1).join('/')}`,
            })
        });

        return (
            <Breadcrumbs aria-label='breadcrumb'>{
                breadcrumbs && breadcrumbs.map((b, index) =>
                    index !== breadcrumbs.length - 1 ? (
                        <Box key={b.title}>
                            <Link underline='hover' className='breadcrumb-inactive' href={b.link}>
                                {b.title}
                            </Link>
                        </Box>
                    ) : (
                        <Typography key={b.title} color='text.primary'>
                            {b.title}
                        </Typography>
                    ),
                )
            }</Breadcrumbs>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default BreadCrumbs;

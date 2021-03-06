import React from 'react'
import { getPlayingSVG } from '.././SVGs'

export default function SimpleTimeLineSegment(props) {
    return (
        <div className={`simple-time-segment ${props.isActive ? 'active' : ''}`}>
            { getPlayingSVG() }
        </div>
    )
}

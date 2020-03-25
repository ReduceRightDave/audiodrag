import React from 'react'
import { getMutedSVG } from '.././SVGs'

export function DropTargetTimeLineSegment(props) {
    const dropDisabled = props.isActive || props.children
    return (
        <div
            className={`drop-target ${props.isActive ? 'active' : ''}`}
            onDrop={
                dropDisabled ? 
                    (event => event.preventDefault()) :
                    (event => props.drop_handler(event, 'timeline', props.index))
            }
            onDragOver={event => event.preventDefault()}
        >

            { props.children || getMutedSVG() } {/* TODO verify 1 child */}

        </div>
    )
}

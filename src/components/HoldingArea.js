import React from 'react'

export function HoldingArea(props) {
    return (
        <div
            id="holding-area"
            onDrop={event => props.drop_handler(event, 'holdingarea')}
            onDragOver={event => event.preventDefault()}
        >
            {props.children}
        </div>
    )
}
import React from 'react'

export default function MovesRemainingDisplay({movesRemaining}) {
    return (
        <p 
            id="moves-remaining"
            className={movesRemaining < 4 ? 'failure' : undefined}
        >
            Moves remaining: <b>{movesRemaining}</b>
        </p>
    )
}
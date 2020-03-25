import React from 'react'

export function HintLink(props) {
    if (props.hintLink) {
        return (
            <p id="hint">
                <a 
                    href={props.hintLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                >
                    Hint&#x2197;
                </a>
            </p>
        )
    } else {
        return null
    }
}

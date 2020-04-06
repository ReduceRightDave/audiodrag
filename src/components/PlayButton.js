import React from 'react'

export default function PlayButton(props) {
    return (
        <button 
            id="play-button" 
            onClick={props.playButton_handler}
            disabled={props.isLoading}
        >
            {props.isPlayingTimeline ? 'Stop' : 'Play'}
        </button>
    )
}

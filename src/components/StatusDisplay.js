import React from 'react'

export function StatusDisplay(props) {
    let content,
        restartButton = <button onClick={props.restartLevel}>Restart</button>

    if (props.isLoading) {
        content = <p>Loading...</p>
    } else if (props.userHasBeatenLevel) {
        content = (
            <>
                <p className="blink-me success">Completed</p>
                <button onClick={props.loadNextLevel}>Save &amp; load next</button>
            </>
        )
    } else if (props.userRanOutOfMoves) {
        content = (
            <>
                <p className="blink-me failure">Uh Oh!</p>
                {restartButton}
            </>
        )
    } else {
        content = (
            <>
                <p>
                    Level {props.levelNum}
                    {
                        props.currentLevelPicURL && 
                        <a className="thumbnail-container" href="#showpic">
                            <img className="levelpic_thumbnail" src={props.currentLevelPicURL} alt="" />
                        </a>
                    }
                </p>
                {props.firstMoveWasMade && restartButton}
            </>
        )
    }

    return <div id="status-display">{content}</div>
}
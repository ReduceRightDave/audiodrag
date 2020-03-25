import React from 'react'

function speakerSVG() {
    return (
        <path
            d="M 25.324609,1.7638834 13.220111,12.233421 H 1.7640927 V 25.706149 H 13.046524 l 12.278085,10.620544 z"
            className="speaker"
        />
    )
}

export function getPlayingSVG() {
    return (
        <svg className="playing-svg">
            { speakerSVG() }
            <path
                d="m 31.40085,11.523549 a 13.759923,13.759923 0 0 1 0,15.100634"
                className="wave wave1"
            />
            <path
                d="m 36.410873,6.5135272 a 21.169112,21.169112 0 0 1 0,25.1206788"
                className="wave wave2"
            />
            <path
                d="m 40.997514,1.9268857 a 27.378718,27.378718 0 0 1 0,34.2939613"
                className="wave wave3"
            />
        </svg>
    )
}

export function getMutedSVG() {
    return (
        <svg className="muted-svg">
            { speakerSVG() }
            <path
                className="cross-line-1"
                d="M 32.260326,27.634557 46.482046,10.97541"
            />
            <path
                className="cross-line-2"
                d="M 46.482046,27.634557 32.260326,10.97541"
            />
        </svg>
    )
}


import React from 'react'

export default function Overlay(props) {
    return (
        <div id="showpic">
            <div id="showpic_content">
                <a href="#" id="hidepic">
                    <span className="sr-only">Back</span>
                </a>
                <img src={props.currentLevelPicURL} alt="" />
            </div>
        </div>
    )
}

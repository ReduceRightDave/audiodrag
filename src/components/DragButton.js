import React from 'react'
import { getPlayingSVG } from '.././SVGs'

export default class DragButton extends React.Component {
    dragStartHandler = (event) => {
        
        const dragData = {
            start: this.props.start,
            duration: this.props.duration,
            index: this.props.index,
            color: this.props.color,
            wasInTimeline: this.props.inTimeline,
            wasInHoldingArea: this.props.inHoldingArea,
        }
        event.dataTransfer.setData('text/plain', JSON.stringify(dragData))
    }
    
    render() {
        return (
            /* Div rather than a button because long-standing drag and drop Mozilla bug */
            <div 
                onClick={() => this.props.playStandaloneLevelAudioSegment_handler(this.props.start, this.props.duration, this.props.index, this.props.inTimeline)} 
                draggable={!this.props.levelHasEnded} 
                onDragStart={this.dragStartHandler} 
                className={`drag-button ${this.props.isActive ? 'active' : ''}`}
                style={{ backgroundColor: this.props.color }}
            >
                {/* {this.props.start} */}
                { getPlayingSVG() }
            </div>
        )
    }
}

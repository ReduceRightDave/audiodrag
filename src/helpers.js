export function SimpleTimeLineSegmentModel(start, duration) {
    this.start = start
    this.duration = duration
}
export function DragButtonModel(start, duration, color, isActive) {
    this.start = start
    this.duration = duration
    this.color = color || null
    this.isActive = isActive
}
export function DropTargetTimeLineSegmentModel(start) {
    this.start = start
    var button

    this.setButton = (dragButtonModel) => {
        button = dragButtonModel
    }
    this.getButton = () => {
        return button
    }
    this.removeButton = () => {
        button = null
    }
    this.hasCorrectButton = () => {
        return button && button.start === this.start
    }
}

export function randomiseArrayOrder(arr) {
    const result = []
    const randomIndexes = {}
    const length = arr.length

    do {
        const randomIndex = Math.floor(Math.random() * length)
        if (!(randomIndex in randomIndexes)) {
            randomIndexes[randomIndex] = true
            result.push(arr[randomIndex])
        }
    } while (result.length !== length)

    return result
}

/*
www.npmjs.com/package/distinct-colors didn't work as well as a hand-picked list
*/
const distinctColors = [
    'blueviolet',
    'burlywood',
    'chartreuse',
    'chocolate',
    'cyan',
    'orange',
    'hotpink',
    'olive',
    'orangered',
    'springgreen',
    'brown',
    'teal',
    'crimson',
    'forestgreen',
    'yellow',
]

export function* colorGenerator() {
    const colors = randomiseArrayOrder(distinctColors)
    let i = 0
    while (true) {
        yield colors[i++]
    }
}

export function addTimelineDurations(timeline, audioDuration) {
    const multiplier = 1000

    return timeline.map((segment, i) => {
        if (i === timeline.length - 1) {
            segment.duration = audioDuration * multiplier - segment.start * multiplier
        } else {
            segment.duration = timeline[i+1].start * multiplier - segment.start * multiplier
        }
        segment.duration /= multiplier
        return segment
    })
}

export function userHasBeatenLevel(timelineData) {
    return timelineData
        .filter(segment => segment instanceof DropTargetTimeLineSegmentModel)
        .every(segment => segment.hasCorrectButton())
}

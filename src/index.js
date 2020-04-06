import React from 'react'
import ReactDOM from 'react-dom'
import { clearTimeout, setTimeout } from 'worker-timers'
import './DragDropTouch'
import './AudioContextMonkeyPatch'
import * as Sentry from '@sentry/browser'
import { 
    SimpleTimeLineSegmentModel,
    DragButtonModel,
    DropTargetTimeLineSegmentModel,
    randomiseArrayOrder, 
    colorGenerator,
    /*distinctColors as colors,*/
    addTimelineDurations,
    userHasBeatenLevel
} from './helpers'
import DragButton from './components/DragButton'
import SimpleTimeLineSegment from './components/SimpleTimeLineSegment'
import DropTargetTimeLineSegment from './components/DropTargetTimeLineSegment'
import HoldingArea from './components/HoldingArea'
import StatusDisplay from './components/StatusDisplay'
import MovesRemainingDisplay from './components/MovesRemainingDisplay'
import PlayButton from './components/PlayButton'
import Overlay from './components/Overlay'
import GameCompleted from './components/GameCompleted'
import HintLink from './components/HintLink'
import './index.css'
import config from './config.json'

const errorMessageJSX = <>
    <h1>An error occurred :(</h1>
    <p>It's been sent to us and we're on it! Please visit again.</p>
</>

/*
Error logging
Zeit Now defines BITBUCKET_COMMIT_SHA, which displays as the release name in Sentry.
BITBUCKET_COMMIT_SHA is aliased as REACT_APP_BITBUCKET_COMMIT_SHA in package.json
(create-react-app insists that env vars other than NODE_ENV start with REACT_APP_)
*/
Sentry.init({
    dsn: 'https://fda18a46347f4892b9485bb17ddf636f@sentry.io/2194007',
    release: 'audiodrag@' + process.env.REACT_APP_BITBUCKET_COMMIT_SHA
})
if (process.env.NODE_ENV !== 'production') {
    Sentry.getCurrentHub().getClient().getOptions().enabled = false
}


class ErrorBoundary extends React.Component {
    state = { hasError: false }

    static getDerivedStateFromError(error) {
        return { hasError: true }
    }

    componentDidCatch(error, errorInfo) {
        Sentry.withScope((scope) => {
            scope.setExtras(errorInfo)
            Sentry.captureException(error)
        })
    }

    render() {
        if (this.state.hasError) {
            return errorMessageJSX
        }
        return this.props.children
    }
}


class Game extends React.Component {

    constructor(props) {
        super(props)

        let shouldStopAnimationTime = Infinity
        this.getStopAnimationTime = function() {
            return shouldStopAnimationTime
        }
        this.setStopAnimationTime = function(time) {
            shouldStopAnimationTime = time
        }
        this.clearStopAnimationTime = function() {
            shouldStopAnimationTime = Infinity
        }
    }

    state = {
        timeline: [],
        holdingArea: [],
    }
    /* 
    Safari on iOS 11 seems to automatically suspend new AudioContext's that aren't created in response to a tap
    https://stackoverflow.com/questions/46363048/onaudioprocess-not-called-on-ios11/46534088#46534088
    */
    audioContext = new window.AudioContext()
    soundFXBuffers = {}

    //Later redefined
    stopScheduledLevelAudioPlay = () => {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId)
            this.timeoutId = 0
        }
    }
    stopStandaloneLevelAudioSegment = function() {}

    async populateSoundFXBuffers() {
        try {
            const promises = config.soundFX.map(sound => fetch(`${sound.file}`))
            const responses = await Promise.all(promises)

            for (let i=0, length=responses.length; i<length; i++) {
                const arrayBuffer = await responses[i].arrayBuffer()
                const name = config.soundFX[i].name
                
                // Safari doesn't accept the promise-based version of decodeAudioData
                this.soundFXBuffers[name] = await new Promise((resolve, reject) => {
                    this.audioContext.decodeAudioData(
                        arrayBuffer, 
                        audioBuffer => { 
                            resolve(audioBuffer)
                        },
                        error => {
                            reject(error)
                        }
                    )
                })
            }
        } catch(error) {
            Sentry.captureException(error)
            this.setState({error})
        }
    }

    scheduleLevelAudioPlay(when, offset, duration) {
        // Duration is used only to stop audio

        // const gainNode = new GainNode(this.audioContext) //MS Edge says no
        const gainNode = this.audioContext.createGain()

        const audioSource = this.audioContext.createBufferSource()
        audioSource.buffer = this.currentLevelAudioBuffer

        let wasStopped = false

        this.stopScheduledLevelAudioPlay = function(shouldCompleteCurrentSegment) {
            const fadeoutDuration = 0.05
            if (this.timeoutId) {
                clearTimeout(this.timeoutId)
                this.timeoutId = 0
            }

            if (!wasStopped) {
                if (shouldCompleteCurrentSegment) {
                    gainNode.gain.setValueAtTime(1, when + duration - fadeoutDuration)
                    gainNode.gain.linearRampToValueAtTime(0, when + duration)
                    audioSource.stop(when + duration)
                } else {
                    const fadeoutDuration = 0.2
                    const now = this.audioContext.currentTime
                    gainNode.gain.setValueAtTime(1, now)
                    gainNode.gain.linearRampToValueAtTime(0, now + fadeoutDuration)
                    audioSource.stop(now + fadeoutDuration)
                }
            }
        }

        audioSource.onended = () => {
            wasStopped = true
            try {
                /*
                Chrome intermittently says:
                InvalidAccessError: Failed to execute 'disconnect' on 'AudioNode': 
                the given destination is not connected.
                */
                audioSource.disconnect(gainNode)
                gainNode.disconnect(this.audioContext.destination)
            } catch(error) {
                console.log(error)
            }
        }

        // const fullVolumeTime = when + 0.05
        // gainNode.gain.setValueAtTime(0, when)
        // gainNode.gain.linearRampToValueAtTime(1, fullVolumeTime)
    
        audioSource.connect(gainNode)
        gainNode.connect(this.audioContext.destination)
        audioSource.start(when, offset)
    }

    setOneSegmentToActive(segmentIndex, collectionArg = 'timeline') {

        if (collectionArg !== 'timeline' && collectionArg !== 'holdingArea') {
            throw new RangeError('The only two collections that hold drag buttons are timeline and holdingArea')
        }

        const setOneToTrue = (collectionName) => {
            const collection = this.state[collectionName].map((segment, i) => {
                segment['isActive'] = false
                if (segment instanceof DropTargetTimeLineSegmentModel && segment.getButton()) {
                    segment.getButton()['isActive'] = false
                }
                if (i === segmentIndex && collectionName === collectionArg) {
                    if (segment instanceof DropTargetTimeLineSegmentModel && segment.getButton()) {
                        segment.getButton()['isActive'] = true
                    } else {
                        segment['isActive'] = true
                    }
                }
                return segment
            })

            if (collectionName === 'timeline') {
                this.setState({timeline: collection}, () => setOneToTrue('holdingArea'))
            } else {
                this.setState({holdingArea: collection})
            }
        }

        setOneToTrue('timeline')
    }

    playTimeline() {
        const startDelay = 0

        this.setState({isPlayingTimeline: true})

        this.stopStandaloneLevelAudioSegment()
        this.clearStopAnimationTime()

        this.stopScheduledLevelAudioPlay(false)

        const scheduleNextDecisionEvent = (deadline, timelineWasJumped, info) => {
            this.timeoutId = setTimeout(
                () => {
                    // SCHEDULING

                    segmentIndex += 1
                    const segment = this.state.timeline[segmentIndex]

                    if (!segment) {
                        this.setOneSegmentToActive(null)
                        this.stopScheduledLevelAudioPlay(true)
                        this.setState({isPlayingTimeline: false})
                        return
                    }

                    this.setOneSegmentToActive(segmentIndex)

                    if (segment instanceof DropTargetTimeLineSegmentModel) {
                        if (segment.getButton()) {
                            if (segment.hasCorrectButton()) {
                                // Drag button is in the right place
                                if (timelineWasJumped) {
                                    this.stopScheduledLevelAudioPlay(true)
                                    this.scheduleLevelAudioPlay(deadline, segment.start, segment.getButton().duration)
                                }
                                scheduleNextDecisionEvent(segment.getButton().duration + deadline, false, segment.start)
                            } else {
                                // Drag button is in the wrong place
                                this.stopScheduledLevelAudioPlay(true)
                                this.scheduleLevelAudioPlay(deadline, segment.getButton().start, segment.getButton().duration)
                                scheduleNextDecisionEvent(segment.getButton().duration + deadline, true, segment.getButton().start)

                            }
                        } else {
                            // Empty slot
                            this.stopScheduledLevelAudioPlay(true)
                            scheduleNextDecisionEvent(config.emptySegmentSilenceDuration + deadline, true, segment.start)

                        }
                    } else {
                        // Simple timeline segment
                        if (timelineWasJumped) {
                            this.stopScheduledLevelAudioPlay(true)
                            this.scheduleLevelAudioPlay(deadline, segment.start, segment.duration)
                        }
                        scheduleNextDecisionEvent(segment.duration + deadline, false, segment.start)
                    }
                },
                Math.max(0, deadline - 0.2 - this.audioContext.currentTime) * 1000
            );
        }

        let segmentIndex = 0

        this.setOneSegmentToActive(segmentIndex)

        const segment = this.state.timeline[segmentIndex]

        if (segment instanceof DropTargetTimeLineSegmentModel) {
            if (segment.getButton()) {
                if (segment.hasCorrectButton()) {
                    // First segment is in the right place
                    this.scheduleLevelAudioPlay(startDelay + this.audioContext.currentTime, segment.start, segment.getButton().duration)
                    scheduleNextDecisionEvent(segment.start + segment.getButton().duration + startDelay + this.audioContext.currentTime, false, segment.start)

                } else {
                    // First segment is in the wrong place
                    this.scheduleLevelAudioPlay(startDelay + this.audioContext.currentTime, segment.getButton().start, segment.getButton().duration)
                    scheduleNextDecisionEvent(segment.getButton().duration + startDelay + this.audioContext.currentTime, true, segment.getButton().start)

                }
            } else {
                // Empty slot
                scheduleNextDecisionEvent(config.emptySegmentSilenceDuration + this.audioContext.currentTime, true, segment.start)

            }
        } else {
            // Simple timeline segment
            this.scheduleLevelAudioPlay(startDelay + this.audioContext.currentTime, segment.start, segment.duration)
            scheduleNextDecisionEvent(segment.start + segment.duration + startDelay + this.audioContext.currentTime, false, segment.start)
        }

    }

    stopTimeline() {
        this.stopStandaloneLevelAudioSegment()
        this.stopScheduledLevelAudioPlay(false)
        this.setOneSegmentToActive(null)
        this.setState({isPlayingTimeline: false})
    }

    playStandaloneLevelAudioSegment_handler = (offset, duration, index, isInTimeline) => {
        this.stopTimeline()

        this.setOneSegmentToActive(index, isInTimeline ? 'timeline' : 'holdingArea')
        
        this.setStopAnimationTime(this.audioContext.currentTime + duration)

        // const gainNode = new GainNode(this.audioContext) //MS Edge says no
        const gainNode = this.audioContext.createGain()

        const now = this.audioContext.currentTime

        const fullVolumeTime = now + 0.05
        gainNode.gain.setValueAtTime(0, now)
        gainNode.gain.linearRampToValueAtTime(1, fullVolumeTime)

        const fadeOutDuration = 0.1
        const endTime = now + duration
        gainNode.gain.setValueAtTime(1, endTime - fadeOutDuration)
        gainNode.gain.linearRampToValueAtTime(0, endTime)

        const audioSource = this.audioContext.createBufferSource()
        audioSource.buffer = this.currentLevelAudioBuffer

        let wasStopped = false

        this.stopStandaloneLevelAudioSegment = function(fadeoutDuration = 0.05) {
            if (!wasStopped) {
                const now = this.audioContext.currentTime
                gainNode.gain.setValueAtTime(1, now)
                gainNode.gain.linearRampToValueAtTime(0, now + fadeoutDuration)
                audioSource.stop(now + fadeoutDuration)
            }
        }

        audioSource.onended = () => {
            wasStopped = true
            try {
                /*
                Chrome intermittently says:
                InvalidAccessError: Failed to execute 'disconnect' on 'AudioNode': 
                the given destination is not connected.
                */
                audioSource.disconnect(gainNode)
                gainNode.disconnect(this.audioContext.destination)
            } catch(error) {
                console.log(error)
            }
        }

        audioSource.connect(gainNode)
        gainNode.connect(this.audioContext.destination)
        audioSource.start(now, offset, duration)
    }

    async loadLevel(levelNum) {
        this.stopStandaloneLevelAudioSegment(0.5)
        this.stopScheduledLevelAudioPlay(false)
        
        localStorage.setItem('levelNum', levelNum)

        this.setState(
            {
                isLoading: true,
                isPlayingTimeline: false,
            }, 
            async () => {
                let levelConfig,
                    currentLevelPicURL
                try {
                    const promises = [
                        fetch(`levels/level${levelNum}/levelconfig.json`), 
                        fetch(`levels/level${levelNum}/audio.mp3`),
                        fetch(`levels/level${levelNum}/pic.jpg`)
                    ]
                    const responses = await Promise.all(promises)

                    levelConfig = await responses[0].json()

                    if (levelConfig.gamecompleted === true) {
                        this.setState({gamecompleted: true})
                        this.simplePlaySound(this.soundFXBuffers.gamecompleted)
                        return
                    }

                    const arrayBuffer = await responses[1].arrayBuffer()

                    // Safari doesn't accept the promise-based version of decodeAudioData
                    this.currentLevelAudioBuffer = await new Promise((resolve, reject) => {
                        this.audioContext.decodeAudioData(
                            arrayBuffer, 
                            audioBuffer => { 
                                resolve(audioBuffer)
                            },
                            error => {
                                reject(error)
                            }
                        )
                    })

                    const imageBlob = await responses[2].blob()
                    if (imageBlob.type.split('/')[0] !== 'image') {
                        currentLevelPicURL = ''
                    } else {
                        currentLevelPicURL = URL.createObjectURL(imageBlob)
                    }

                } catch(error) {
                    Sentry.withScope((scope) => {
                        scope.setTag('loading-level', levelNum)
                        Sentry.captureException(error)
                    })                
                    this.setState({error})
                    return
                }

                let timeline = addTimelineDurations(levelConfig.timeline, this.currentLevelAudioBuffer.duration)
                console.log(timeline)

                timeline = timeline.map(function(segment) {
                    if (segment.swappable) {
                        return new DropTargetTimeLineSegmentModel(segment.start)
                    } else { 
                        return new SimpleTimeLineSegmentModel(segment.start, segment.duration)
                    }
                })

                let holdingArea = []
                const colorGen = colorGenerator()

                levelConfig.timeline.forEach(function(segment) {
                    if (!segment.swappable) { return }

                    const duplicates = segment.duplicates || [],
                        segmentWithDuplicates = [segment, ...duplicates],
                        start = segment.start,
                        duration = segment.duration,
                        color = colorGen.next().value

                    segmentWithDuplicates.forEach(function(segment) {
                        const dragButton = new DragButtonModel(start, duration, color)
                        if ('startInSlot' in segment) {
                            timeline[segment.startInSlot].setButton(dragButton)
                        } else {
                            holdingArea.push(dragButton)
                        }
                    })
                })

                holdingArea = randomiseArrayOrder(holdingArea)

                this.setState({
                    isLoading: false,
                    firstMoveWasMade: false,
                    timeline,
                    holdingArea,
                    movesRemaining: levelConfig.movesLimit, 
                    hintLink: levelConfig.hintLink,
                    currentLevelPicURL,
                    userHasBeatenLevel: false,
                    userRanOutOfMoves: false,
                })
            }
        )
    }

    restartLevel() {
        if (!this.state.userRanOutOfMoves) {
            this.simplePlaySound(this.soundFXBuffers.levelrestart)
        }
        this.loadLevel(localStorage.getItem('levelNum'))
    }

    restartGame() {
        this.setState(
            {gamecompleted: false},
            () => this.loadLevel(0)    
        )
    }

    componentDidMount() {
        this.setState({isLoading: true}, () => {

            this.populateSoundFXBuffers()

            this.setState(
                {isLoading: false}, 
                () => this.loadLevel(localStorage.getItem('levelNum') || 0)
            )
        })

        const RAFcallback = () => {
            /* TODO?
            componentWillUnmount() {
                window.cancelAnimationFrame(
            }
            */

            if (this.audioContext.currentTime > this.getStopAnimationTime()) {
                this.clearStopAnimationTime()
                this.setOneSegmentToActive(null)
            }
            requestAnimationFrame(RAFcallback)
        }
        requestAnimationFrame(RAFcallback)
    }
    
    simplePlaySound(audioBuffer) {
        const audioSource = this.audioContext.createBufferSource()
        audioSource.buffer = audioBuffer
        audioSource.connect(this.audioContext.destination)
        audioSource.start()
    }

    drop_handler = (event, dropTargetType, newIndex) => {
        event.preventDefault()
        const timeline = [...this.state.timeline]
        const holdingArea = [...this.state.holdingArea]

        const dragData = JSON.parse(event.dataTransfer.getData('text/plain'))
        const {
                start: dragButtonstart,
                duration,
                index: oldIndex, 
                color, 
                wasInTimeline, 
                wasInHoldingArea,
            } = dragData

        if (dropTargetType === 'holdingarea' && wasInHoldingArea) {
            return
        }

        const isActive = (wasInHoldingArea && holdingArea[oldIndex].isActive) 
            || (wasInTimeline && timeline[oldIndex].getButton().isActive)

        const dragButtonModel = new DragButtonModel(
            dragButtonstart, 
            duration,
            color,
            isActive,
        )

        if (dropTargetType === 'timeline') {
            timeline[newIndex].setButton(dragButtonModel)
        }

        if (dropTargetType === 'holdingarea') {
            holdingArea.push(dragButtonModel)
        }

        if (wasInTimeline) {
            timeline[oldIndex].removeButton()
        }

        if (wasInHoldingArea) {
            holdingArea.splice(oldIndex, 1)
        } 

        const hasWonLevel = userHasBeatenLevel(timeline)
        if (hasWonLevel) {
            this.simplePlaySound(this.soundFXBuffers.success)
        }

        let movesRemaining = this.state.movesRemaining
        movesRemaining -= 1
        const ranOutOfMoves = movesRemaining === 0
        if (ranOutOfMoves && !hasWonLevel) {
            this.stopStandaloneLevelAudioSegment(0.5)
            this.stopScheduledLevelAudioPlay(false)
            this.setOneSegmentToActive(null)
            this.simplePlaySound(this.soundFXBuffers.failure)
        }

        this.setState({
            firstMoveWasMade: true,
            timeline,
            holdingArea,
            movesRemaining: movesRemaining,
            userHasBeatenLevel: hasWonLevel,
            userRanOutOfMoves: ranOutOfMoves,
        })
    }

    playButton_handler = () => {
        if (this.state.isPlayingTimeline) {
            this.stopTimeline()
        } else {
            this.playTimeline()
        }
    }

    render() {
        if (this.state.error) {
            return errorMessageJSX
        }

        if (this.state.gamecompleted) {
            return <GameCompleted restartGame={() => this.restartGame()} />
        }

        const levelNum = localStorage.getItem('levelNum')
        const {
            isPlayingTimeline,
            userHasBeatenLevel, 
            userRanOutOfMoves,
            isLoading,
            firstMoveWasMade,
            hintLink,
            currentLevelPicURL,
        } = this.state

        const timelineElements = this.state.timeline.map((segment, i) => {
            if (segment instanceof DropTargetTimeLineSegmentModel) {
                let dragButton
                if (segment.getButton()) {
                    dragButton = (
                        <DragButton 
                            key={`dragButton-${i}`} 
                            index={i}
                            start={segment.getButton().start} 
                            duration={segment.getButton().duration}
                            color={segment.getButton().color}
                            isActive={segment.getButton().isActive}
                            playStandaloneLevelAudioSegment_handler={this.playStandaloneLevelAudioSegment_handler}
                            levelHasEnded={userHasBeatenLevel || userRanOutOfMoves}
                            inTimeline //TODO change to inTimeline=true / false
                        />
                    )
                }
                return (
                    <DropTargetTimeLineSegment 
                        key={`dropTargetSegment-${i}`} 
                        index={i} 
                        start={segment.start}
                        drop_handler={this.drop_handler}
                        isActive={segment.isActive}    
                    >
                        {dragButton}
                    </DropTargetTimeLineSegment>
                )
            } else {
                return <SimpleTimeLineSegment
                    key={`fixedSegment-${i}`}
                    isActive={segment.isActive}    
                />
            }
        })

        const holdingAreaElements = this.state.holdingArea.map((segment, i) => (
            <DragButton 
                key={`dragButton-${i}`} 
                index={i}
                start={segment.start}
                duration={segment.duration}
                color={segment.color}
                isActive={segment.isActive}
                playStandaloneLevelAudioSegment_handler={this.playStandaloneLevelAudioSegment_handler}
                levelHasEnded={userHasBeatenLevel || userRanOutOfMoves}
                inHoldingArea
            />
        ))

        return (
            <>
                <h1>AudioDrag</h1>
                <div id="game">
                    <aside>  {/* TODO Rename / refactor to StatusDisplayAndControls */ }
                        <StatusDisplay
                            {...{
                                isLoading, 
                                firstMoveWasMade,
                                levelNum, 
                                userHasBeatenLevel,
                                userRanOutOfMoves,
                                currentLevelPicURL,
                            }}
                            loadNextLevel={() => this.loadLevel(parseInt(levelNum, 10) + 1)}
                            restartLevel={() => this.restartLevel()}
                        />
                        <PlayButton 
                            {...{
                                isLoading,
                                isPlayingTimeline,
                            }}
                            playButton_handler={this.playButton_handler} 
                        />
                        <HintLink {...{hintLink}}/>
                        <MovesRemainingDisplay movesRemaining={this.state.movesRemaining} />
                    </aside>
                    <div id="song-container">
                        {timelineElements}
                    </div>
                    <HoldingArea drop_handler={this.drop_handler}>
                        {holdingAreaElements}
                    </HoldingArea>
                </div>

                <a id="code-link" href="https://github.com/ReduceRightDave/audiodrag">
                    See the code on Github
                </a>

                <Overlay {...{currentLevelPicURL}} />

                {/* <p style={{marginTop: '500px'}}>
                    {colors.map((color) => <div className='drag-button' style={{backgroundColor:color}}></div>)}
                </p> */}
            </>
        )
    }
}


ReactDOM.render(
    <ErrorBoundary>
        <Game />
    </ErrorBoundary>, 
    document.getElementById('root')
)


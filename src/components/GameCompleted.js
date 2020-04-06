import React from 'react'

export default function GameCompleted(props) {
    return (
        <section id="gamecompleted"> 
            <h1>You completed the game!</h1>
            <img 
                src="images/gamecompleted.jpeg"
                alt="A woman raises her arm in celebration."
            />
            <p className="imagecredit">Photo by Andrea Piacquadio</p>
            <button onClick={props.restartGame}>Restart game</button>
        </section>
    )
}

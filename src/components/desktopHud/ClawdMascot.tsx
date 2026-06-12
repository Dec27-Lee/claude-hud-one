import type { CurrentSessionState } from '../../app/types'
import type { ClawdMood } from './sessionFormatters'

type ClawdMascotProps = {
  mood: ClawdMood
  activity: CurrentSessionState['activity']
  size?: 'capsule' | 'card'
}

const KeyboardKeys = () => (
  <span className="clawd-pixel-keyboard__grid" aria-hidden="true">
    {Array.from({ length: 18 }, (_, index) => <span className={`clawd-pixel-key clawd-pixel-key--${index}`} key={index} />)}
  </span>
)

function SleepScene() {
  return (
    <span className="clawd-scene clawd-scene--sleep">
      <span className="clawd-sleep-z clawd-sleep-z--0">z</span>
      <span className="clawd-sleep-z clawd-sleep-z--1">z</span>
      <span className="clawd-sleep-z clawd-sleep-z--2">z</span>
      <span className="clawd-pixel-shadow clawd-pixel-shadow--sleep" />
      <span className="clawd-sleep-body">
        <span className="clawd-sleep-leg clawd-sleep-leg--0" />
        <span className="clawd-sleep-leg clawd-sleep-leg--1" />
        <span className="clawd-sleep-leg clawd-sleep-leg--2" />
        <span className="clawd-sleep-leg clawd-sleep-leg--3" />
        <span className="clawd-sleep-torso" />
        <span className="clawd-sleep-arm clawd-sleep-arm--left" />
        <span className="clawd-sleep-arm clawd-sleep-arm--right" />
        <span className="clawd-sleep-eye clawd-sleep-eye--left" />
        <span className="clawd-sleep-eye clawd-sleep-eye--right" />
      </span>
    </span>
  )
}

function WorkScene() {
  return (
    <span className="clawd-scene clawd-scene--work">
      <span className="clawd-pixel-shadow clawd-pixel-shadow--work" />
      <span className="clawd-work-character">
        <span className="clawd-work-leg clawd-work-leg--0" />
        <span className="clawd-work-leg clawd-work-leg--1" />
        <span className="clawd-work-leg clawd-work-leg--2" />
        <span className="clawd-work-leg clawd-work-leg--3" />
        <span className="clawd-work-torso" />
        <span className="clawd-work-eye clawd-work-eye--left" />
        <span className="clawd-work-eye clawd-work-eye--right" />
        <span className="clawd-work-arm clawd-work-arm--left" />
        <span className="clawd-work-arm clawd-work-arm--right" />
      </span>
      <span className="clawd-pixel-keyboard">
        <KeyboardKeys />
      </span>
    </span>
  )
}

function AlertScene() {
  return (
    <span className="clawd-scene clawd-scene--alert">
      <span className="clawd-alert-glow" />
      <span className="clawd-alert-bang">
        <span className="clawd-alert-bang__bar" />
        <span className="clawd-alert-bang__dot" />
      </span>
      <span className="clawd-pixel-shadow clawd-pixel-shadow--alert" />
      <span className="clawd-alert-character">
        <span className="clawd-alert-leg clawd-alert-leg--0" />
        <span className="clawd-alert-leg clawd-alert-leg--1" />
        <span className="clawd-alert-leg clawd-alert-leg--2" />
        <span className="clawd-alert-leg clawd-alert-leg--3" />
        <span className="clawd-alert-torso" />
        <span className="clawd-alert-eye clawd-alert-eye--left" />
        <span className="clawd-alert-eye clawd-alert-eye--right" />
        <span className="clawd-alert-arm clawd-alert-arm--left" />
        <span className="clawd-alert-arm clawd-alert-arm--right" />
      </span>
    </span>
  )
}

export function ClawdMascot({ mood, activity, size = 'capsule' }: ClawdMascotProps) {
  const scene = mood === 'idle' ? <SleepScene /> : mood === 'working' ? <WorkScene /> : <AlertScene />

  return (
    <span className={`clawd-mascot clawd-mascot--${mood} clawd-mascot--${activity} clawd-mascot--${size}`} aria-hidden="true">
      {scene}
    </span>
  )
}

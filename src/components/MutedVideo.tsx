'use client';
// A background video that is guaranteed to stay silent.
//
// React does put `muted=""` in the server HTML, but a few browsers only
// honour the attribute when the property is also set from script before
// playback settles - and the hero media is camera-recorded footage with
// a real audio track, so a missed mute is plainly audible. This wrapper
// forces the mute the moment the element attaches and re-asserts it on
// play/volumechange so nothing downstream can un-silence it.
import { useCallback, type VideoHTMLAttributes } from 'react';

type Props = VideoHTMLAttributes<HTMLVideoElement>;

export default function MutedVideo(props: Props) {
  const ref = useCallback((el: HTMLVideoElement | null) => {
    if (!el) return;
    const enforce = () => {
      if (!el.muted) el.muted = true;
      if (el.volume !== 0) el.volume = 0;
    };
    enforce();
    el.addEventListener('play', enforce);
    el.addEventListener('volumechange', enforce);
  }, []);

  return <video {...props} ref={ref} muted playsInline autoPlay />;
}

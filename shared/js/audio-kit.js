class StudioAudio {
  constructor() {
    this.soundOn = true;
    this.actx = null;
  }

  init() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!this.actx && AC) this.actx = new AC();
      if (this.actx && this.actx.state === 'suspended') this.actx.resume();
    } catch (e) {}
  }

  playTone(freq, dur, type = 'sine') {
    if (!this.soundOn) return;
    this.init();
    if (!this.actx) return;
    try {
      const osc = this.actx.createOscillator();
      const gain = this.actx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.actx.currentTime);
      gain.gain.setValueAtTime(0.12, this.actx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.actx.currentTime + dur);
      osc.connect(gain);
      gain.connect(this.actx.destination);
      osc.start();
      osc.stop(this.actx.currentTime + dur);
    } catch (e) {}
  }

  toggle() {
    this.soundOn = !this.soundOn;
    return this.soundOn;
  }
}

window.studioAudio = new StudioAudio();

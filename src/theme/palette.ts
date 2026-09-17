/** Shared by CSS, the 3D views, neural legend and saved images/videos. */
export const palette = {
  paper: '#FFFFFF',
  ink: '#0B0B0D',
  muted: '#5E5E66',
  line: '#D8D8DD',
  wash: '#F2F2F4',
  controlLine: '#8A8A92',
  forestHover: '#B00020',
  lime: '#FF334F',
  limeHover: '#FF5269',
  limeEdge: '#A80019',
  lilac: '#F5F5F7',
  lilacWash: '#EEEEF1',
  lilacInk: '#242429',
  coral: '#FF334F',
  coralInk: '#9D001C',
  coralWash: '#FFE8ED',
  coralShade: '#B00020',
  success: '#D80028',
  successWash: '#FFE3E9',
  focus: '#E1062C',
  textHover: '#C50024',
  brain: '#09090B',
  brainRaised: '#18181C',
  onBrain: '#FFFFFF',
  onBrainMuted: '#B7B7BE',
  brainLine: '#3B3B42',
  nodeRest: '#E3E3E8',
  nodeDisabled: '#44444B',
  scene: '#F4F4F6',
  sky: '#FFFFFF',
  skyLow: '#E8E8EC',
  stageFrame: '#FFFFFF',
  stageLine: '#A7A7AE',
  floor: '#D7D7DC',
  body: '#111114',
  bodyHighlight: '#FFFFFF',
  wingVein: '#B00020',
} as const;

export const neuralColors = {
  vision: palette.coral,
  network: palette.lilac,
  escape: palette.lime,
} as const;

export function applyPalette(style: Pick<CSSStyleDeclaration, 'setProperty'>): void {
  for (const [key, value] of Object.entries(palette)) {
    style.setProperty(`--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value);
  }
}

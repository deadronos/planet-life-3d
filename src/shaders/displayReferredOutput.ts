/**
 * Final line for ShaderMaterials that write display-referred colour straight
 * into `gl_FragColor` (no `colorspace_fragment`).
 *
 * Rendering straight to the canvas, three never encodes these, so the raw
 * value reaches the screen. Inside the bloom composer they render into a
 * linear half-float target that is sRGB-encoded at the end, which would brighten
 * and wash them out. Encoding for the current target and then decoding sRGB is
 * an identity on the canvas and a decode into linear inside the composer, so
 * the on-screen result matches with bloom on or off.
 */
export const DISPLAY_REFERRED_OUTPUT = /* glsl */ `
  gl_FragColor = sRGBTransferEOTF(linearToOutputTexel(gl_FragColor));
`;

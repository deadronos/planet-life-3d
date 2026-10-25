import { DISPLAY_REFERRED_OUTPUT } from './displayReferredOutput';

// Fragment shader for GPU life texture overlay
// Reads age and neighbor heat from texture channels and applies colors
export const gpuOverlayFragmentShader = /* glsl */ `
  uniform sampler2D uLifeTexture;
  uniform vec3 uCellColor;
  uniform vec3 uColonyColorA;
  uniform vec3 uColonyColorB;
  uniform vec3 uHeatLowColor;
  uniform vec3 uHeatMidColor;
  uniform vec3 uHeatHighColor;
  uniform float uAgeFadeHalfLife;
  uniform float uAgeFadeBase;
  uniform float uAgeFadeScale;
  uniform float uAgeFadeMin;
  uniform float uAgeFadeMax;
  uniform float uCellOverlayOpacity;
  uniform int uColorMode; // 0=Solid, 1=Age Fade, 2=Neighbor Heat
  uniform bool uColonyMode;
  // Night-side glow: emissive boost on live cells past the terminator
  uniform vec3 uLightDir;
  uniform vec3 uNightGlowColor;
  uniform float uNightGlowIntensity;
  // Debug override (when true, outputs a solid color instead of sampling texture)
  uniform bool uDebugOverlay;
  uniform vec3 uDebugColor;
  // Channel visualization: 0=off, 1=R, 2=G, 3=B, 4=RGB composite
  uniform int uDebugMode;
  uniform float uDebugScale;
  
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  
  void main() {
    // Debug: force a visible color to verify the overlay is rendered
    if (uDebugOverlay) {
      gl_FragColor = vec4(uDebugColor, 1.0);
      return;
    }

    vec4 texel = texture2D(uLifeTexture, vUv);

    // Debug visualization modes
    if (uDebugMode == 1) {
      gl_FragColor = vec4(vec3(texel.r * uDebugScale), 1.0);
      return;
    } else if (uDebugMode == 2) {
      gl_FragColor = vec4(vec3(texel.g * uDebugScale), 1.0);
      return;
    } else if (uDebugMode == 3) {
      gl_FragColor = vec4(vec3(texel.b * uDebugScale), 1.0);
      return;
    } else if (uDebugMode == 4) {
      gl_FragColor = vec4(texel.rgb * uDebugScale, 1.0);
      return;
    }

    float state = texel.r;
    float age = texel.g;
    float heat = texel.b;
    
    // Dead cells are transparent
    if (state < 0.02) {
      discard;
    }
    
    vec3 finalColor = uCellColor;
    float alpha = 1.0;
    
    if (uColonyMode) {
      // Colony mode: choose color based on state
      // State: 0.33 = Colony A, 0.67 = Colony B
      if (state < 0.5) {
        finalColor = uColonyColorA;
      } else {
        finalColor = uColonyColorB;
      }
    } else {
      // Classic mode: apply color mode
      if (uColorMode == 1) {
        // Age Fade mode
        float ageNormalized = age * 255.0; // De-normalize from 0-1 to 0-255
        float decay = exp(-ageNormalized / max(1.0, uAgeFadeHalfLife));
        float brightness = clamp(
          uAgeFadeBase + decay * uAgeFadeScale,
          uAgeFadeMin,
          uAgeFadeMax
        );
        finalColor = uCellColor * brightness;
      } else if (uColorMode == 2) {
        // Neighbor Heat mode
        float t = clamp(heat, 0.0, 1.0);
        if (t <= 0.5) {
          finalColor = mix(uHeatLowColor, uHeatMidColor, t * 2.0);
        } else {
          finalColor = mix(uHeatMidColor, uHeatHighColor, (t - 0.5) * 2.0);
        }
      }
      // else Solid mode - use uCellColor as-is
    }
    
    // Clamp colors
    finalColor = clamp(finalColor, 0.0, 1.0);
    
    // Use brightness as alpha contribution
    float brightness = max(finalColor.r, max(finalColor.g, finalColor.b));
    alpha = clamp(brightness, 0.05, 1.0);
    
    // Night glow: fades in just past the terminator, tinted toward the glow
    // colour while keeping a hint of the cell's own hue. Unclamped so values
    // above 1.0 bloom softly; with bloom off the canvas saturates instead.
    float darkness = smoothstep(0.05, 0.35, -dot(normalize(vWorldNormal), uLightDir));
    vec3 glow = mix(finalColor, uNightGlowColor, 0.6) * (darkness * uNightGlowIntensity);
    alpha = max(alpha, min(1.0, darkness * uNightGlowIntensity));

    gl_FragColor = vec4(finalColor + glow, alpha * uCellOverlayOpacity);
    ${DISPLAY_REFERRED_OUTPUT}
  }
`;

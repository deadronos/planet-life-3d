
export const simulationVertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const simulationFragmentShader = `
uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform bool uBirth[9];
uniform bool uSurvive[9];

varying vec2 vUv;

void main() {
    vec2 uv = vUv;
    vec2 onePixel = vec2(1.0) / uResolution;

    float current = texture2D(uTexture, uv).r;

    // Neighbor offsets
    vec2 offsets[8];
    offsets[0] = vec2(-1.0, -1.0);
    offsets[1] = vec2( 0.0, -1.0);
    offsets[2] = vec2( 1.0, -1.0);
    offsets[3] = vec2(-1.0,  0.0);
    offsets[4] = vec2( 1.0,  0.0);
    offsets[5] = vec2(-1.0,  1.0);
    offsets[6] = vec2( 0.0,  1.0);
    offsets[7] = vec2( 1.0,  1.0);

    float neighbors = 0.0;

    for (int i = 0; i < 8; i++) {
        vec2 neighborUV = uv + offsets[i] * onePixel;
        // X wraps automatically via RepeatWrapping
        // Y clamps automatically via ClampToEdgeWrapping
        // But we want to explicitly ignore neighbors "off the map" vertically
        // if ClampToEdge wraps to the edge pixel, it acts like the edge pixel is repeated.
        // We generally treat outside as dead (0.0).
        // If texture is ClampToEdge, sampling at y > 1.0 returns the value at y=1.0.
        // This effectively makes the poles "sticky".
        // To treat off-map as dead:
        if (neighborUV.y >= 0.0 && neighborUV.y <= 1.0) {
             neighbors += texture2D(uTexture, neighborUV).r;
        }
    }

    int n = int(neighbors);

    // Clamp n to 0-8 just in case
    if (n < 0) n = 0;
    if (n > 8) n = 8;

    float nextState = current;

    // Standard GoL Logic
    // If Alive (>= 0.5)
    if (current > 0.5) {
        if (uSurvive[n]) {
            nextState = 1.0;
        } else {
            nextState = 0.0;
        }
    } else {
        if (uBirth[n]) {
            nextState = 1.0;
        } else {
            nextState = 0.0;
        }
    }

    gl_FragColor = vec4(vec3(nextState), 1.0);
}
`;

export const seedFragmentShader = `
uniform float uSeed;
uniform float uDensity;
varying vec2 vUv;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main() {
    float r = random(vUv + uSeed);
    float val = (r < uDensity) ? 1.0 : 0.0;
    gl_FragColor = vec4(val, val, val, 1.0);
}
`;

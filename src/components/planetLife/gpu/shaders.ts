
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

// Helper to safely access uBirth array without dynamic indexing
bool getBirth(int n) {
    if (n == 0) return uBirth[0];
    if (n == 1) return uBirth[1];
    if (n == 2) return uBirth[2];
    if (n == 3) return uBirth[3];
    if (n == 4) return uBirth[4];
    if (n == 5) return uBirth[5];
    if (n == 6) return uBirth[6];
    if (n == 7) return uBirth[7];
    if (n == 8) return uBirth[8];
    return false;
}

// Helper to safely access uSurvive array without dynamic indexing
bool getSurvive(int n) {
    if (n == 0) return uSurvive[0];
    if (n == 1) return uSurvive[1];
    if (n == 2) return uSurvive[2];
    if (n == 3) return uSurvive[3];
    if (n == 4) return uSurvive[4];
    if (n == 5) return uSurvive[5];
    if (n == 6) return uSurvive[6];
    if (n == 7) return uSurvive[7];
    if (n == 8) return uSurvive[8];
    return false;
}

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

    // Unrolled loop for safety (though loops are usually fine, dynamic texture lookup inside loop is fine)
    for (int i = 0; i < 8; i++) {
        vec2 neighborUV = uv + offsets[i] * onePixel;
        // Treat off-map (Y axis) as dead to simulate poles
        if (neighborUV.y >= 0.0 && neighborUV.y <= 1.0) {
             neighbors += texture2D(uTexture, neighborUV).r;
        }
    }

    int n = int(neighbors + 0.5); // Round to nearest integer to be safe

    // Clamp n to 0-8 just in case
    if (n < 0) n = 0;
    if (n > 8) n = 8;

    float nextState = current;

    // Standard GoL Logic
    // If Alive (>= 0.5)
    if (current > 0.5) {
        if (getSurvive(n)) {
            nextState = 1.0;
        } else {
            nextState = 0.0;
        }
    } else {
        if (getBirth(n)) {
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

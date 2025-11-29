uniform float uTime;
varying vec2 vUv;
varying vec3 vNormal;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    vec3 pos = position;
    
    float freq = 10.0; 
    float amp = 0.07; 
    
    // Maska: głowa (przód) sztywna, ogon (tył) macha
    float mask = smoothstep(-0.2, 0.5, pos.z); 
    
    pos.x += sin(pos.z * freq + uTime * 10.0) * amp * mask;

    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0);
}
uniform sampler2D uTexture;
uniform float uTime;
uniform vec3 uColor;

varying vec2 vUv;

void main() {
    vec2 uv1 = vUv;
    uv1.x += uTime * 0.03;
    uv1.y += uTime * 0.01;
    
    vec2 uv2 = vUv;
    uv2.x -= uTime * 0.02;
    uv2.y -= uTime * 0.01;
    
    vec4 textureColor1 = texture2D(uTexture, uv1 * 4.0);
    vec4 textureColor2 = texture2D(uTexture, uv2 * 4.0);
    
    vec4 finalColor = mix(textureColor1, textureColor2, 0.5);
    vec3 color = finalColor.rgb * uColor;
    
    gl_FragColor = vec4(color, 0.4); 
}
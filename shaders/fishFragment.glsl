uniform sampler2D uTexture;
varying vec2 vUv;
varying vec3 vNormal;

void main() {
    vec4 texColor = texture2D(uTexture, vUv);
    
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
    float diff = max(dot(vNormal, lightDir), 0.0);
    
    vec3 lighting = vec3(0.5) + (vec3(1.0) * diff * 0.7);
    
    gl_FragColor = vec4(texColor.rgb * lighting, 1.0);
}
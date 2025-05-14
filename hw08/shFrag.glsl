#version 300 es

precision highp float;

out vec4 FragColor;
in vec3 fragPos;  
in vec3 normal;  
in vec2 texCoord;

struct Material {
    vec3 diffuse; // diffuse color
    vec3 specular;     // 표면의 specular color
    float shininess;   // specular 반짝임 정도
};

struct Light {
    //vec3 position;
    vec3 direction;
    vec3 ambient; // ambient 적용 strength
    vec3 diffuse; // diffuse 적용 strength
    vec3 specular; // specular 적용 strength
};

uniform Material material;
uniform Light light;
uniform vec3 u_viewPos;
uniform int u_levels;

float quantize(float value, int levels) {
    float step = 1.0 / float(levels);
    return step * floor(value / step);  // 0.0에서 시작
}


void main() {
    vec3 rgb = material.diffuse;
    
    // ambient
    vec3 ambient = light.ambient * rgb;

    // diffuse
    vec3 norm = normalize(normal);
    vec3 lightDir = normalize(light.direction);
    float diffRaw = max(dot(norm, lightDir), 0.0);
    float diff = quantize(diffRaw, u_levels);  // 양자화 적용
    vec3 diffuse = light.diffuse * diff * rgb;

    // specular
    vec3 viewDir = normalize(u_viewPos - fragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = 0.0;
    if (diffRaw > 0.0) {
        float specRaw = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
        spec = quantize(specRaw, u_levels);  // 양자화 적용
    }
    vec3 specular = light.specular * spec * material.specular;

    vec3 result = ambient + diffuse + specular;
    FragColor = vec4(result, 1.0);
}

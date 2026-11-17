import type { Adjustments } from "../../contracts/project";
import { colourMatrices } from "../domain/colour";
import { parseColourLut, type ColourLut } from "../domain/lut";
import type { VisualMedia } from "../media/import";

const luts = new Map<string, ColourLut>();
/** Cache only a few parsed looks; projects store immutable source .cube files separately. */
export async function prepareLook(id: string, url: string): Promise<void> {
  if (luts.has(id)) return;
  const response = await fetch(url);
  if (!response.ok) throw new Error("The colour look is missing");
  const lut = parseColourLut(await response.text());
  if (luts.size >= 8) luts.delete(luts.keys().next().value!);
  luts.set(id, lut);
}
let processor: EffectProcessor | null = null;
const vertex = `#version 300 es
in vec2 position; out vec2 uv; void main(){uv=(position+1.0)*0.5;gl_Position=vec4(position,0,1);}`;
const fragment = `#version 300 es
precision highp float; precision highp sampler3D;
in vec2 uv; out vec4 outputColour; uniform sampler2D source; uniform sampler3D cube;
uniform bool hasCube; uniform int cubeSize; uniform vec3 domainMin; uniform vec3 domainMax;
uniform int matrixCount; uniform mat4 matrices[4]; uniform vec4 offsets[4];
uniform bool keyEnabled; uniform vec3 keyColour; uniform float tolerance;
vec3 sampleCube(vec3 rgb){vec3 p=clamp((rgb-domainMin)/(domainMax-domainMin),0.,1.)*float(cubeSize-1);ivec3 a=ivec3(floor(p));ivec3 b=min(a+ivec3(1),ivec3(cubeSize-1));vec3 f=fract(p);return mix(mix(mix(texelFetch(cube,ivec3(a.x,a.y,a.z),0).rgb,texelFetch(cube,ivec3(b.x,a.y,a.z),0).rgb,f.x),mix(texelFetch(cube,ivec3(a.x,b.y,a.z),0).rgb,texelFetch(cube,ivec3(b.x,b.y,a.z),0).rgb,f.x),f.y),mix(mix(texelFetch(cube,ivec3(a.x,a.y,b.z),0).rgb,texelFetch(cube,ivec3(b.x,a.y,b.z),0).rgb,f.x),mix(texelFetch(cube,ivec3(a.x,b.y,b.z),0).rgb,texelFetch(cube,ivec3(b.x,b.y,b.z),0).rgb,f.x),f.y),f.z);}
void main(){vec4 colour=texture(source,vec2(uv.x,1.-uv.y));for(int i=0;i<4;i++){if(i>=matrixCount)break;colour=clamp(matrices[i]*colour+offsets[i],0.,1.);}if(hasCube)colour.rgb=clamp(sampleCube(colour.rgb),0.,1.);if(keyEnabled)colour.a*=smoothstep(tolerance,tolerance+0.05,distance(colour.rgb,keyColour)/sqrt(3.));outputColour=colour;}`;

/** GPU colour/key processing avoids a JavaScript readback for every movie pixel. */
class EffectProcessor {
  readonly canvas = document.createElement("canvas");
  private readonly gl;
  private readonly program;
  private readonly texture;
  private readonly cube;
  private currentLut: ColourLut | null = null;
  constructor() {
    const gl = this.canvas.getContext("webgl2", {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      antialias: false,
    });
    if (!gl)
      throw new Error(
        "Colour-look and key-colour preview need WebGL 2 on this device",
      );
    this.gl = gl;
    const compile = (kind: number, code: string) => {
      const shader = gl.createShader(kind)!;
      gl.shaderSource(shader, code);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(
          `The local colour shader could not compile: ${gl.getShaderInfoLog(shader)}`,
        );
      return shader;
    };
    this.program = gl.createProgram()!;
    gl.attachShader(this.program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(this.program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
      throw new Error("The local colour shader could not start");
    gl.useProgram(this.program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const attribute = gl.getAttribLocation(this.program, "position");
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
    this.texture = gl.createTexture()!;
    this.cube = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, this.cube);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage3D(
      gl.TEXTURE_3D,
      0,
      gl.RGB32F,
      2,
      2,
      2,
      0,
      gl.RGB,
      gl.FLOAT,
      new Float32Array(24),
    );
    gl.uniform1i(gl.getUniformLocation(this.program, "source"), 0);
    gl.uniform1i(gl.getUniformLocation(this.program, "cube"), 1);
  }
  render(
    media: VisualMedia,
    settings: Adjustments,
    key: string | null,
    tolerance: number,
  ): HTMLCanvasElement {
    const gl = this.gl;
    const width =
      media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
    const height =
      media instanceof HTMLVideoElement
        ? media.videoHeight
        : media.naturalHeight;
    const scale = Math.min(1, 4096 / Math.max(width, height));
    this.canvas.width = Math.max(1, Math.round(width * scale));
    this.canvas.height = Math.max(1, Math.round(height * scale));
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    const uniform = (name: string) => gl.getUniformLocation(this.program, name);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, media);
    const matrices = colourMatrices(settings);
    gl.uniform1i(uniform("matrixCount"), matrices.length);
    matrices.forEach((matrix, index) => {
      const values = new Float32Array(16);
      const offset = new Float32Array(4);
      for (let row = 0; row < 4; row++) {
        for (let column = 0; column < 4; column++)
          values[column * 4 + row] = matrix[row * 5 + column];
        offset[row] = matrix[row * 5 + 4];
      }
      gl.uniformMatrix4fv(uniform(`matrices[${index}]`), false, values);
      gl.uniform4fv(uniform(`offsets[${index}]`), offset);
    });
    const lut = settings.lutAssetId ? luts.get(settings.lutAssetId) : undefined;
    if (settings.lutAssetId && !lut)
      throw new Error("The colour look has not loaded");
    gl.uniform1i(uniform("hasCube"), lut ? 1 : 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, this.cube);
    if (lut && this.currentLut !== lut) {
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage3D(
        gl.TEXTURE_3D,
        0,
        gl.RGB32F,
        lut.size,
        lut.size,
        lut.size,
        0,
        gl.RGB,
        gl.FLOAT,
        lut.data,
      );
      this.currentLut = lut;
    }
    if (lut) {
      gl.uniform1i(uniform("cubeSize"), lut.size);
      gl.uniform3fv(uniform("domainMin"), lut.minimum);
      gl.uniform3fv(uniform("domainMax"), lut.maximum);
    }
    gl.uniform1i(uniform("keyEnabled"), key ? 1 : 0);
    gl.uniform3fv(
      uniform("keyColour"),
      key
        ? [
            parseInt(key.slice(1, 3), 16) / 255,
            parseInt(key.slice(3, 5), 16) / 255,
            parseInt(key.slice(5, 7), 16) / 255,
          ]
        : [0, 1, 0],
    );
    gl.uniform1f(uniform("tolerance"), tolerance);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  }
}
export function effectSource(
  media: VisualMedia,
  settings: Adjustments,
  key: string | null,
  tolerance: number,
): VisualMedia | HTMLCanvasElement {
  if (!settings.lutAssetId && !key) return media;
  processor ??= new EffectProcessor();
  return processor.render(media, settings, key, tolerance);
}

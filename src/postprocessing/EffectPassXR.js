import { EffectPass } from "./index.min.js";

export class EffectPassXR extends EffectPass {

    render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest) {

		for(const effect of this.effects) {

			effect.update(renderer, inputBuffer, deltaTime);

		}

		if(!this.skipRendering || this.renderToScreen) {

			const material = this.fullscreenMaterial;
			material.inputBuffer = inputBuffer.texture;
			material.time += deltaTime * this.timeScale;

			renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);

			// temporarily disable webxr render so effect is applied fullscreen.
			// some effects may need to be applied to each eye inidividually.
			// reflects changes in PR https://github.com/mrdoob/three.js/pull/26160

			this.toggleXR(renderer, false);
			renderer.render(this.scene, this.camera);
			this.toggleXR(renderer, this.xrEnabled);

		}

	}

    /**
	 * Enable / disable XR transformations
	 * @param {WebGLRenderer} renderer
	 * @param {Boolean} enable
	 */
	toggleXR(renderer, enable) {

		// only toggle while presenting
		if(renderer.xr.isPresenting) {

			this.xrEnabled = renderer.xr.enabled;
			renderer.xr.enabled = enable;

		}

	}
}

import { RenderPass } from "./index.min.js";

export class RenderPassXR extends RenderPass {
    render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest) {

		const scene = this.scene;
		const camera = this.camera;
		const selection = this.selection;
		const mask = camera.layers.mask;
		const background = scene.background;
		const shadowMapAutoUpdate = renderer.shadowMap.autoUpdate;
		const renderTarget = this.renderToScreen ? null : inputBuffer;

		if(selection !== null) {

			camera.layers.set(selection.getLayer());

		}

		if(this.skipShadowMapUpdate) {

			renderer.shadowMap.autoUpdate = false;

		}

		if(this.ignoreBackground || this.clearPass.overrideClearColor !== null) {

			scene.background = null;

		}

		if(this.clearPass.enabled) {

			this.clearPass.render(renderer, inputBuffer);

		}

		renderer.setRenderTarget(renderTarget);

		if(this.overrideMaterialManager !== null) {

			this.overrideMaterialManager.render(renderer, scene, camera);

		} else {

			// enable XR transformation for RenderPass only
			this.toggleXR(renderer, true);
			renderer.render(scene, camera);
			this.toggleXR(renderer, false);

		}

		// Restore original values.
		camera.layers.mask = mask;
		scene.background = background;
		renderer.shadowMap.autoUpdate = shadowMapAutoUpdate;

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
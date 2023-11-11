import { EffectComposer } from "./index.min.js";

import { Vector2 } from "three";

export class EffectComposerXR extends EffectComposer {

    setRenderer(renderer) {
        super.setRenderer(renderer);

		if(renderer !== null) {

			// listen for XR events to update sizes
			// reflects changes in PR https://github.com/mrdoob/three.js/pull/26160
			this.onSessionStateChangeRef = () => this.onSessionStateChange();
			this.renderer.xr.addEventListener("sessionstart", this.onSessionStateChangeRef);
			this.renderer.xr.addEventListener("sessionend", this.onSessionStateChangeRef);

		}

	}

    	
    /**
	 * XR event for updating sizes
	 */
	onSessionStateChange() {

		const size = this.renderer.getSize(new Vector2());
		this.setSize(size.width, size.height);

	}
}
class DetailsUtilsForceState {
	constructor(detail, options = {}) {
		this.options = Object.assign({
			closeClickOutside: false,		// can also be a media query str
			forceStateClosed: false,		// can also be a media query str
			closeEsc: false,						// can also be a media query str
		}, options);

		this.attr = {
			closeClickOutsideButton: "data-du-close-click",
		};

		this.detail = detail;
		this.summary = detail.querySelector(":scope > summary");
	}

	getMatchMedia(el, mq) {
		if(!el) return;
		if(mq && mq === true) {
			return {
				matches: true
			};
		}

		if(mq && "matchMedia" in window) {
			return window.matchMedia(mq);
		}
	}

	init() {
		let mm = this.getMatchMedia(this.detail, this.options.forceStateClosed);

		if( mm ) {
			this.setState(!mm.matches);

			if("addListener" in mm) {
				// Force stated based on details-force-state-closed attribute value in a media query listener
				mm.addListener(e => {
					this.setState(!e.matches);
				});
			}
		}
	}

	isCloseOnEsc() {
		return !!this.options.closeEsc;
	}

	getCloseOnEscMatchMedia() {
		return this.getMatchMedia(this.detail, this.options.closeEsc);
	}

	getClickoutToCloseMatchMedia() {
		return this.getMatchMedia(this.detail, this.options.closeClickOutside);
	}

	toggle() {
		let clickEvent = new MouseEvent("click", {
			view: window,
			bubbles: true,
			cancelable: true
		});
		this.summary.dispatchEvent(clickEvent);
	}

	triggerClickToClose() {
		if(this.summary && this.options.closeClickOutside) {
			this.toggle();
		}
	}

	setState(setOpen) {
		// We don’t want the summary to be focusable at larger breakpoints
		// Trying to prevent toggle as it should be always visible. Works in tandem with pointer-events: none
		if(this.summary) {
			if(setOpen) {
				this.summary.setAttribute("tabindex", -1);
			} else {
				this.summary.removeAttribute("tabindex");
			}
		}

		if( setOpen ) {
			this.detail.setAttribute("open", "open");
		} else {
			this.detail.removeAttribute("open");
		}
	}
}

class DetailsUtilsAnimateDetails {
	constructor(detail) {
		this.duration = {
			open: 200,
			close: 150
		};
		this.detail = detail;
		this.summary = this.detail.querySelector(":scope > summary");

		let contentTarget = this.detail.getAttribute("data-du-animate-target");
		if(contentTarget) {
			this.content = this.detail.closest(contentTarget);
		}

		if(!this.content) {
			this.content = this.summary.nextElementSibling;
		}
		if(!this.content) {
			// TODO wrap in an element?
			throw new Error("For now <details-utils> requires a child element for animation.");
		}

		this.summary.addEventListener("click", this.onclick.bind(this));
	}

	parseAnimationFrames(property, ...frames) {
		let keyframes = [];
		for(let frame of frames) {
			let obj = {};
			obj[property] = frame;
			keyframes.push(obj);
		}
		return keyframes;
	}

	getKeyframes(open) {
		let frames = this.parseAnimationFrames("maxHeight", "0px", `${this.getContentHeight()}px`);
		if(!open) {
			return frames.filter(() => true).reverse();
		}
		return frames;
	}

	getContentHeight() {
		if(this.contentHeight) {
			return this.contentHeight;
		}

		// make sure it’s open before we measure otherwise it will be 0
		if(this.detail.open) {
			this.contentHeight = this.content.offsetHeight;
			return this.contentHeight;
		}
	}

	animate(open, duration) {
		this.isPending = true;
		let frames = this.getKeyframes(open);
		this.animation = this.content.animate(frames, {
			duration,
			easing: "ease-out"
		});
		this.detail.classList.add("details-animating")

		this.animation.finished.catch(e => {}).finally(() => {
			this.isPending = false;
			this.detail.classList.remove("details-animating");
		});

		// close() has to wait to remove the [open] attribute manually until after the animation runs
		// open() doesn’t have to wait, it needs [open] added before it animates
		if(!open) {
			this.animation.finished.catch(e => {}).finally(() => {
				this.detail.removeAttribute("open");
			});
		}
	}

	open() {
		if(this.contentHeight) {
			this.animate(true, this.duration.open);
		} else {
			// must wait a frame if we haven’t cached the contentHeight
			requestAnimationFrame(() => this.animate(true, this.duration.open));
		}
	}

	close() {
		this.animate(false, this.duration.close);
	}

	useAnimation() {
		return "matchMedia" in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	// happens before state change when toggling
	onclick(event) {
		// do nothing if the click is inside of a link
		if(event.target.closest("a[href]") || !this.useAnimation()) {
			return;
		}

		if(this.isPending) {
			if(this.animation) {
				this.animation.cancel();
			}
		} else if(this.detail.open) {
			// cancel the click because we want to wait to remove [open] until after the animation
			event.preventDefault();
			this.close();
		} else {
			this.open();
		}
	}
}

class DetailsUtils extends HTMLElement {
	constructor() {
		super();

		this.attrs = {
			animate: "animate",
			closeEsc: "close-esc",
			closeClickOutside: "close-click-outside",
			forceStateClosed: "force-closed",
			toggleDocumentClass: "toggle-document-class",
		};

		this.options = {};

		this._connect();
	}

	getAttributeValue(name) {
		let value = this.getAttribute(name);
		if(value === undefined || value === "") {
			return true;
		} else if(value) {
			return value;
		}
		return false;
	}

	connectedCallback() {
		this._connect();
	}

	_connect() {
		if (this.children.length) {
			this._init();
			return;
		}

		// not yet available, watch it for init
		this._observer = new MutationObserver(this._init.bind(this));
		this._observer.observe(this, { childList: true });
	}

	_init() {
		if(this.initialized) {
			return;
		}
		this.initialized = true;

		this.options.closeClickOutside = this.getAttributeValue(this.attrs.closeClickOutside);
		this.options.closeEsc = this.getAttributeValue(this.attrs.closeEsc);
		this.options.forceStateClosed = this.getAttributeValue(this.attrs.forceStateClosed);

		// TODO support nesting <details-utils>
		let details = Array.from(this.querySelectorAll(`:scope details`));
		for(let detail of details) {
			// override initial state based on viewport (if needed)
			let fs = new DetailsUtilsForceState(detail, this.options);
			fs.init();

			if(this.hasAttribute(this.attrs.animate)) {
				// animate the menus
				new DetailsUtilsAnimateDetails(detail);
			}
		}

		this.bindCloseOnEsc(details);
		this.bindClickoutToClose(details);

		this.toggleDocumentClassName = this.getAttribute(this.attrs.toggleDocumentClass);
		if(this.toggleDocumentClassName) {
			this.bindToggleDocumentClass(details);
		}
	}

	bindCloseOnEsc(details) {
		document.documentElement.addEventListener("keydown", event => {
			if(event.keyCode === 27) {
				for(let detail of details) {
					let fs = new DetailsUtilsForceState(detail, this.options);
					if (fs.isCloseOnEsc() && detail.open) {
						let mm = fs.getCloseOnEscMatchMedia();
						if(!mm || mm && mm.matches) {
							fs.toggle();
						}
					}
				}
			}
		}, false);
	}

	isChildOfParent(target, parent) {
		while(target && target.parentNode) {
			if(target.parentNode === parent) {
				return true;
			}
			target = target.parentNode;
		}
		return false;
	}

	onClickoutToClose(detail, event) {
		let fs = new DetailsUtilsForceState(detail, this.options);
		let mm = fs.getClickoutToCloseMatchMedia();
		if(mm && !mm.matches) {
			// don’t close if has a media query but it doesn’t match current viewport size
			// useful for viewport navigation that must stay open (e.g. list of horizontal links)
			return;
		}

		let isCloseButton = event.target.hasAttribute(fs.attr.closeClickOutsideButton);
		if((isCloseButton || !this.isChildOfParent(event.target, detail)) && detail.open) {
			fs.triggerClickToClose(detail);
		}
	}

	bindClickoutToClose(details) {
		// Note: Scoped to document
		document.documentElement.addEventListener("mousedown", event => {
			for(let detail of details) {
				this.onClickoutToClose(detail, event);
			}
		}, false);

		// Note: Scoped to this element only
		this.addEventListener("keypress", event => {
			if(event.which === 13 || event.which === 32) { // enter, space
				for(let detail of details) {
					this.onClickoutToClose(detail, event);
				}
			}
		}, false);
	}

	bindToggleDocumentClass(details) {
		for(let detail of details) {
			detail.addEventListener("toggle", (event) => {
				document.documentElement.classList.toggle( this.toggleDocumentClassName, event.target.open );
			});
		}
	}
}

if(typeof window !== "undefined" && ("customElements" in window)) {
	window.customElements.define("details-utils", DetailsUtils);
}

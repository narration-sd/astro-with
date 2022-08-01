import { h, createSSRApp, createApp } from 'vue';
import StaticHtml from './static-html.js';

export default (element) =>
	(Component, props, slotted, { client }) => {
		delete props['class'];
		if (!element.hasAttribute('ssr')) return;

		// Expose name on host component for Vue devtools
		const name = Component.name ? `${Component.name} Host` : undefined;
		const slots = {};
		for (const [key, value] of Object.entries(slotted)) {
			slots[key] = () => h(StaticHtml, { value, name: key === 'default' ? undefined : key });
		}
		if (client === 'only') {
			// What we are doing here is allowing an appropriate prepare script to create the
			// app, so that it can add its own adjuncts, typically via app.use(). If this fails,
			// or if appropriately named no prepare/integration--prepare.mjs script exists on 
			// the client, we simply revert to the original creation of the app here. 
			
			// n.b. should you ever change the path, watch out for browser and dev environment caching
			// problems. Clear caches, restart both, then do a build-preview run intially, to avoid.
			
			// note that you can't do this, must hard-code the path, as otherwise vite-rollup 
			// won't recognize the string asa path, either to include its referred file in 
			// the build dist chunks, or to uuid it. 
			// 
			//     const prepare_file = '../../../prepare/vue-prepare.mjs'
			//     import (prepare_file)
			//
			// The good side of how this does work is that build or running under dev run will 
			// fail on missing the prepare, or if you miss-spell its name, giving a hard warning..
			
			import ('../../../prepare/vue-prepare.mjs')
				.catch (err => {
					throw new Error ('prepare script not present: ' + err)
				})
				.then (prepare => {
					const createArgs = { h, Component, props, slots };
					return prepare.default (name, createArgs); // .default because of import()
				})
				.catch (err => {
					console.log ('CLIENTJS:prepare failed:' + err.stack)
					throw err;
				})
				.then (app => {
					console.log ('CLIENTJS ABOUT TO MOUNT PREPARE-BASED ELEMENT: ' + name)
					app.mount(element, false);
				})
				.catch (err => {
					// *todo* condition logging on what kind of error -- not loading, no, normal?
					console.log('CLIENTJS:failed prepare: ' + err)
					console.log('CLIENTJS ABOUT TO CREATE OWN ELEMENT')
					const app = createApp({ name, render: () => h(Component, props, slots) })
					console.log ('CLIENTJS ABOUT TO MOUNT OWN ELEMENT: result')
					app.mount(element, false);
				})
		} else {
			const app = createSSRApp({ name, render: () => h(Component, props, slots) });
			app.mount(element, true);
		}
	};

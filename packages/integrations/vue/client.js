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
			console.log('ABOUT TO CREATE app')
			const app = createApp({ name, render: () => h(Component, props, slots) });
			console.log('ABOUT TO PREPARE en-suite B')
			import ('../../../src/modules/ext-vue-prepare.mjs')
				.then (prepare => {
					console.log ('FROM EST-VUE-PREPARE: preparing...')
					console.log ('typeof prepare: ' + typeof prepare)
					console.dir(prepare)
					// console.log ('stringified prepare: ' + JSON.stringify(prepare))
					// console.log ('prepare: ' + prepare)
					return prepare.default (app, 'vue-client')
				})
				// .catch (err => {
				// 	// *todo* either this goes silent, or we always require a prepare file
				// 	console.error ('PREPARE IMPORT or PREPARE failed: ' + err)
				// })
				.then ((result) => {
					console.log('PRE-MOUNT prepare result: ' + result)
					console.log ('CLIENTJS ABOUT TO MOUNT THIS ELEMENT: result')
					app.mount(element, false);
				})
				.catch (err => {
					// *todo* either this goes silent, or we always ssrequire a prepare file
					console.error ('APP AT MOUNT failed: ' + err.message)
					console.error ('APP AT MOUNT failed:stack: ' + err.stack)
				})
			app.mount(element, false);
		} else {
			const app = createSSRApp({ name, render: () => h(Component, props, slots) });
			app.mount(element, true);
		}
	};

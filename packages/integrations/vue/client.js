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
			import ('../../../src/modules/ext-vue-prepare.mjs')
				.then (prepare => {
					// console.log ('FROM EST-VUE-PREPARE: preparing...')
					// console.log ('typeof prepare: ' + typeof prepare)
					// console.dir(prepare);
					// console.log ('stringified prepare: ' + JSON.stringify(prepare))
					// console.log ('prepare: ' + prepare)
					const createArgs = { h, Component, props, slots };
					return prepare.default (name, createArgs);
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
					console.log('CLIENTJS ABOUT TO CREATE OWN app')
					const app = createApp({ name, render: () => h(Component, props, slots) })
					console.log ('CLIENTJS ABOUT TO MOUNT OWN ELEMENT: result')
					app.mount(element, false);
				})
			

		} else {
			const app = createSSRApp({ name, render: () => h(Component, props, slots) });
			app.mount(element, true);
		}
	};

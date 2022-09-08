import { h, createSSRApp, createApp } from 'vue';
import StaticHtml from './static-html.js';
import { doPrepare } from "./src/modules/do-prepare.js";

export default (element) =>
	(Component, props, slotted, { client }) => {
		delete props['class'];
		if (!element.hasAttribute('ssr')) return;
		
		// a temporary silencer
		console.log = function(){}

		// Expose name on host component for Vue devtools, and prepare...
		const name = Component.name ? `${Component.name} Host` : undefined;
		const slots = {};
		for (const [key, value] of Object.entries(slotted)) {
			slots[key] = () => h(StaticHtml, { value, name: key === 'default' ? undefined : key });
		}
		
		console.log('Running client.js, client mode: ' + client)
		let createProper
		if (client === 'only') {
			createProper = createApp
		} else {
			createProper = createSSRApp
		}
		
		doPrepare(Component, props, slots, createProper, name)
			.then (app => {
				app.mount (element)
			})
			
			// // What we are doing here is allowing an appropriate prepare script to create the
			// // app, so that it can add its own adjuncts, typically via app.use(). If this fails,
			// // or if appropriately named no prepare/integration--prepare.mjs script exists on 
			// // the client, we simply revert to the original creation of the app here. 
			//
			// // n.b. should you ever change the path, watch out for browser and dev environment caching
			// // problems. Clear caches, restart both, then do a build-preview run intially, to avoid.
			//
			// // note that you can't do this, must hard-code the path, as otherwise vite-rollup 
			// // won't recognize the string asa path, either to include its referred file in 
			// // the build dist chunks, or to uuid it. 
			// // 
			// //     const prepare_file = '../../../prepare/vue-prepare.mjs'
			// //     import (prepare_file)
			// //
			// // The good side of how this does work is that build or running under dev run will 
			// // fail on missing the prepare, or if you miss-spell its name, giving a hard warning..
			//
			// // n.b. this folder offset differs between client.js and server.js; different calling points
			// import ('../../../prepare/vue-prepare.mjs') // this path will be converted in the built
			// 	// .catch (err => {
			// 	// 	// may check the err later so as not to try this if unexpected
			// 	// 	console.log('prepare script missed on provided, trying again using local')
			// 	// 	const prepare_file_actual = '../../../prepare/vue-prepare.mjs' // must match, not converted
			// 	// 	return import (prepare_file_actual)
			// 	// })
			// 	.catch (err => {
			// 		throw new Error ('prepare script not present, by either means: ' + err)
			// 	})
			// 	.then (prepare => {
			// 		const createArgs = { h, Component, props, slots };
			// 		// this is what lets our vuetify elements show
			// 		// *todo* but does this make sense now? Revisit on current vuetiry schemes, paths
			// 		props = Object.assign(props, { formatted: true})
			// 		return prepare.default (createProper, createArgs, name); // .default because of import()
			// 	})
			// 	// .catch (err => {
			// 	// 	console.log ('CLIENTJS:prepare failed:' + err.stack)
			// 	// 	throw err;
			// 	// })
			// 	.then (app => {
			// 		console.log ('CLIENTJS ABOUT TO MOUNT PREPARE-BASED ELEMENT: ' + name)
			// 		app.mount(element, false);
			// 	})
			// 	.catch (err => {
			// 		// *todo* condition logging on what kind of error -- not loading, no, normal?
			// 		console.log('CLIENTJS:failed prepare: ' + err)
			// 		console.log('CLIENTJS ABOUT TO CREATE OWN ELEMENT for: ' + name)
			// 		const app = createProper({ name, render: () => h(Component, props, slots) })
			// 		console.log ('CLIENTJS ABOUT TO MOUNT OWN ELEMENT: result')
			// 		app.mount(element, false);
			// 	})
		// } else {
		// 	const app = createSSRApp({ name, render: () => h(Component, props, slots) });
		// 	app.mount(element, true);
		// }
	};

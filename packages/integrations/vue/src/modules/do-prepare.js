// Because the core of the Prepare ability moved here, and then pared down to 
// least code simplicity, the notes here are far to long and involved.
// *todo* but we want to give sight of this ability -- then clean notes up!!

// you enter at your peril then, but methods here are simple, just critical, 
// as there is no slack in the compiling and bundling environment.
// Which had to be discovered, single paths at each step in the chain.

// What we are doing here is allowing an appropriate prepare script to modify the
// app, so that it can add its own adjuncts, typically via stages of app.use(). If this fails,
// or if appropriately named no prepare/integration--prepare.mjs script exists on 
// the client, we simply revert to the original creation of the app here. 

// n.b. should you ever change the path, watch out for browser and dev environment caching
// problems. Clear caches, restart both, then do a build-preview run intially, to avoid.

// note that you can't do the following, must hard-code the path, as otherwise vite-rollup 
// won't recognize the string asa path, either to include its referred file in 
// the build dist chunks, or to uuid it. 
// 
//     const prepare_file = '../../../prepare/vue-prepare.mjs'
//     import (prepare_file)
//
// The good side of how this does work is that build or running under dev run will 
// fail on missing the prepare, or if you miss-spell its name, giving a hard warning..

// n.b. this folder offset differs between client.js and server.js; different calling points

import { h } from "vue";

const doPrepare = (appOnly, name = 'not named', isClient = true) => {
	
	// This is the means that binds client-side prepare scripting to Astro 
	// server use, whether it is in the upload prepared for the client,
	// or in the server itself. Thus it is called by both client.js and server.js
	// There is some amount of finesse involved in getting this to work,
	// and to give suitable use experience, as it runs via esbuild, vite, 
	// and rollup, along the various pathways of dev and build requirements
	// on library modules, vs. their actual conditions in real life npm.

	return import ('../../../../../prepare/vue-prepare.mjs')
		// this path will be converted in the built, but requires our monitoring,
		// as many possible errors will not get as far as execution of this promise.
		// It's required that the path be hard-coded, or the build system won't notice
		// its linkage to a real file, and convert with a hashcode, as we require.
		.catch (err => {
			// this is best means; preserves ability to use app without prepare-ation
			throw new Error (
				'app prepare/vue-prepare.mjs script is required for this integration, and not present. \n' +
				'You\'re likely to get other errors that follow, because of it: ' + err)
		})
		.then (prepare => {
			return prepare.default (appOnly, name, isClient); // .default because of import()
		})
		.catch (err => {
			console.log(name + ':Failed Prepare: ' + err)
			return appOnly
		})
}

export { doPrepare }

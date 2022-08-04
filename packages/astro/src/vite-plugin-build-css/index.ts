import type { GetModuleInfo, OutputChunk } from 'rollup';
import { BuildInternals } from '../core/build/internal';
import type { PageBuildData } from '../core/build/types';

import crypto from 'crypto';
import esbuild from 'esbuild';
import { Plugin as VitePlugin } from 'vite';
import { AstroConfig } from '../@types/astro';
import { getTopLevelPages, walkParentInfos } from '../core/build/graph.js';
import { getPageDataByViteID, getPageDatasByClientOnlyID } from '../core/build/internal.js';
import { isCSSRequest } from '../core/render/util.js';

interface PluginOptions {
	internals: BuildInternals;
	target: 'client' | 'server';
	astroConfig: AstroConfig;
}

export function rollupPluginAstroBuildCSS(options: PluginOptions): VitePlugin[] {
	const { internals } = options;

	function createHashOfPageParents(id: string, ctx: { getModuleInfo: GetModuleInfo }): string {
		const parents = Array.from(getTopLevelPages(id, ctx)).sort();
		const hash = crypto.createHash('sha256');
		for (const page of parents) {
			hash.update(page, 'utf-8');
		}
		return hash.digest('hex').slice(0, 8);
	}

	function* getParentClientOnlys(
		id: string,
		ctx: { getModuleInfo: GetModuleInfo }
	): Generator<PageBuildData, void, unknown> {
		for (const info of walkParentInfos(id, ctx)) {
			yield* getPageDatasByClientOnlyID(internals, info.id);
		}
	}

	const CSS_PLUGIN_NAME = '@astrojs/rollup-plugin-build-css';
	const CSS_MINIFY_PLUGIN_NAME = '@astrojs/rollup-plugin-build-css-minify';

	return [
		{
			name: CSS_PLUGIN_NAME,

			outputOptions(outputOptions) {
				const manualChunks = outputOptions.manualChunks || Function.prototype;
				outputOptions.manualChunks = function (id, ...args) {
					// Defer to user-provided `manualChunks`, if it was provided.
					if (typeof manualChunks == 'object') {
						if (id in manualChunks) {
							return manualChunks[id];
						}
					} else if (typeof manualChunks === 'function') {
						const outid = manualChunks.call(this, id, ...args);
						if (outid) {
							return outid;
						}
					}

					// For CSS, create a hash of all of the pages that use it.
					// This causes CSS to be built into shared chunks when used by multiple pages.
					if (isCSSRequest(id)) {
						return createHashOfPageParents(id, args[0]);
					}
				};
			},

			async generateBundle(_outputOptions, bundle) {
				type ViteMetadata = {
					importedAssets: Set<string>;
					importedCss: Set<string>;
				};

				for (const [_, chunk] of Object.entries(bundle)) {
					if (chunk.type === 'chunk') {
						const c = chunk;
						if ('viteMetadata' in chunk) {
							const meta = chunk['viteMetadata'] as ViteMetadata;

							// Chunks that have the viteMetadata.importedCss are CSS chunks
							if (meta.importedCss.size) {
								// For the client build, client:only styles need to be mapped
								// over to their page. For this chunk, determine if it's a child of a
								// client:only component and if so, add its CSS to the page it belongs to.
								if (options.target === 'client') {
									for (const [id] of Object.entries(c.modules)) {
										for (const pageData of getParentClientOnlys(id, this)) {
											for (const importedCssImport of meta.importedCss) {
												pageData.css.add(importedCssImport);
											}
										}
									}
								}

								// For this CSS chunk, walk parents until you find a page. Add the CSS to that page.
								for (const [id] of Object.entries(c.modules)) {
									for (const pageViteID of getTopLevelPages(id, this)) {
										const pageData = getPageDataByViteID(internals, pageViteID);
										for (const importedCssImport of meta.importedCss) {
											pageData?.css.add(importedCssImport);
										}
									}
								}
							}
						}
					}
				}
			},
		},
		{
			name: CSS_MINIFY_PLUGIN_NAME,
			enforce: 'post',
			async generateBundle(_outputOptions, bundle) {
				// Minify CSS in each bundle ourselves, since server builds are not minified
				// so that the JS is debuggable. Since you cannot configure vite:css-post to minify
				// we need to do it ourselves.
				if (options.target === 'server') {
					for (const [, output] of Object.entries(bundle)) {
						if (output.type === 'asset') {
							if (output.name?.endsWith('.css') && typeof output.source === 'string') {
								const cssTarget = options.astroConfig.vite.build?.cssTarget;
								const { code: minifiedCSS } = await esbuild.transform(output.source, {
									loader: 'css',
									minify: true,
									...(cssTarget ? { target: cssTarget } : {}),
								});
								output.source = minifiedCSS;
							}
						} else if (output.type === 'chunk') {
							// vite:css-post removes "pure CSS" JavaScript chunks, that is chunks that only contain a comment
							// about it being a CSS module. We need to keep these chunks around because Astro
							// re-imports all modules as their namespace `import * as module1 from 'some/path';
							// in order to determine if one of them is a side-effectual web component.
							// If we ever get rid of that feature, the code below can be removed.
							for (const [imp, bindings] of Object.entries(output.importedBindings)) {
								if (imp.startsWith('chunks/') && !bundle[imp] && output.code.includes(imp)) {
									// This just creates an empty chunk module so that the main entry module
									// that is importing it doesn't break.
									const depChunk: OutputChunk = {
										type: 'chunk',
										fileName: imp,
										name: imp,
										facadeModuleId: imp,
										code: `/* Pure CSS chunk ${imp} */ ${bindings
											.map((b) => `export const ${b} = {};`)
											.join('')}`,
										dynamicImports: [],
										implicitlyLoadedBefore: [],
										importedBindings: {},
										imports: [],
										referencedFiles: [],
										exports: Array.from(bindings),
										isDynamicEntry: false,
										isEntry: false,
										isImplicitEntry: false,
										modules: {},
									};
									bundle[imp] = depChunk;
								}
							}
						}
					}
				}
			},
		},
	];
}

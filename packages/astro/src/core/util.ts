import eol from 'eol';
import fs from 'fs';
import path from 'path';
import resolve from 'resolve';
import slash from 'slash';
import { fileURLToPath, pathToFileURL } from 'url';
import type { ErrorPayload, ViteDevServer } from 'vite';
import type { AstroConfig, AstroSettings, RouteType } from '../@types/astro';
import { prependForwardSlash, removeTrailingForwardSlash } from './path.js';

// process.env.PACKAGE_VERSION is injected when we build and publish the astro package.
export const ASTRO_VERSION = process.env.PACKAGE_VERSION ?? 'development';

/** Returns true if argument is an object of any prototype/class (but not null). */
export function isObject(value: unknown): value is Record<string, any> {
	return typeof value === 'object' && value != null;
}

/** Wraps an object in an array. If an array is passed, ignore it. */
export function arraify<T>(target: T | T[]): T[] {
	return Array.isArray(target) ? target : [target];
}

export function padMultilineString(source: string, n = 2) {
	const lines = source.split(/\r?\n/);
	return lines.map((l) => ` `.repeat(n) + l).join(`\n`);
}

const REGEXP_404_OR_500_ROUTE = /(404)|(500)\/?$/;

/**
 * Get the correct output filename for a route, based on your config.
 * Handles both "/foo" and "foo" `name` formats.
 * Handles `/404` and `/` correctly.
 */
export function getOutputFilename(astroConfig: AstroConfig, name: string, type: RouteType) {
	if (type === 'endpoint') {
		return name;
	}
	if (name === '/' || name === '') {
		return path.posix.join(name, 'index.html');
	}
	if (astroConfig.build.format === 'file' || REGEXP_404_OR_500_ROUTE.test(name)) {
		return `${removeTrailingForwardSlash(name || 'index')}.html`;
	}
	return path.posix.join(name, 'index.html');
}

/** is a specifier an npm package? */
export function parseNpmName(
	spec: string
): { scope?: string; name: string; subpath?: string } | undefined {
	// not an npm package
	if (!spec || spec[0] === '.' || spec[0] === '/') return undefined;

	let scope: string | undefined;
	let name = '';

	let parts = spec.split('/');
	if (parts[0][0] === '@') {
		scope = parts[0];
		name = parts.shift() + '/';
	}
	name += parts.shift();

	let subpath = parts.length ? `./${parts.join('/')}` : undefined;

	return {
		scope,
		name,
		subpath,
	};
}

/** Coalesce any throw variable to an Error instance. */
export function createSafeError(err: any): Error {
	return err instanceof Error || (err && err.name && err.message)
		? err
		: new Error(JSON.stringify(err));
}

/** generate code frame from esbuild error */
export function codeFrame(src: string, loc: ErrorPayload['err']['loc']): string {
	if (!loc) return '';
	const lines = eol
		.lf(src)
		.split('\n')
		.map((ln) => ln.replace(/\t/g, '  '));
	// grab 2 lines before, and 3 lines after focused line
	const visibleLines = [];
	for (let n = -2; n <= 2; n++) {
		if (lines[loc.line + n]) visibleLines.push(loc.line + n);
	}
	// figure out gutter width
	let gutterWidth = 0;
	for (const lineNo of visibleLines) {
		let w = `> ${lineNo}`;
		if (w.length > gutterWidth) gutterWidth = w.length;
	}
	// print lines
	let output = '';
	for (const lineNo of visibleLines) {
		const isFocusedLine = lineNo === loc.line - 1;
		output += isFocusedLine ? '> ' : '  ';
		output += `${lineNo + 1} | ${lines[lineNo]}\n`;
		if (isFocusedLine)
			output += `${Array.from({ length: gutterWidth }).join(' ')}  | ${Array.from({
				length: loc.column,
			}).join(' ')}^\n`;
	}
	return output;
}

export function resolveDependency(dep: string, projectRoot: URL) {
	const resolved = resolve.sync(dep, {
		basedir: fileURLToPath(projectRoot),
	});
	// For Windows compat, we need a fully resolved `file://` URL string
	return pathToFileURL(resolved).toString();
}

/**
 * Convert file URL to ID for viteServer.moduleGraph.idToModuleMap.get(:viteID)
 * Format:
 *   Linux/Mac:  /Users/astro/code/my-project/src/pages/index.astro
 *   Windows:    C:/Users/astro/code/my-project/src/pages/index.astro
 */
export function viteID(filePath: URL): string {
	return slash(fileURLToPath(filePath) + filePath.search).replace(/\\/g, '/');
}

export const VALID_ID_PREFIX = `/@id/`;

// Strip valid id prefix. This is prepended to resolved Ids that are
// not valid browser import specifiers by the importAnalysis plugin.
export function unwrapId(id: string): string {
	return id.startsWith(VALID_ID_PREFIX) ? id.slice(VALID_ID_PREFIX.length) : id;
}

/** An fs utility, similar to `rimraf` or `rm -rf` */
export function removeDir(_dir: URL): void {
	const dir = fileURLToPath(_dir);
	fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
}

export function emptyDir(_dir: URL, skip?: Set<string>): void {
	const dir = fileURLToPath(_dir);
	if (!fs.existsSync(dir)) return undefined;
	for (const file of fs.readdirSync(dir)) {
		if (skip?.has(file)) {
			continue;
		}
		fs.rmSync(path.resolve(dir, file), { recursive: true, force: true, maxRetries: 3 });
	}
}

export function resolvePages(config: AstroConfig) {
	return new URL('./pages', config.srcDir);
}

function isInPagesDir(file: URL, config: AstroConfig): boolean {
	const pagesDir = resolvePages(config);
	return file.toString().startsWith(pagesDir.toString());
}

function isPublicRoute(file: URL, config: AstroConfig): boolean {
	const pagesDir = resolvePages(config);
	const parts = file.toString().replace(pagesDir.toString(), '').split('/').slice(1);
	for (const part of parts) {
		if (part.startsWith('_')) return false;
	}
	return true;
}

function endsWithPageExt(file: URL, settings: AstroSettings): boolean {
	for (const ext of settings.pageExtensions) {
		if (file.toString().endsWith(ext)) return true;
	}
	return false;
}

export function isPage(file: URL, settings: AstroSettings): boolean {
	if (!isInPagesDir(file, settings.config)) return false;
	if (!isPublicRoute(file, settings.config)) return false;
	return endsWithPageExt(file, settings);
}

export function isModeServerWithNoAdapter(settings: AstroSettings): boolean {
	return settings.config.output === 'server' && !settings.adapter;
}

export function relativeToSrcDir(config: AstroConfig, idOrUrl: URL | string) {
	let id: string;
	if (typeof idOrUrl !== 'string') {
		id = unwrapId(viteID(idOrUrl));
	} else {
		id = idOrUrl;
	}
	return id.slice(slash(fileURLToPath(config.srcDir)).length);
}

export function emoji(char: string, fallback: string) {
	return process.platform !== 'win32' ? char : fallback;
}

export function getLocalAddress(serverAddress: string, host: string | boolean): string {
	if (typeof host === 'boolean' || host === 'localhost') {
		return 'localhost';
	} else {
		return serverAddress;
	}
}

/**
 * Simulate Vite's resolve and import analysis so we can import the id as an URL
 * through a script tag or a dynamic import as-is.
 */
// NOTE: `/@id/` should only be used when the id is fully resolved
export async function resolveIdToUrl(viteServer: ViteDevServer, id: string) {
	const result = await viteServer.pluginContainer.resolveId(id);
	if (!result) {
		return VALID_ID_PREFIX + id;
	}
	if (path.isAbsolute(result.id)) {
		return '/@fs' + prependForwardSlash(result.id);
	}
	return VALID_ID_PREFIX + result.id;
}

export const AggregateError =
	typeof globalThis.AggregateError !== 'undefined'
		? globalThis.AggregateError
		: class extends Error {
				errors: Array<any> = [];
				constructor(errors: Iterable<any>, message?: string | undefined) {
					super(message);
					this.errors = Array.from(errors);
				}
		  };

import type {
	AstroComponentMetadata,
	SSRElement,
	SSRLoadedRenderer,
	SSRResult,
} from '../../@types/astro';
import { escapeHTML } from './escape.js';
import { serializeProps } from './serialize.js';
import { serializeListValue } from './util.js';

const HydrationDirectives = ['load', 'idle', 'media', 'visible', 'only'];

export interface HydrationMetadata {
	directive: string;
	value: string;
	componentUrl: string;
	componentExport: { value: string };
}

interface ExtractedProps {
	isPage: boolean;
	hydration: HydrationMetadata | null;
	props: Record<string | number, any>;
}

// Used to extract the directives, aka `client:load` information about a component.
// Finds these special props and removes them from what gets passed into the component.
export function extractDirectives(inputProps: Record<string | number, any>): ExtractedProps {
	let extracted: ExtractedProps = {
		isPage: false,
		hydration: null,
		props: {},
	};
	for (const [key, value] of Object.entries(inputProps)) {
		if (key.startsWith('server:')) {
			if (key === 'server:root') {
				extracted.isPage = true;
			}
		}
		if (key.startsWith('client:')) {
			if (!extracted.hydration) {
				extracted.hydration = {
					directive: '',
					value: '',
					componentUrl: '',
					componentExport: { value: '' },
				};
			}
			switch (key) {
				case 'client:component-path': {
					extracted.hydration.componentUrl = value;
					break;
				}
				case 'client:component-export': {
					extracted.hydration.componentExport.value = value;
					break;
				}
				// This is a special prop added to prove that the client hydration method
				// was added statically.
				case 'client:component-hydration': {
					break;
				}
				case 'client:display-name': {
					break;
				}
				default: {
					extracted.hydration.directive = key.split(':')[1];
					extracted.hydration.value = value;

					// throw an error if an invalid hydration directive was provided
					if (HydrationDirectives.indexOf(extracted.hydration.directive) < 0) {
						throw new Error(
							`Error: invalid hydration directive "${key}". Supported hydration methods: ${HydrationDirectives.map(
								(d) => `"client:${d}"`
							).join(', ')}`
						);
					}

					// throw an error if the query wasn't provided for client:media
					if (
						extracted.hydration.directive === 'media' &&
						typeof extracted.hydration.value !== 'string'
					) {
						throw new Error(
							'Error: Media query must be provided for "client:media", similar to client:media="(max-width: 600px)"'
						);
					}

					break;
				}
			}
		} else if (key === 'class:list') {
			// support "class" from an expression passed into a component (#782)
			extracted.props[key.slice(0, -5)] = serializeListValue(value);
		} else {
			extracted.props[key] = value;
		}
	}

	return extracted;
}

interface HydrateScriptOptions {
	renderer: SSRLoadedRenderer;
	result: SSRResult;
	astroId: string;
	props: Record<string | number, any>;
}

/** For hydrated components, generate a <script type="module"> to load the component */
export async function generateHydrateScript(
	scriptOptions: HydrateScriptOptions,
	metadata: Required<AstroComponentMetadata>
): Promise<SSRElement> {
	const { renderer, result, astroId, props } = scriptOptions;
	const { hydrate, componentUrl, componentExport } = metadata;

	if (!componentExport) {
		throw new Error(
			`Unable to resolve a componentExport for "${metadata.displayName}"! Please open an issue.`
		);
	}

	const island: SSRElement = {
		children: '',
		props: {
			// This is for HMR, probably can avoid it in prod
			uid: astroId,
		},
	};

	// Add component url
	island.props['component-url'] = await result.resolve(componentUrl);

	// Add renderer url
	if (renderer.clientEntrypoint) {
		island.props['component-export'] = componentExport.value;
		island.props['renderer-url'] = await result.resolve(renderer.clientEntrypoint);
		island.props['props'] = escapeHTML(serializeProps(props));
	}

	island.props['ssr'] = '';
	island.props['client'] = hydrate;
	island.props['before-hydration-url'] = await result.resolve('astro:scripts/before-hydration.js');
	island.props['opts'] = escapeHTML(
		JSON.stringify({
			name: metadata.displayName,
			value: metadata.hydrateArgs || '',
		})
	);

	return island;
}
